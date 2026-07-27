/**
 * GaplessEngine — the only module in the app allowed to import `gapless`.
 *
 * Wraps a single `Queue` (HYBRID: HTML5 start → Web Audio for sample-accurate
 * transitions) and maps queue indices back to setlist slot ids so the
 * AudioPlayerContext can stay the source of truth for playlist state.
 *
 * Progress is written to a plain ref and fanned out to subscribers at ~4Hz —
 * `onProgress` fires at ~60fps and must never drive a React render per tick.
 *
 * The `gapless` import is dynamic so environments without Web Audio (jsdom
 * tests, unsupported browsers) never load it; `Queue` instances share one
 * module-level AudioContext upstream, so replacing the queue per setlist does
 * not leak contexts.
 */

import type { Queue as GaplessQueue, TrackInfo, TrackMetadata, PlaybackType } from "gapless";
import { audioDebug } from "@/lib/audioDebug";

export interface EngineTrack {
  slotId: string;
  url: string;
  metadata?: TrackMetadata;
}

export interface ProgressSnapshot {
  currentTime: number;
  duration: number;
  /** Which backend produced the last tick — WEBAUDIO means gapless handoff is armed. */
  playbackType?: PlaybackType;
}

export interface EngineCallbacks {
  /** A queue track became current (initial start, gapless advance, or user jump). */
  onTrackStarted: (slotId: string, queueIndex: number) => void;
  /** The last track in the queue finished. */
  onQueueEnded: () => void;
  onError: (error: Error) => void;
  onPlayBlocked: () => void;
  /** Fired only on transitions, never per tick. */
  onPlayStateChanged: (isPlaying: boolean) => void;
}

const PROGRESS_NOTIFY_INTERVAL_MS = 250;

export class GaplessEngine {
  readonly progressRef: { current: ProgressSnapshot } = {
    current: { currentTime: 0, duration: 0 },
  };

  private queue: GaplessQueue | null = null;
  private slotIds: string[] = [];
  private callbacks: EngineCallbacks;
  private volume = 1;
  private destroyed = false;
  /** Incremented per load(); stale async work checks it and bails. */
  private generation = 0;
  /** Serializes async operations (dynamic import + queue mutations). */
  private op: Promise<void> = Promise.resolve();
  private progressSubscribers = new Set<(p: ProgressSnapshot) => void>();
  private lastNotifyAt = 0;
  private lastIsPlaying = false;
  /**
   * What the user last asked for. Checked after async loads resolve so a
   * pause issued while a track was still resolving is never overridden by
   * the load completing and starting playback (Relisten failure mode 4.1).
   */
  private desiredTransportState: "playing" | "paused" = "paused";

  constructor(callbacks: EngineCallbacks) {
    this.callbacks = callbacks;
  }

  // ── queue lifecycle ────────────────────────────────────────────────

  /** Replace the queue with `tracks`, starting playback at `startIndex`. */
  load(tracks: EngineTrack[], startIndex = 0, autoplay = true): void {
    const gen = ++this.generation;
    this.desiredTransportState = autoplay ? "playing" : "paused";
    this.enqueueOp(async () => {
      if (gen !== this.generation || this.destroyed) return;
      this.teardownQueue();
      const queue = await this.createQueue();
      if (gen !== this.generation || this.destroyed) {
        queue.destroy();
        return;
      }
      this.queue = queue;
      this.slotIds = tracks.map((t) => t.slotId);
      for (const t of tracks) {
        queue.addTrack(t.url, { metadata: t.metadata });
      }
      if (tracks.length > 0) {
        queue.gotoTrack(startIndex, autoplay && this.desiredTransportState === "playing");
      }
    });
  }

  /** Append a resolved track to the end of the current queue. */
  append(track: EngineTrack): void {
    const gen = this.generation;
    this.enqueueOp(async () => {
      if (gen !== this.generation || this.destroyed || !this.queue) return;
      this.slotIds.push(track.slotId);
      this.queue.addTrack(track.url, { metadata: track.metadata });
    });
  }

  /** Stop playback and drop the queue. The engine stays usable for the next load(). */
  clear(): void {
    this.generation++;
    this.desiredTransportState = "paused";
    this.enqueueOp(async () => {
      this.teardownQueue();
    });
  }

  destroy(): void {
    this.destroyed = true;
    this.generation++;
    this.enqueueOp(async () => {
      this.teardownQueue();
      this.progressSubscribers.clear();
    });
  }

  // ── transport ──────────────────────────────────────────────────────

  play(): void {
    this.desiredTransportState = "playing";
    this.enqueueOp(async () => {
      if (this.desiredTransportState !== "playing") return;
      await this.queue?.resumeAudioContext().catch(() => undefined);
      this.queue?.play();
    });
  }

  pause(): void {
    this.desiredTransportState = "paused";
    this.enqueueOp(async () => {
      this.queue?.pause();
      this.notifyPlayState(false);
    });
  }

  togglePlayPause(): void {
    if (this.desiredTransportState === "playing") this.pause();
    else this.play();
  }

  next(): void {
    this.enqueueOp(async () => {
      this.queue?.next();
    });
  }

  previous(): void {
    this.enqueueOp(async () => {
      this.queue?.previous();
    });
  }

  gotoIndex(index: number, playImmediately = true): void {
    if (playImmediately) this.desiredTransportState = "playing";
    this.enqueueOp(async () => {
      this.queue?.gotoTrack(index, playImmediately);
    });
  }

  seek(seconds: number): void {
    this.enqueueOp(async () => {
      this.queue?.seek(seconds);
    });
  }

  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
    this.enqueueOp(async () => {
      this.queue?.setVolume(this.volume);
    });
  }

  /** Must be called from inside a user-gesture handler to unlock audio. */
  resumeAudioContext(): Promise<void> {
    return this.queue?.resumeAudioContext() ?? Promise.resolve();
  }

  /**
   * Best-effort audio unlock for the FIRST play gesture, before any track has
   * resolved (so no queue exists yet). Creates the queue if needed and resumes
   * the shared AudioContext while the gesture's transient activation window is
   * still open. If the browser refuses anyway, onPlayBlocked → the visible
   * "tap to start" state remains the safety net.
   */
  unlock(): void {
    this.enqueueOp(async () => {
      if (this.destroyed) return;
      if (!this.queue) this.queue = await this.createQueue();
      await this.queue.resumeAudioContext().catch(() => undefined);
    });
  }

  // ── introspection ──────────────────────────────────────────────────

  indexOfSlot(slotId: string): number {
    return this.slotIds.indexOf(slotId);
  }

  get queueLength(): number {
    return this.slotIds.length;
  }

  get currentSlotId(): string | null {
    const idx = this.queue?.currentTrackIndex ?? -1;
    return this.slotIds[idx] ?? null;
  }

  get isPlaying(): boolean {
    return this.queue?.isPlaying ?? false;
  }

  subscribeProgress(cb: (p: ProgressSnapshot) => void): () => void {
    this.progressSubscribers.add(cb);
    return () => this.progressSubscribers.delete(cb);
  }

  // ── internals ──────────────────────────────────────────────────────

  private enqueueOp(fn: () => Promise<void>): void {
    this.op = this.op.then(fn).catch((e) => {
      audioDebug.log("gapless", "engine op failed", { error: String(e) }, "warn");
    });
  }

  private teardownQueue(): void {
    if (this.queue) {
      try {
        this.queue.pause();
        this.queue.destroy();
      } catch {
        /* noop */
      }
      this.queue = null;
    }
    this.slotIds = [];
    this.progressRef.current = { currentTime: 0, duration: 0 };
    this.notifyPlayState(false);
  }

  private async createQueue(): Promise<GaplessQueue> {
    const mod = await import("gapless");
    const Queue = mod.Queue ?? mod.default;
    return new Queue({
      playbackMethod: "HYBRID",
      preloadNumTracks: 2,
      volume: this.volume,
      onProgress: (info) => this.handleProgress(info),
      onStartNewTrack: (info) => this.handleStartNewTrack(info),
      onEnded: () => {
        this.notifyPlayState(false);
        this.callbacks.onQueueEnded();
      },
      onError: (error) => this.callbacks.onError(error),
      onPlayBlocked: () => {
        this.notifyPlayState(false);
        this.callbacks.onPlayBlocked();
      },
      ...(import.meta.env.DEV
        ? { onDebug: (msg: string) => audioDebug.log("gapless", msg) }
        : {}),
    });
  }

  private handleStartNewTrack(info: TrackInfo): void {
    // A pause issued while this track was loading wins over the autoplay
    // that completed after it (see desiredTransportState docs above).
    if (this.desiredTransportState === "paused") {
      this.queue?.pause();
      return;
    }
    this.notifyPlayState(true);
    const slotId = this.slotIds[info.index];
    if (slotId) this.callbacks.onTrackStarted(slotId, info.index);
  }

  private handleProgress(info: TrackInfo): void {
    this.progressRef.current = {
      currentTime: info.currentTime,
      duration: Number.isFinite(info.duration) ? info.duration : 0,
      playbackType: info.playbackType,
    };
    this.notifyPlayState(info.isPlaying);
    const now = Date.now();
    if (now - this.lastNotifyAt >= PROGRESS_NOTIFY_INTERVAL_MS) {
      this.lastNotifyAt = now;
      const snapshot = this.progressRef.current;
      this.progressSubscribers.forEach((cb) => cb(snapshot));
    }
  }

  private notifyPlayState(isPlaying: boolean): void {
    if (isPlaying === this.lastIsPlaying) return;
    this.lastIsPlaying = isPlaying;
    this.callbacks.onPlayStateChanged(isPlaying);
  }
}
