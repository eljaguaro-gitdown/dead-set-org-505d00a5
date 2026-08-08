import { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo, type ReactNode } from "react";
import { findArchiveRecording, findTrackInRecording } from "@/lib/archiveOrg";
import { audioDebug } from "@/lib/audioDebug";
import {
  startPlayEvent,
  finalizePlayEvent,
  pausePlayEvent,
  resumePlayEvent,
  setPlayEventTrackDuration,
} from "@/lib/playEventTracker";
import { resolvePlayerEngine, type PlayerEngine } from "@/lib/player/engineFlag";
import {
  GaplessEngine,
  type EngineTrack,
  type ProgressSnapshot,
} from "@/lib/player/gaplessEngine";
import { NativeEngine } from "@/lib/player/nativeEngine";
import { isNativeApp } from "@/lib/nativeApp";
import { captureAudioEvent, archiveIdentifierFromUrl } from "@/lib/player/audioInstrumentation";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import {
  fetchDjIntro,
  isDjIntroEnabled,
  type DjIntroLine,
} from "@/lib/djIntro";

type NotableVersion = Database["public"]["Tables"]["notable_versions"]["Row"];
type Song = Database["public"]["Tables"]["songs"]["Row"];

// --- Server-precomputed playability ----------------------------------------
// The `setlist_slot_playability` table (written by the precompute-slot-playability
// edge function) stores an already-resolved Archive.org direct track URL per
// setlist slot. Reading it lets us skip a live archive.org round-trip on play —
// faster starts, and the cache is shared across all users instead of per-tab.
// Only real setlist slots (UUID ids) on public/owned/collaborated setlists are
// ever in the table; synthetic slots (shared songs, ad-hoc archive picks) and
// rows that aren't there yet fall through to live resolution.
type Precomputed = { directTrackUrl: string; detailsUrl: string | null };

const precomputeCache = new Map<string, Precomputed | null>();

const SLOT_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reconstruct the archive.org details URL from a /download/<id>/<file> URL. */
function detailsUrlFromDownload(downloadUrl: string): string | null {
  const m = downloadUrl.match(/archive\.org\/download\/([^/?#]+)\//);
  return m?.[1] ? `https://archive.org/details/${m[1]}` : null;
}

/**
 * Look up a server-precomputed direct track URL for a real setlist slot.
 * Returns null for synthetic slot ids, DB misses, or any non-"playable" status —
 * callers then fall back to live archive.org resolution. Results (including
 * misses) are cached for the session so prefetch + play + advance don't each
 * re-query; a miss simply means we keep using the existing live path.
 */
async function lookupPrecomputedPlayability(slotId: string): Promise<Precomputed | null> {
  if (!SLOT_UUID_RE.test(slotId)) return null;
  const cached = precomputeCache.get(slotId);
  if (cached !== undefined) return cached;

  let result: Precomputed | null = null;
  try {
    const { data, error } = await supabase
      .from("setlist_slot_playability")
      .select("status, direct_track_url")
      .eq("slot_id", slotId)
      .maybeSingle();
    if (!error && data?.status === "playable" && data.direct_track_url) {
      result = {
        directTrackUrl: data.direct_track_url,
        detailsUrl: detailsUrlFromDownload(data.direct_track_url),
      };
    }
  } catch {
    result = null;
  }
  precomputeCache.set(slotId, result);
  return result;
}

export interface PlayableSlot {
  id: string;
  song: Pick<Song, "id" | "title">;
  version?: NotableVersion | null;
  setNumber: number;
  position: number;
  segueToNext: boolean;
  /** Direct track URL resolved from Archive.org for this specific song */
  directTrackUrl?: string | null;
}

// --- DJ intro pre-roll -----------------------------------------------------
// When enabled (see isDjIntroEnabled), playSetlist plays a two-character
// radio-show intro (Cosmic Charlie + Cherise) before the first song. See
// docs/features/dj-cosmic-charlie.md.
export type PreRollStatus = "warming" | "playing" | "signoff";

export interface PreRollState {
  status: PreRollStatus;
  setlistId: string;
  setlistTitle?: string | null;
  lines: DjIntroLine[];
  signoffUrl: string;
  currentLineIndex: number;
  /** playSetlist call sequence — used to detect superseded intros. */
  seq: number;
}

interface AudioPlayerState {
  playingSlot: PlayableSlot | null;
  playlistMode: boolean;
  playlistIndex: number;
  playlistSlots: PlayableSlot[];
  activeSetlistId: string | null;
  preRoll: PreRollState | null;
}

/**
 * Transport surface for the gapless engine (Phase 1 of the player swap).
 * Fully functional when `engine === "gapless"`; under `"legacy"` the mounted
 * AudioPlayer component owns its own <audio> element, so play/pause/seek/
 * setVolume are no-ops and next/previous fall through to advancePlaylist.
 */
export interface PlayerTransport {
  engine: PlayerEngine;
  isPlaying: boolean;
  /** True while the current slot's track URL is still resolving. */
  isLoading: boolean;
  /** True when the browser refused autoplay — show the "tap to start" state. */
  autoplayBlocked: boolean;
  play: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  next: () => void;
  previous: () => void;
  gotoTrack: (slotId: string) => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  /** High-frequency position snapshot — read from a rAF loop, never per-render. */
  getProgress: () => ProgressSnapshot;
  /** ~4Hz updates for time labels. Returns an unsubscribe function. */
  subscribeProgress: (cb: (p: ProgressSnapshot) => void) => () => void;
}

interface AudioPlayerContextValue extends AudioPlayerState {
  transport: PlayerTransport;
  /**
   * Play a single song. If `playlistContext` is provided, the surrounding
   * songs are queued so the player auto-advances when this one ends — this
   * is how clicking any song inside a setlist should behave (no "Play All"
   * required). Without context, it plays as a true one-off.
   */
  playSingle: (
    slot: PlayableSlot,
    playlistContext?: { slots: PlayableSlot[]; setlistId?: string | null },
  ) => void;
  playSetlist: (slots: PlayableSlot[], setlistId?: string) => Promise<void>;
  /** Append slots to the end of the current playlist instead of replacing it. */
  queueSetlist: (slots: PlayableSlot[]) => Promise<void>;
  stopPlayback: () => void;
  advancePlaylist: (dir: number) => Promise<void>;
  /** Skip the DJ intro currently playing / warming and jump straight to Set 1. */
  skipPreRoll: () => void;
}

const noopTransport: PlayerTransport = {
  engine: "legacy",
  isPlaying: false,
  isLoading: false,
  autoplayBlocked: false,
  play: () => undefined,
  pause: () => undefined,
  togglePlayPause: () => undefined,
  next: () => undefined,
  previous: () => undefined,
  gotoTrack: () => undefined,
  seek: () => undefined,
  setVolume: () => undefined,
  getProgress: () => ({ currentTime: 0, duration: 0 }),
  subscribeProgress: () => () => undefined,
};

const defaultAudioPlayerContext: AudioPlayerContextValue = {
  playingSlot: null,
  playlistMode: false,
  playlistIndex: 0,
  playlistSlots: [],
  activeSetlistId: null,
  preRoll: null,
  transport: noopTransport,
  playSingle: () => undefined,
  playSetlist: async () => undefined,
  queueSetlist: async () => undefined,
  stopPlayback: () => undefined,
  advancePlaylist: async () => undefined,
  skipPreRoll: () => undefined,
};

const AudioPlayerContext = createContext<AudioPlayerContextValue>(defaultAudioPlayerContext);

export const useAudioPlayer = () => {
  return useContext(AudioPlayerContext);
};

export const AudioPlayerProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AudioPlayerState>({
    playingSlot: null,
    playlistMode: false,
    playlistIndex: 0,
    playlistSlots: [],
    activeSetlistId: null,
    preRoll: null,
  });

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // Monotonic token for playSetlist calls — protects against race conditions
  // when the user taps "Play" on Setlist B while Setlist A is still resolving
  // its first playable track via Archive.org. Only the LATEST call commits.
  const playSetlistSeqRef = useRef(0);

  // ── Gapless engine (player_engine flag, default "gapless") ──────────
  // Context state stays the source of truth; the engine is a sink synced from
  // state changes, and its callbacks flow back through engineDrivenRef-guarded
  // updates so the two never feedback-loop. Under "legacy" (flag opt-out or no
  // Web Audio — including jsdom tests) every engine path below is inert and
  // the remount-per-track <AudioPlayer> behaves exactly as before.
  const engineMode = useMemo<PlayerEngine>(() => resolvePlayerEngine(), []);
  // In the Capacitor shell, playback runs in native AVQueuePlayer (survives
  // backgrounding/lock, drives the lock screen); everywhere else, gapless
  // Web Audio. Both expose the same surface — nothing downstream branches.
  const engineRef = useRef<GaplessEngine | NativeEngine | null>(null);
  /** Slot id the engine is currently on — dedupes sync-effect reloads. */
  const engineSlotIdRef = useRef<string | null>(null);
  /** True when the next playingSlot change came from an engine callback. */
  const engineDrivenRef = useRef(false);
  /** Generation token for the background resolve-and-append loop. */
  const resolveGenRef = useRef(0);
  /** Last progress tick, tagged with its slot — used to tell "finished" from "skipped"
   *  and whether the outgoing track was on the Web Audio (gapless-armed) path. */
  const lastProgressRef = useRef<{
    slotId: string | null;
    currentTime: number;
    duration: number;
    playbackType?: ProgressSnapshot["playbackType"];
  }>({ slotId: null, currentTime: 0, duration: 0 });
  const consecutiveErrorsRef = useRef(0);
  /** Set by transport.next/previous/gotoTrack so engine advances they cause
   *  aren't counted as gapless segues in instrumentation. */
  const userJumpRef = useRef(false);
  const [transportState, setTransportState] = useState({
    isPlaying: false,
    autoplayBlocked: false,
  });

  /** Finalize the outgoing play event as "finished" when it actually ran to the end. */
  const maybeFinalizeFinished = (outgoingSlotId: string | null) => {
    const p = lastProgressRef.current;
    if (
      outgoingSlotId &&
      p.slotId === outgoingSlotId &&
      p.duration > 0 &&
      p.currentTime / p.duration >= 0.85
    ) {
      void finalizePlayEvent("finished");
    }
  };

  // Engine callbacks delegate through a ref reassigned every render, so the
  // long-lived engine instance always sees fresh closures.
  const engineCbRef = useRef({
    onTrackStarted: (_slotId: string, _queueIndex: number) => undefined as void,
    onQueueEnded: () => undefined as void,
    onError: (_error: Error) => undefined as void,
    onPlayBlocked: () => undefined as void,
    onPlayStateChanged: (_isPlaying: boolean) => undefined as void,
  });

  const getEngine = useCallback((): GaplessEngine | NativeEngine => {
    if (!engineRef.current) {
      const EngineImpl = isNativeApp() ? NativeEngine : GaplessEngine;
      const engine = new EngineImpl({
        onTrackStarted: (slotId, queueIndex) => engineCbRef.current.onTrackStarted(slotId, queueIndex),
        onQueueEnded: () => engineCbRef.current.onQueueEnded(),
        onError: (error) => engineCbRef.current.onError(error),
        onPlayBlocked: () => engineCbRef.current.onPlayBlocked(),
        onPlayStateChanged: (isPlaying) => engineCbRef.current.onPlayStateChanged(isPlaying),
      });
      // Track duration + per-slot progress for analytics at the throttled rate.
      engine.subscribeProgress((p) => {
        lastProgressRef.current = { slotId: engineSlotIdRef.current, ...p };
        if (p.duration > 0) setPlayEventTrackDuration(p.duration * 1000);
      });
      engineRef.current = engine;
    }
    return engineRef.current;
  }, []);

  const toEngineTrack = (slot: PlayableSlot): EngineTrack => ({
    slotId: slot.id,
    url: slot.directTrackUrl!,
    metadata: {
      title: slot.song.title,
      // The iOS lock screen shows only title + artist (album appears just in
      // Control Center's expanded view), so the brand rides the artist line.
      artist: "Grateful Dead · Dead-Set.Org",
      album:
        [slot.version?.venue, slot.version?.show_date].filter(Boolean).join(" · ") ||
        "Dead-Set.Org",
      // Absolute HTTPS URL — relative artwork paths silently fail in Media Session.
      artwork: [
        {
          src: `${window.location.origin}/icons/icon-512.png`,
          sizes: "512x512",
          type: "image/png",
        },
      ],
    },
  });

  // ── DJ intro pre-roll orchestration ─────────────────────────────────
  // Pending playSetlist calls await a promise that resolves when the intro
  // finishes (naturally or via skip). completePreRoll clears state + resolves.
  const preRollDoneResolversRef = useRef<Array<() => void>>([]);
  const preRollAudioRef = useRef<HTMLAudioElement | null>(null);

  const completePreRoll = useCallback(() => {
    const resolvers = preRollDoneResolversRef.current;
    preRollDoneResolversRef.current = [];
    // Stop any live intro audio immediately so a skipped intro doesn't bleed
    // into the first song.
    if (preRollAudioRef.current) {
      try {
        preRollAudioRef.current.pause();
        preRollAudioRef.current.src = "";
      } catch { /* noop */ }
      preRollAudioRef.current = null;
    }
    setState((prev) => (prev.preRoll ? { ...prev, preRoll: null } : prev));
    resolvers.forEach((r) => r());
  }, []);

  const skipPreRoll = useCallback(() => {
    audioDebug.log("context", "skipPreRoll");
    completePreRoll();
  }, [completePreRoll]);

  const waitForPreRollDone = useCallback(() => {
    return new Promise<void>((resolve) => {
      preRollDoneResolversRef.current.push(resolve);
    });
  }, []);

  // Track per-song play events for analytics.
  // Fires whenever the playing song slot changes — start a new event,
  // implicitly finalizing any previous one as "skipped".
  useEffect(() => {
    const slot = state.playingSlot;
    if (!slot) return;
    captureAudioEvent("audio_play_started", {
      engine: engineMode,
      song_title: slot.song.title,
      show_date: slot.version?.show_date ?? null,
      identifier:
        archiveIdentifierFromUrl(slot.directTrackUrl) ?? slot.version?.archive_org_url ?? null,
    });
    void startPlayEvent({
      setlistId: state.activeSetlistId,
      slotId: slot.id,
      songId: slot.song.id,
      songTitle: slot.song.title,
      archiveUrl: slot.version?.archive_org_url ?? null,
      showDate: slot.version?.show_date ?? null,
      venue: slot.version?.venue ?? null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.playingSlot?.id, state.activeSetlistId]);

  const stopPlayback = useCallback(() => {
    audioDebug.log("context", "stopPlayback");
    playSetlistSeqRef.current++; // invalidate any in-flight playSetlist
    resolveGenRef.current++; // cancel background resolve-and-append
    engineSlotIdRef.current = null;
    // Cancel any pending pre-roll too — user pressed stop, they mean it.
    completePreRoll();
    audioDebug.setSlot(null, null, null, null);
    audioDebug.setPlaybackState("stopped");
    void finalizePlayEvent("skipped");
    setState({ playingSlot: null, playlistMode: false, playlistIndex: 0, playlistSlots: [], activeSetlistId: null, preRoll: null });
  }, [completePreRoll]);

  const playSingle = useCallback(async (
    slot: PlayableSlot,
    playlistContext?: { slots: PlayableSlot[]; setlistId?: string | null },
  ) => {
    audioDebug.log("context", "playSingle", { id: slot.id, song: slot.song.title, hasUrl: !!slot.version?.archive_org_url, hasDirect: !!slot.directTrackUrl, withContext: !!playlistContext });
    playSetlistSeqRef.current++; // invalidate any in-flight playSetlist
    engineSlotIdRef.current = null; // force the engine to (re)anchor on this slot
    // We're inside the user's tap — unlock the AudioContext while the gesture
    // window is open, before any async resolution starts.
    if (engineMode === "gapless") getEngine().unlock();
    // playSingle bypasses the DJ intro entirely — it's a "play this one song"
    // gesture, not a "start the show" gesture. Cancel any active pre-roll.
    if (stateRef.current.preRoll) completePreRoll();
    audioDebug.setSlot(slot.id, slot.song.title, slot.version?.archive_org_url ?? null, slot.directTrackUrl ?? null);
    audioDebug.setPlaybackState("starting");

    // Build the playlist around the clicked slot when context was provided.
    // This makes the player auto-advance to the next song in the setlist
    // when the current one ends — same behavior as "Play All", but starting
    // from the song the user actually clicked.
    let playlistMode = false;
    let playlistSlots: PlayableSlot[] = [];
    let playlistIndex = 0;
    let activeSetlistId: string | null = null;
    if (playlistContext && playlistContext.slots.length > 0) {
      const sorted = [...playlistContext.slots].sort(
        (a, b) => a.setNumber - b.setNumber || a.position - b.position,
      );
      const idx = sorted.findIndex((s) => s.id === slot.id);
      if (idx >= 0) {
        playlistMode = true;
        playlistSlots = sorted;
        playlistIndex = idx;
        activeSetlistId = playlistContext.setlistId ?? null;
      }
    }

    setState({ playingSlot: slot, playlistMode, playlistIndex, playlistSlots, activeSetlistId, preRoll: null });

    // Resolve direct track URL in background if missing
    if (!slot.directTrackUrl && slot.version?.archive_org_url) {
      const resolved = await resolveSlot(slot);
      if (resolved) {
        audioDebug.setDirectTrackUrl(resolved.directTrackUrl ?? null);
        audioDebug.log("context", "resolved direct track", { url: resolved.directTrackUrl });
        setState(prev => prev.playingSlot?.id === slot.id
          ? {
              ...prev,
              playingSlot: resolved,
              playlistSlots: prev.playlistMode
                ? prev.playlistSlots.map((s) => (s.id === resolved.id ? resolved : s))
                : prev.playlistSlots,
            }
          : prev
        );
      }
    } else if (!slot.version?.archive_org_url) {
      const resolved = await resolveSlot(slot);
      if (resolved?.version?.archive_org_url) {
        audioDebug.setSlot(resolved.id, resolved.song.title, resolved.version.archive_org_url, resolved.directTrackUrl ?? null);
        setState(prev => prev.playingSlot?.id === slot.id
          ? {
              ...prev,
              playingSlot: resolved,
              playlistSlots: prev.playlistMode
                ? prev.playlistSlots.map((s) => (s.id === resolved.id ? resolved : s))
                : prev.playlistSlots,
            }
          : prev
        );
      } else {
        audioDebug.log("context", "no audio found for song", { song: slot.song.title }, "error");
        toast.error("Couldn't find audio for this song");
        setState({ playingSlot: null, playlistMode: false, playlistIndex: 0, playlistSlots: [], activeSetlistId: null, preRoll: null });
      }
    }
  }, [completePreRoll, engineMode, getEngine]);

  /** Resolve a slot: ensure it has an archive URL and directTrackUrl */
  const resolveSlot = async (slot: PlayableSlot): Promise<PlayableSlot | null> => {
    if (slot.version?.archive_org_url && slot.directTrackUrl) return slot;

    // Prefer a server-precomputed direct track URL over a live archive.org
    // round-trip. Misses (private/uncrawled slots, synthetic ids) fall through
    // to the live resolution paths below — same behavior as before this change.
    const precomputed = await lookupPrecomputedPlayability(slot.id);
    if (precomputed) {
      audioDebug.log("resolve", "precomputed playability hit", { slot: slot.id, song: slot.song.title });
      const version: NotableVersion = slot.version
        ? { ...slot.version, archive_org_url: slot.version.archive_org_url ?? precomputed.detailsUrl }
        : {
            id: "", song_id: slot.song.id, show_date: "",
            archive_org_url: precomputed.detailsUrl, venue: null,
            city: null, era_id: null, rating: null, description: null,
          };
      return { ...slot, version, directTrackUrl: precomputed.directTrackUrl };
    }

    if (slot.version?.archive_org_url && !slot.directTrackUrl) {
      // Has a specific show URL — find the track WITHIN that recording
      audioDebug.log("resolve", "findTrackInRecording", { url: slot.version.archive_org_url, song: slot.song.title });
      const directUrl = await findTrackInRecording(slot.version.archive_org_url, slot.song.title);
      if (directUrl) {
        return { ...slot, directTrackUrl: directUrl };
      }
      // Couldn't find specific track in that recording — still usable via AudioPlayer fallback
      audioDebug.log("resolve", "no direct track in recording — falling back", { song: slot.song.title }, "warn");
      console.warn(`[QA] Could not resolve direct track for "${slot.song.title}" in ${slot.version.archive_org_url}`);
      return slot;
    }

    // No archive URL at all — do a generic search as last resort
    audioDebug.log("resolve", "findArchiveRecording (generic search)", { song: slot.song.title });
    const result = await findArchiveRecording(slot.song.title);
    if (result) {
      return {
        ...slot,
        version: {
          id: "", song_id: slot.song.id, show_date: result.date || "",
          archive_org_url: result.url, venue: result.venue,
          city: null, era_id: null, rating: null, description: null,
        },
        directTrackUrl: result.directTrackUrl || null,
      };
    }
    return null;
  };

  const playSetlist = useCallback(async (slots: PlayableSlot[], setlistId?: string) => {
    if (slots.length === 0) return;
    const seq = ++playSetlistSeqRef.current;
    engineSlotIdRef.current = null; // force the engine to (re)anchor on the new setlist
    // Inside the user's tap — unlock audio before resolution/pre-roll async work.
    if (engineMode === "gapless") getEngine().unlock();
    audioDebug.log("context", "playSetlist", { count: slots.length, setlistId, seq });
    audioDebug.setPlaybackState("starting");

    // CRITICAL: stop any current playback IMMEDIATELY so two streams can never overlap
    // while we asynchronously resolve the first playable track in the new setlist.
    if (stateRef.current.playingSlot) {
      void finalizePlayEvent("skipped");
      audioDebug.setSlot(null, null, null, null);
      setState({ playingSlot: null, playlistMode: false, playlistIndex: 0, playlistSlots: [], activeSetlistId: null, preRoll: null });
    }
    // Cancel any in-flight pre-roll from a previous playSetlist — its promise
    // resolvers fire so the previous caller can bail on the seq check.
    if (stateRef.current.preRoll) completePreRoll();

    // ── DJ intro pre-roll ─────────────────────────────────────────────
    // Feature-gated + requires a real setlistId (guest builds skip). Silently
    // no-ops on any failure so the setlist plays regardless.
    if (setlistId && isDjIntroEnabled()) {
      audioDebug.log("context", "pre-roll: warming", { setlistId, seq });
      setState((prev) => ({
        ...prev,
        preRoll: {
          status: "warming",
          setlistId,
          setlistTitle: null,
          lines: [],
          signoffUrl: "/audio/signoff.mp3",
          currentLineIndex: 0,
          seq,
        },
      }));
      const intro = await fetchDjIntro(setlistId);
      if (seq !== playSetlistSeqRef.current) {
        audioDebug.log("context", "pre-roll: superseded during fetch", { seq }, "warn");
        return;
      }
      if (intro) {
        audioDebug.log("context", "pre-roll: playing", { lines: intro.lines.length, seq });
        setState((prev) => (prev.preRoll && prev.preRoll.seq === seq ? {
          ...prev,
          preRoll: {
            ...prev.preRoll,
            status: "playing",
            lines: intro.lines,
            signoffUrl: intro.signoffUrl,
            currentLineIndex: 0,
          },
        } : prev));
        await waitForPreRollDone();
        if (seq !== playSetlistSeqRef.current) return;
      } else {
        audioDebug.log("context", "pre-roll: no intro available — skipping", { setlistId }, "warn");
        setState((prev) => (prev.preRoll && prev.preRoll.seq === seq ? { ...prev, preRoll: null } : prev));
      }
    }

    const sorted = [...slots].sort((a, b) => a.setNumber - b.setNumber || a.position - b.position);

    let startIndex = -1;
    let startSlot: PlayableSlot | null = null;

    for (let i = 0; i < sorted.length; i++) {
      const resolved = await resolveSlot(sorted[i]);
      // Bail out if a newer playSetlist call has superseded this one.
      if (seq !== playSetlistSeqRef.current) {
        audioDebug.log("context", "playSetlist superseded, aborting", { seq, current: playSetlistSeqRef.current, setlistId }, "warn");
        return;
      }
      if (resolved?.version?.archive_org_url) {
        startIndex = i;
        startSlot = resolved;
        sorted[i] = resolved; // Update in place for playlist
        break;
      }
    }

    if (!startSlot || startIndex < 0) {
      audioDebug.log("context", "no audio found in setlist", { setlistId }, "error");
      toast.error("Couldn't find audio for any songs in the setlist");
      return;
    }

    // Final guard before committing — superseded calls must not overwrite state.
    if (seq !== playSetlistSeqRef.current) {
      audioDebug.log("context", "playSetlist superseded before commit", { seq, current: playSetlistSeqRef.current, setlistId }, "warn");
      return;
    }

    if (setlistId) {
      supabase.rpc("increment_play_count", { _setlist_id: setlistId });
    }

    audioDebug.setSlot(startSlot.id, startSlot.song.title, startSlot.version?.archive_org_url ?? null, startSlot.directTrackUrl ?? null);
    setState({
      playingSlot: startSlot,
      playlistMode: true,
      playlistIndex: startIndex,
      playlistSlots: sorted,
      activeSetlistId: setlistId || null,
      preRoll: null,
    });
  }, [completePreRoll, waitForPreRollDone, engineMode, getEngine]);

  const advancePlaylist = useCallback(async (dir: number) => {
    const { playlistIndex, playlistSlots } = stateRef.current;
    engineSlotIdRef.current = null; // user-driven jump — the sync effect re-anchors the queue
    audioDebug.log("context", "advancePlaylist", { dir, fromIndex: playlistIndex });

    for (let i = playlistIndex + dir; i >= 0 && i < playlistSlots.length; i += dir) {
      const resolved = await resolveSlot(playlistSlots[i]);
      if (resolved?.version?.archive_org_url) {
        audioDebug.setSlot(resolved.id, resolved.song.title, resolved.version.archive_org_url, resolved.directTrackUrl ?? null);
        // Advancing through this path is gapped by definition: legacy remounts
        // the player, and in gapless mode this is a queue re-anchor.
        captureAudioEvent("audio_track_advanced", { engine: engineMode, gapless: false, dir });
        setState((prev) => ({
          ...prev,
          playlistIndex: i,
          playingSlot: resolved,
        }));
        return;
      }
      audioDebug.log("context", "skipping unresolved slot in playlist", { index: i, song: playlistSlots[i].song.title }, "warn");
    }

    audioDebug.log("context", "end of setlist", {});
    stopPlayback();
    toast.info("End of setlist");
  }, [stopPlayback, engineMode]);

  // ── Engine bridge: engine → state ───────────────────────────────────
  // Fresh closures every render; the long-lived engine delegates through the ref.
  engineCbRef.current = {
    onTrackStarted: (slotId) => {
      if (engineMode !== "gapless") return;
      consecutiveErrorsRef.current = 0;
      if (engineSlotIdRef.current === slotId) return; // the slot we just anchored on
      const outgoingSlotId = engineSlotIdRef.current;
      const wasUserJump = userJumpRef.current;
      userJumpRef.current = false;
      // Queue-internal advance. It counts as a completed gapless segue only
      // when it happened on its own (no user jump) with the outgoing track
      // already handed off to Web Audio — the scheduled-transition path.
      const seguedGaplessly =
        !wasUserJump && lastProgressRef.current.playbackType === "WEBAUDIO";
      captureAudioEvent("audio_track_advanced", {
        engine: "gapless",
        gapless: seguedGaplessly,
        user_jump: wasUserJump,
      });
      if (seguedGaplessly) captureAudioEvent("audio_segue_completed", {});
      maybeFinalizeFinished(outgoingSlotId);
      engineSlotIdRef.current = slotId;
      const st = stateRef.current;
      const idx = st.playlistSlots.findIndex((s) => s.id === slotId);
      if (idx === -1) return;
      const slot = st.playlistSlots[idx];
      audioDebug.log("context", "gapless advance", { song: slot.song.title, index: idx });
      audioDebug.setSlot(slot.id, slot.song.title, slot.version?.archive_org_url ?? null, slot.directTrackUrl ?? null);
      engineDrivenRef.current = true;
      setState((prev) => (prev.playingSlot ? { ...prev, playingSlot: slot, playlistIndex: idx } : prev));
    },
    onQueueEnded: () => {
      if (engineMode !== "gapless") return;
      maybeFinalizeFinished(engineSlotIdRef.current);
      const st = stateRef.current;
      if (st.playlistMode && st.playlistIndex < st.playlistSlots.length - 1) {
        // Slots beyond the built queue (still resolving, or queued after the
        // append loop finished) — advance through the normal path; the sync
        // effect re-anchors the queue there.
        void advancePlaylist(1);
      } else if (st.playlistMode) {
        stopPlayback();
        toast.info("End of setlist");
      } else {
        audioDebug.setPlaybackState("ended");
      }
    },
    onError: (error) => {
      if (engineMode !== "gapless") return;
      audioDebug.log("context", "gapless engine error", { error: String(error) }, "error");
      captureAudioEvent("audio_error", {
        engine: "gapless",
        message: String(error),
        track_url: stateRef.current.playingSlot?.directTrackUrl ?? null,
        playback_method: lastProgressRef.current.playbackType ?? "HTML5",
      });
      void finalizePlayEvent("error");
      consecutiveErrorsRef.current += 1;
      const st = stateRef.current;
      if (st.playlistMode && consecutiveErrorsRef.current <= 3) {
        void advancePlaylist(1); // keep the queue moving past a broken track
      } else {
        toast.error("Couldn't play this track");
      }
    },
    onPlayBlocked: () => {
      if (engineMode !== "gapless") return;
      audioDebug.log("context", "autoplay blocked", {}, "warn");
      captureAudioEvent("audio_autoplay_blocked", { engine: "gapless" });
      setTransportState((prev) => ({ ...prev, autoplayBlocked: true }));
    },
    onPlayStateChanged: (isPlaying) => {
      if (engineMode !== "gapless") return;
      audioDebug.setPlaybackState(isPlaying ? "playing" : "paused");
      if (isPlaying) resumePlayEvent();
      else pausePlayEvent();
      setTransportState((prev) => (prev.isPlaying === isPlaying ? prev : { ...prev, isPlaying }));
    },
  };

  /**
   * Resolve upcoming playlist slots in order and append them to the live
   * queue, so gapless transitions have real URLs ahead of the playhead.
   * Sequential on purpose — no hammering archive.org in parallel. Reads
   * playlistSlots through stateRef each iteration so setlists queued while
   * the loop runs are picked up too.
   */
  const resolveAndAppendUpcoming = useCallback(async (gen: number, anchorSlotId: string) => {
    const engine = engineRef.current;
    if (!engine) return;
    const startIdx = stateRef.current.playlistSlots.findIndex((s) => s.id === anchorSlotId);
    if (startIdx === -1) return;
    for (let i = startIdx + 1; i < stateRef.current.playlistSlots.length; i++) {
      if (gen !== resolveGenRef.current) return;
      const slot = stateRef.current.playlistSlots[i];
      let resolved = slot;
      if (!slot.directTrackUrl || !slot.version?.archive_org_url) {
        const r = await resolveSlot(slot);
        if (r) resolved = r;
      }
      if (gen !== resolveGenRef.current) return;
      if (!resolved.directTrackUrl) {
        audioDebug.log("context", "gapless: skipping unresolvable slot", { song: slot.song.title }, "warn");
        continue;
      }
      if (resolved !== slot) {
        setState((prev) => {
          const idx = prev.playlistSlots.findIndex((s) => s.id === resolved.id);
          if (idx === -1) return prev;
          const copy = [...prev.playlistSlots];
          copy[idx] = resolved;
          return { ...prev, playlistSlots: copy };
        });
      }
      audioDebug.log("context", "gapless: queued upcoming track", { song: resolved.song.title });
      engine.append(toEngineTrack(resolved));
    }
  }, []);

  // ── Engine bridge: state → engine ───────────────────────────────────
  // User-driven playingSlot changes (play, jump, skip) re-anchor the queue at
  // that slot; engine-driven advances (gapless transitions) skip the rebuild
  // so the scheduled Web Audio handoff is never torn down mid-segue.
  useEffect(() => {
    if (engineMode !== "gapless") return;
    const slot = state.playingSlot;
    if (!slot) {
      resolveGenRef.current++;
      engineSlotIdRef.current = null;
      engineRef.current?.clear();
      setTransportState((prev) =>
        prev.isPlaying || prev.autoplayBlocked ? { isPlaying: false, autoplayBlocked: false } : prev,
      );
      return;
    }
    if (engineDrivenRef.current) {
      engineDrivenRef.current = false;
      return;
    }
    if (!slot.directTrackUrl) return; // still resolving — transport.isLoading covers the UI
    if (engineSlotIdRef.current === slot.id) return;
    engineSlotIdRef.current = slot.id;
    const gen = ++resolveGenRef.current;
    const engine = getEngine();
    audioDebug.log("context", "gapless: anchoring queue", { song: slot.song.title });
    engine.load([toEngineTrack(slot)], 0, true);
    if (stateRef.current.playlistMode) {
      void resolveAndAppendUpcoming(gen, slot.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineMode, state.playingSlot?.id, state.playingSlot?.directTrackUrl, getEngine, resolveAndAppendUpcoming]);

  // Tear the engine down with the provider.
  useEffect(() => {
    return () => {
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, []);

  /**
   * Prefetch the next few slots in the playlist so even longer transitions
   * (with track-resolution round-trips) are gap-free. Two-stage warm-up per
   * slot:
   *   1. Resolve directTrackUrl via archive.org (if not already known) so
   *      advancePlaylist doesn't pay that round-trip on transition.
   *   2. Point a hidden <audio preload="auto"> at the resolved URL so the
   *      browser starts buffering bytes into HTTP cache.
   *
   * We keep a small pool of hidden audio elements — one per lookahead slot —
   * keyed by slot id, so buffering on slot N+1 isn't thrown away when we
   * start prefetching N+2 and N+3.
   */
  const PREFETCH_LOOKAHEAD = 3;
  const prefetchPoolRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  useEffect(() => {
    // The gapless engine preloads its own queue (preloadNumTracks) and the
    // resolve-and-append loop handles URL resolution — the hidden-element
    // pool is legacy-only.
    if (engineMode === "gapless") return;
    if (!state.playlistMode) return;
    const upcoming = state.playlistSlots.slice(
      state.playlistIndex + 1,
      state.playlistIndex + 1 + PREFETCH_LOOKAHEAD,
    );
    if (upcoming.length === 0) return;

    let cancelled = false;

    // Evict any pooled elements whose slot is no longer in the lookahead
    // window (already played, or user jumped). Frees memory + bandwidth.
    const keepIds = new Set(upcoming.map((s) => s.id));
    for (const [id, el] of prefetchPoolRef.current.entries()) {
      if (!keepIds.has(id)) {
        try { el.pause(); el.removeAttribute("src"); el.load(); } catch { /* noop */ }
        prefetchPoolRef.current.delete(id);
      }
    }

    (async () => {
      // Resolve + warm each upcoming slot sequentially. Sequential keeps us
      // from hammering archive.org with parallel metadata requests, and the
      // browser will continue buffering already-warmed slots in the background.
      for (const slot of upcoming) {
        if (cancelled) return;

        let resolved = slot;
        if (!slot.directTrackUrl || !slot.version?.archive_org_url) {
          const r = await resolveSlot(slot);
          if (r) resolved = r;
        }
        if (cancelled) return;

        // Persist newly-resolved metadata so advancePlaylist skips re-resolution.
        if (resolved !== slot) {
          setState((prev) => {
            if (!prev.playlistMode) return prev;
            const idx = prev.playlistSlots.findIndex((s) => s.id === resolved.id);
            if (idx === -1) return prev;
            const copy = [...prev.playlistSlots];
            copy[idx] = resolved;
            return { ...prev, playlistSlots: copy };
          });
        }

        const url = resolved.directTrackUrl;
        if (!url || typeof window === "undefined") continue;
        try {
          let el = prefetchPoolRef.current.get(resolved.id);
          if (!el) {
            el = new Audio();
            el.preload = "auto";
            el.muted = true;
            el.autoplay = false;
            prefetchPoolRef.current.set(resolved.id, el);
          }
          if (el.src !== url) {
            audioDebug.log("context", "prefetching upcoming track", { song: resolved.song.title });
            el.src = url;
            el.load();
          }
        } catch (e) {
          audioDebug.log("context", "prefetch failed", { error: String(e) }, "warn");
        }
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.playingSlot?.id, state.playlistMode, state.playlistIndex, state.playlistSlots.length]);

  // Tear down the prefetch pool entirely when playback stops.
  useEffect(() => {
    if (state.playingSlot) return;
    for (const el of prefetchPoolRef.current.values()) {
      try { el.pause(); el.removeAttribute("src"); el.load(); } catch { /* noop */ }
    }
    prefetchPoolRef.current.clear();
  }, [state.playingSlot]);

  // ── DJ intro playback effects ───────────────────────────────────────
  // Play the current pre-roll line whenever status="playing" and index advances.
  // When we run past the last line, transition status to "signoff".
  useEffect(() => {
    const pr = state.preRoll;
    if (!pr || pr.status !== "playing") return;

    const line = pr.lines[pr.currentLineIndex];
    if (!line) {
      // Past all script lines — hand off to signoff.
      setState((prev) => (prev.preRoll && prev.preRoll.seq === pr.seq ? {
        ...prev,
        preRoll: { ...prev.preRoll, status: "signoff" },
      } : prev));
      return;
    }

    audioDebug.log("context", "pre-roll: line", { idx: pr.currentLineIndex, speaker: line.speaker });
    const audio = new Audio(line.url);
    preRollAudioRef.current = audio;
    let cancelled = false;

    const advance = () => {
      if (cancelled) return;
      setState((prev) => (prev.preRoll && prev.preRoll.seq === pr.seq ? {
        ...prev,
        preRoll: { ...prev.preRoll, currentLineIndex: prev.preRoll.currentLineIndex + 1 },
      } : prev));
    };

    audio.addEventListener("ended", advance);
    audio.play().catch((err) => {
      audioDebug.log("context", "pre-roll: line play failed", { err: String(err) }, "warn");
      advance();
    });

    return () => {
      cancelled = true;
      audio.removeEventListener("ended", advance);
      try { audio.pause(); audio.src = ""; } catch { /* noop */ }
      if (preRollAudioRef.current === audio) preRollAudioRef.current = null;
    };
  }, [state.preRoll?.status, state.preRoll?.currentLineIndex, state.preRoll?.seq]);

  // Play the fixed signoff clip when pre-roll enters "signoff" status.
  // When it finishes, 500ms of silence, then hand off to the setlist.
  useEffect(() => {
    const pr = state.preRoll;
    if (!pr || pr.status !== "signoff") return;

    audioDebug.log("context", "pre-roll: signoff", { seq: pr.seq });
    const audio = new Audio(pr.signoffUrl);
    preRollAudioRef.current = audio;
    let cancelled = false;
    let handoffTimer: ReturnType<typeof setTimeout> | null = null;

    const finish = () => {
      if (cancelled) return;
      // Per design doc §11.3 — 500ms of clean silence between intro and Set 1.
      handoffTimer = setTimeout(() => {
        if (!cancelled) completePreRoll();
      }, 500);
    };

    audio.addEventListener("ended", finish);
    audio.play().catch((err) => {
      audioDebug.log("context", "pre-roll: signoff play failed", { err: String(err) }, "warn");
      finish();
    });

    return () => {
      cancelled = true;
      if (handoffTimer) clearTimeout(handoffTimer);
      audio.removeEventListener("ended", finish);
      try { audio.pause(); audio.src = ""; } catch { /* noop */ }
      if (preRollAudioRef.current === audio) preRollAudioRef.current = null;
    };
  }, [state.preRoll?.status, state.preRoll?.seq, completePreRoll]);

  /**
   * Append slots to the end of the active playlist. If nothing is playing,
   * falls back to playSetlist so the queue starts immediately.
   */
  const queueSetlist = useCallback(async (slots: PlayableSlot[]) => {
    if (slots.length === 0) return;
    const sorted = [...slots].sort((a, b) => a.setNumber - b.setNumber || a.position - b.position);
    const current = stateRef.current;

    if (!current.playingSlot) {
      await playSetlist(sorted);
      toast.success("Queued — playing now");
      return;
    }

    audioDebug.log("context", "queueSetlist append", { count: sorted.length });
    setState((prev) => ({
      ...prev,
      playlistMode: true,
      playlistSlots: prev.playlistMode ? [...prev.playlistSlots, ...sorted] : [prev.playingSlot!, ...sorted],
      playlistIndex: prev.playlistMode ? prev.playlistIndex : 0,
    }));
    toast.success(`Queued ${sorted.length} ${sorted.length === 1 ? "song" : "songs"}`);
  }, [playSetlist]);

  // Transport surface (Phase 1 gapless swap). Stable enough to rebuild per
  // render — the provider value object is fresh each render regardless, and
  // progress deliberately flows through refs/subscriptions, never state.
  const transport: PlayerTransport = {
    engine: engineMode,
    isPlaying: engineMode === "gapless" ? transportState.isPlaying : false,
    isLoading: !!state.playingSlot && !state.playingSlot.directTrackUrl,
    autoplayBlocked: transportState.autoplayBlocked,
    play: () => {
      if (engineMode !== "gapless") return;
      setTransportState((prev) => (prev.autoplayBlocked ? { ...prev, autoplayBlocked: false } : prev));
      // Engine resumes the AudioContext inside this gesture before playing.
      engineRef.current?.play();
    },
    pause: () => {
      if (engineMode === "gapless") engineRef.current?.pause();
    },
    togglePlayPause: () => {
      if (engineMode !== "gapless") return;
      setTransportState((prev) => (prev.autoplayBlocked ? { ...prev, autoplayBlocked: false } : prev));
      engineRef.current?.togglePlayPause();
    },
    next: () => {
      const st = stateRef.current;
      const engine = engineRef.current;
      if (engineMode === "gapless" && engine && st.playingSlot) {
        const idx = engine.indexOfSlot(st.playingSlot.id);
        // Adjacent track already in the queue → advance inside the engine so
        // its preload isn't thrown away by a queue rebuild.
        if (idx >= 0 && idx + 1 < engine.queueLength) {
          userJumpRef.current = true;
          engine.next();
          return;
        }
      }
      void advancePlaylist(1);
    },
    previous: () => {
      const st = stateRef.current;
      const engine = engineRef.current;
      if (engineMode === "gapless" && engine && st.playingSlot) {
        const idx = engine.indexOfSlot(st.playingSlot.id);
        if (idx > 0) {
          userJumpRef.current = true;
          engine.previous();
          return;
        }
      }
      void advancePlaylist(-1);
    },
    gotoTrack: (slotId: string) => {
      const st = stateRef.current;
      const engine = engineRef.current;
      if (engineMode === "gapless" && engine) {
        const idx = engine.indexOfSlot(slotId);
        if (idx >= 0) {
          userJumpRef.current = true;
          engine.gotoIndex(idx, true);
          return;
        }
      }
      const slot = st.playlistSlots.find((s) => s.id === slotId);
      if (slot) void playSingle(slot, { slots: st.playlistSlots, setlistId: st.activeSetlistId });
    },
    seek: (seconds: number) => {
      if (engineMode === "gapless") engineRef.current?.seek(seconds);
    },
    setVolume: (volume: number) => {
      if (engineMode === "gapless") getEngine().setVolume(volume);
    },
    getProgress: () => engineRef.current?.progressRef.current ?? { currentTime: 0, duration: 0 },
    subscribeProgress: (cb) =>
      engineMode === "gapless" ? getEngine().subscribeProgress(cb) : () => undefined,
  };

  return (
    <AudioPlayerContext.Provider value={{ ...state, transport, playSingle, playSetlist, queueSetlist, stopPlayback, advancePlaylist, skipPreRoll }}>
      {children}
    </AudioPlayerContext.Provider>
  );
};
