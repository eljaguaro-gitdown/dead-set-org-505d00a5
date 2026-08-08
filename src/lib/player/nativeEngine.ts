/**
 * NativeEngine — GaplessEngine's twin for the Capacitor shell.
 *
 * Same public surface and callback contract as GaplessEngine
 * (AudioPlayerContext can't tell them apart), but playback happens in
 * native AVQueuePlayer via the NativeAudio plugin, so audio survives
 * backgrounding/lock and the lock screen gets real transport controls.
 *
 * The native side is authoritative: track auto-advance, remote commands
 * (lock screen next/prev), and interruptions all originate there and flow
 * back through plugin events, which this class translates into the
 * EngineCallbacks the context already understands.
 */
import type {
  EngineTrack,
  EngineCallbacks,
  ProgressSnapshot,
} from "@/lib/player/gaplessEngine";
import { NativeAudio, type NativeTrack } from "@/lib/player/nativeBridge";
import { audioDebug } from "@/lib/audioDebug";
import type { PluginListenerHandle } from "@capacitor/core";

const toNativeTrack = (t: EngineTrack): NativeTrack => {
  const artwork = t.metadata?.artwork?.[0]?.src;
  return {
    id: t.slotId,
    url: t.url,
    title: t.metadata?.title,
    artist: t.metadata?.artist,
    album: t.metadata?.album,
    artworkUrl: artwork,
  };
};

export class NativeEngine {
  readonly progressRef: { current: ProgressSnapshot } = {
    current: { currentTime: 0, duration: 0 },
  };

  private slotIds: string[] = [];
  private callbacks: EngineCallbacks;
  private destroyed = false;
  private currentIndex = -1;
  private playing = false;
  private listeners: PluginListenerHandle[] = [];
  private listenersReady: Promise<void>;
  private progressSubscribers = new Set<(p: ProgressSnapshot) => void>();
  /** Serializes plugin calls so load/append/goto never interleave. */
  private op: Promise<unknown> = Promise.resolve();

  constructor(callbacks: EngineCallbacks) {
    this.callbacks = callbacks;
    this.listenersReady = this.attachListeners();
  }

  private async attachListeners(): Promise<void> {
    try {
      this.listeners = await Promise.all([
        NativeAudio.addListener("trackChanged", ({ id, index }) => {
          if (this.destroyed) return;
          this.currentIndex = index;
          this.callbacks.onTrackStarted(id, index);
        }),
        NativeAudio.addListener("playbackState", ({ isPlaying }) => {
          if (this.destroyed) return;
          this.playing = isPlaying;
          this.callbacks.onPlayStateChanged(isPlaying);
        }),
        NativeAudio.addListener("progress", ({ currentTime, duration }) => {
          if (this.destroyed) return;
          this.progressRef.current = { currentTime, duration, playbackType: "HTML5" };
          const snapshot = this.progressRef.current;
          this.progressSubscribers.forEach((cb) => cb(snapshot));
        }),
        NativeAudio.addListener("queueEnded", () => {
          if (this.destroyed) return;
          this.playing = false;
          this.callbacks.onPlayStateChanged(false);
          this.callbacks.onQueueEnded();
        }),
        NativeAudio.addListener("error", ({ message }) => {
          if (this.destroyed) return;
          this.callbacks.onError(new Error(message));
        }),
      ]);
    } catch (e) {
      audioDebug.log("native", "listener attach failed", { error: String(e) }, "error");
    }
  }

  private enqueue(fn: () => Promise<unknown>): void {
    this.op = this.op
      .then(() => this.listenersReady)
      .then(fn)
      .catch((e) => {
        audioDebug.log("native", "engine op failed", { error: String(e) }, "warn");
      });
  }

  // ── queue lifecycle ────────────────────────────────────────────────

  load(tracks: EngineTrack[], startIndex = 0, autoplay = true): void {
    this.slotIds = tracks.map((t) => t.slotId);
    this.enqueue(() =>
      NativeAudio.load({
        tracks: tracks.map(toNativeTrack),
        startIndex,
        autoplay,
      }),
    );
  }

  append(track: EngineTrack): void {
    this.slotIds.push(track.slotId);
    this.enqueue(() => NativeAudio.append({ track: toNativeTrack(track) }));
  }

  clear(): void {
    this.slotIds = [];
    this.currentIndex = -1;
    this.enqueue(() => NativeAudio.stop());
  }

  destroy(): void {
    this.destroyed = true;
    this.enqueue(async () => {
      await NativeAudio.stop();
      this.listeners.forEach((l) => void l.remove());
      this.listeners = [];
      this.progressSubscribers.clear();
    });
  }

  // ── transport ──────────────────────────────────────────────────────

  play(): void {
    this.enqueue(() => NativeAudio.play());
  }

  pause(): void {
    this.enqueue(() => NativeAudio.pause());
  }

  togglePlayPause(): void {
    if (this.playing) this.pause();
    else this.play();
  }

  next(): void {
    const target = this.currentIndex + 1;
    if (target < this.slotIds.length) this.gotoIndex(target);
  }

  previous(): void {
    const target = this.currentIndex - 1;
    if (target >= 0) this.gotoIndex(target);
  }

  gotoIndex(index: number, playImmediately = true): void {
    this.enqueue(() => NativeAudio.gotoIndex({ index, autoplay: playImmediately }));
  }

  seek(seconds: number): void {
    this.enqueue(() => NativeAudio.seek({ seconds }));
  }

  setVolume(volume: number): void {
    this.enqueue(() => NativeAudio.setVolume({ volume: Math.min(1, Math.max(0, volume)) }));
  }

  /** Native playback needs no gesture-scoped unlock — kept for interface parity. */
  resumeAudioContext(): Promise<void> {
    return Promise.resolve();
  }

  unlock(): void {
    /* no-op: AVPlayer doesn't require a user-gesture unlock */
  }

  // ── introspection ──────────────────────────────────────────────────

  indexOfSlot(slotId: string): number {
    return this.slotIds.indexOf(slotId);
  }

  get queueLength(): number {
    return this.slotIds.length;
  }

  get currentSlotId(): string | null {
    return this.slotIds[this.currentIndex] ?? null;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  subscribeProgress(cb: (p: ProgressSnapshot) => void): () => void {
    this.progressSubscribers.add(cb);
    return () => this.progressSubscribers.delete(cb);
  }
}
