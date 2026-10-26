import { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo, type ReactNode } from "react";
import { archiveKeyDate, findArchiveRecording, findRecordingForDate, findTrackInRecordingDetailed } from "@/lib/archiveOrg";
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
import { SYNTHETIC_VERSION_DEFAULTS } from "@/lib/syntheticVersion";
import {
  fetchKnownGoodTape,
  recordTapeOk,
  reportPlaybackIssue,
  PLAYS_OK_AFTER_SECONDS,
  type KnownGoodTape,
  type PlaybackFailure,
} from "@/lib/playbackIssues";

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

interface AudioPlayerState {
  playingSlot: PlayableSlot | null;
  playlistMode: boolean;
  playlistIndex: number;
  playlistSlots: PlayableSlot[];
  activeSetlistId: string | null;
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
  /**
   * The song Play All is currently hunting for, before any slot is playing.
   * `playSetlist` clears `playingSlot` and leaves it null until the first
   * track resolves, so `isLoading` is false for that whole multi-second wait —
   * which is exactly the wait CrateDigging exists to explain.
   */
  cueingTitle: string | null;
  /** True when the browser refused autoplay — show the "tap to start" state. */
  autoplayBlocked: boolean;
  /**
   * Set when playback cannot continue on its own and the bar should say so.
   * Until this existed, every failure on the gapless path was either a toast
   * that had already faded or a spinner that never stopped — all of the
   * recovery UI lived in AudioPlayer.tsx, which never mounts under this
   * engine. Human copy: it goes straight on screen.
   */
  error: string | null;
  /** Re-resolve and re-anchor the current slot after an error. */
  retry: () => void;
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
  /**
   * Open the audio pipeline from inside a user gesture, before there is
   * anything to play. Call this in the tap that KICKS OFF a flow that ends in
   * playback (e.g. "build me a show") — by the time the setlist comes back the
   * gesture's activation window has long closed, and without this the browser
   * refuses the autoplay. Safe to call repeatedly; a no-op on native/legacy.
   */
  unlockAudio: () => void;
  /**
   * The last tap that would not play for a reason a fix can address, with
   * what has been done about it: filed (issueId), and a tape we know plays
   * to offer instead (suggestion). PlaybackOopsCard renders it.
   */
  playbackOops: PlaybackOops | null;
  dismissPlaybackOops: () => void;
  /**
   * For pages that look a night up themselves before handing the player a
   * slot (the version picker, the Songbook pages): their "no tape of this
   * night" goes through the same apology, report and suggestion.
   *
   * `from` is the path the tap was made on. Pass it whenever an await sits
   * between the tap and this call: if the fan has left that page by the time
   * the answer comes back, the card is not shown on the page they went to.
   */
  reportPlaybackFailure: (failure: PlaybackFailure, opts?: { from?: string }) => void;
}

/**
 * `issueId` and `suggestion` arrive after the card does: `undefined` means
 * still asking, `null` means asked and got nothing. The card says "it's been
 * noted" only once issueId is a string — a report that failed to file must
 * not be described as filed.
 */
export interface PlaybackOops extends PlaybackFailure {
  key: number;
  issueId: string | null | undefined;
  suggestion: KnownGoodTape | null | undefined;
}

const failureFromSlot = (kind: PlaybackFailure["kind"], slot: PlayableSlot): PlaybackFailure => ({
  kind,
  songId: slot.song.id,
  songTitle: slot.song.title,
  showDate: slot.version?.show_date || null,
  archiveUrl: slot.version?.archive_org_url ?? null,
  trackUrl: slot.directTrackUrl ?? null,
  slotId: slot.id,
});

/** navigator.onLine is only trustworthy when it says false. */
const looksOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;

/** The page the fan is on. Only the path counts, as for PlaybackOopsCard's own dismissal. */
const currentPath = () => (typeof window === "undefined" ? "" : window.location.pathname);

const noopTransport: PlayerTransport = {
  engine: "legacy",
  isPlaying: false,
  isLoading: false,
  cueingTitle: null,
  autoplayBlocked: false,
  error: null,
  retry: () => undefined,
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
  transport: noopTransport,
  playSingle: () => undefined,
  playSetlist: async () => undefined,
  queueSetlist: async () => undefined,
  stopPlayback: () => undefined,
  advancePlaylist: async () => undefined,
  unlockAudio: () => undefined,
  playbackOops: null,
  dismissPlaybackOops: () => undefined,
  reportPlaybackFailure: () => undefined,
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
  });

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // Monotonic token for playSetlist calls — protects against race conditions
  // when the user taps "Play" on Setlist B while Setlist A is still resolving
  // its first playable track via Archive.org. Only the LATEST call commits.
  const playSetlistSeqRef = useRef(0);
  /**
   * Same job as playSetlistSeqRef, for single taps. NOT stateRef: that is
   * synced in an effect, so inside the render flush that set a new playingSlot
   * it still holds the previous one — the hazard the comment on
   * setPlaybackError already records. A counter captured at entry is exact.
   */
  const playSingleSeqRef = useRef(0);
  /** See PlayerTransport.cueingTitle. */
  const [cueingTitle, setCueingTitle] = useState<string | null>(null);

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
  /**
   * Bumped by every fresh tap, so the anchor effect runs even when the tap
   * changes nothing it can see. That effect keys on the slot's id and track
   * url, and a second tap on the same dead row changes neither: the engine
   * was never asked again, the card and the bar's error cleared, nothing was
   * filed, and the bar sat on Pause at 0:00 / 0:00 (2026-10-26 gate, run 5).
   * Only playSingle bumps it, in the same batch as the slot it sets, so a
   * late resolve from an abandoned tap can never move it.
   */
  const [anchorTick, setAnchorTick] = useState(0);
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
  /** Tracks that failed in a row. Reset only by real playback (see the
   *  progress subscriber) or an explicit retry — never by merely moving to the
   *  next slot, or a dead source could never reach the cap. */
  const consecutiveErrorsRef = useRef(0);
  /** advancePlaylist is defined below playSingle; reach it through a ref. */
  const advancePlaylistRef = useRef<(dir: number) => Promise<void>>(async () => {});
  /** Set by transport.next/previous/gotoTrack so engine advances they cause
   *  aren't counted as gapless segues in instrumentation. */
  const userJumpRef = useRef(false);
  const [transportState, setTransportState] = useState<{
    isPlaying: boolean;
    autoplayBlocked: boolean;
    /**
     * Scoped to the slot it belongs to. An unscoped error had to be cleared by
     * an effect watching playingSlot.id, and that effect could run in the same
     * flush as the setState that raised the error — silently wiping it. Tying
     * it to a slot means a stale error simply stops being exposed.
     */
    error: { slotId: string | null; message: string } | null;
  }>({
    isPlaying: false,
    autoplayBlocked: false,
    error: null,
  });

  /** How long a slot may sit unresolved before we stop pretending it is loading. */
  const RESOLVE_TIMEOUT_MS = 25_000;
  /** How long playback may report the same position before we call it stalled. */
  const STALL_TIMEOUT_MS = 25_000;
  const STALL_MESSAGE = "The tape stopped feeding. Check your connection.";

  /**
   * @param forSlotId pass explicitly whenever the caller knows which slot the
   * error belongs to. stateRef is synced in an effect, so inside the same
   * render flush that set a new playingSlot it still holds the previous one —
   * an error scoped from it would be filed against the wrong slot and never
   * shown.
   */
  const setPlaybackError = useCallback((message: string, forSlotId?: string | null) => {
    setTransportState((prev) => {
      const slotId = forSlotId !== undefined ? forSlotId : stateRef.current.playingSlot?.id ?? null;
      if (prev.error?.message === message && prev.error?.slotId === slotId) return prev;
      return { ...prev, error: { slotId, message } };
    });
  }, []);
  const clearPlaybackError = useCallback(() => {
    setTransportState((prev) => (prev.error === null ? prev : { ...prev, error: null }));
  }, []);

  // ── "Oops — that one won't play" ────────────────────────────────────
  const [playbackOops, setPlaybackOops] = useState<PlaybackOops | null>(null);
  const oopsKeyRef = useRef(0);
  const dismissPlaybackOops = useCallback(() => setPlaybackOops(null), []);
  /**
   * File a failure a fix can address and, unless `show` is false, put the
   * apology card up while the report and a known-good suggestion come back.
   *
   * `show: false` is for a slot the queue skipped past on its own: the fan saw
   * "Skipping…", not a dead tap. The catalog problem is still real, so it is
   * still filed, but nobody is promised a notice they were never offered.
   *
   * `from` is the page the tap was made on, for an answer that comes back
   * after an await. A fan who has left that page never sees the card: it
   * used to land on whatever page they had gone to, after the card's own
   * route-change dismissal had already run. So it is filed the quiet way too.
   */
  const raisePlaybackOops = useCallback((
    failure: PlaybackFailure,
    opts: { show?: boolean; from?: string } = {},
  ) => {
    const leftThePage = opts.from !== undefined && opts.from !== currentPath();
    if (leftThePage) {
      audioDebug.log("context", "oops for a page the fan has left — filed, not shown",
        { song: failure.songTitle, from: opts.from, now: currentPath() }, "warn");
    }
    if (opts.show === false || leftThePage) {
      void reportPlaybackIssue(failure, false);
      return;
    }
    const key = ++oopsKeyRef.current;
    setPlaybackOops({ ...failure, key, issueId: undefined, suggestion: undefined });
    // Keyed, so a slow answer about an earlier failure cannot land on a later card.
    const settle = (patch: Partial<PlaybackOops>) =>
      setPlaybackOops((prev) => (prev && prev.key === key ? { ...prev, ...patch } : prev));
    void reportPlaybackIssue(failure, true).then((issueId) => settle({ issueId }));
    void fetchKnownGoodTape(failure).then((suggestion) => settle({ suggestion }));
  }, []);
  /** Track urls already recorded as playing, so a long track is counted once. */
  const recordedOkRef = useRef(new Set<string>());
  /**
   * The slot and track the engine last reported broken. `gapless` says it
   * twice for one dead track — the <audio> element's error event, then the
   * play() promise rejecting with it, in the same task — and each used to
   * file a report, re-raise the card and advance the queue. Cleared by a fresh
   * tap and by moving to another slot, so coming back to the track and having
   * it fail again is a new failure, not an echo.
   */
  const lastEngineErrorRef = useRef<string | null>(null);

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
        // Audio is actually coming out: the run of failures is over.
        if (p.currentTime > 0 && p.duration > 0) consecutiveErrorsRef.current = 0;
        // Twenty seconds of real audio is what makes a tape one "we know
        // plays" — the only kind the oops card may offer. Keyed on the slot
        // the engine is on, so a gapless handoff is credited to the right one.
        if (p.currentTime >= PLAYS_OK_AFTER_SECONDS) {
          const slot = stateRef.current.playingSlot;
          const url = slot?.directTrackUrl;
          if (slot && url && slot.id === engineSlotIdRef.current && !recordedOkRef.current.has(url)) {
            recordedOkRef.current.add(url);
            recordTapeOk(slot);
          }
        }
        if (p.duration > 0) setPlayEventTrackDuration(p.duration * 1000);
      });
      engineRef.current = engine;
    }
    return engineRef.current;
  }, []);

  // Taper-style short date for the lock screen: "1977-05-08" → "5/8/77".
  // String surgery on purpose — new Date("YYYY-MM-DD") parses as UTC and
  // shifts a day in Pacific time.
  const fmtShowDate = (raw?: string | null): string | null => {
    const m = raw?.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return raw ?? null;
    return `${Number(m[2])}/${Number(m[3])}/${m[1].slice(2)}`;
  };

  const toEngineTrack = (slot: PlayableSlot): EngineTrack => ({
    slotId: slot.id,
    url: slot.directTrackUrl!,
    metadata: {
      title: slot.song.title,
      // The iOS lock screen shows only title + artist (album appears just in
      // Control Center's expanded view), so the show's date + venue and the
      // brand all ride the artist line — date right after the band so it
      // survives truncation when a long venue name overflows.
      artist: [
        "Grateful Dead",
        fmtShowDate(slot.version?.show_date),
        slot.version?.venue,
        "Dead-Set.Org",
      ]
        .filter(Boolean)
        .join(" · "),
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
    // A busy flag set by one entry point has to be cleared by EVERY path that
    // supersedes it, not just the one that re-sets it. "The newer run owns it"
    // was only true when the newer run was another playSetlist.
    setCueingTitle(null);
    resolveGenRef.current++; // cancel background resolve-and-append
    engineSlotIdRef.current = null;
    audioDebug.setSlot(null, null, null, null);
    audioDebug.setPlaybackState("stopped");
    void finalizePlayEvent("skipped");
    setState({ playingSlot: null, playlistMode: false, playlistIndex: 0, playlistSlots: [], activeSetlistId: null });
  }, []);

  /**
   * A slot the fan pressed play on that would not resolve, with nothing after
   * it to skip to. One definition for the two ways to get here, a tap and a
   * queue that runs out on that slot, because the second used to play the
   * song before it, say "End of setlist", and file nothing.
   *
   * With a recording, the bar stays on that song with the reason and a
   * retry, and the engine is stopped: whatever it still holds is a different
   * song from the one the bar now names. With no recording the bar cannot
   * draw at all (GlobalAudioPlayer needs one), so the player stops, as it
   * always has for a tap on a night that would not resolve.
   *
   * Either way only an answer about the music is filed with the card.
   * "Couldn't reach" is the network, and asking again is the fix for it.
   */
  const failUnresolvedSlot = useCallback((slot: PlayableSlot, outcome: ResolveOutcome, from: string) => {
    if (slot.version?.archive_org_url) {
      engineRef.current?.clear();
      if (outcome.unreachable) {
        setPlaybackError("Couldn't reach the Archive just now. Tap play to try again.", slot.id);
      } else {
        setPlaybackError("That song isn't on this tape.", slot.id);
        raisePlaybackOops(failureFromSlot("not_on_tape", slot), { from });
      }
      return;
    }
    stopPlayback();
    if (outcome.unreachable) {
      toast.error("Couldn't reach the Archive just now — tap play to try again.");
    } else if (outcome.uncertain) {
      // The generic search cannot tell absent from failed (see resolveSlot).
      toast.error("No tape of this one circulates yet");
    } else {
      // The card says it in the house voice, files it, and offers a tape
      // we know plays. A toast as well would be two messages for one tap.
      raisePlaybackOops(failureFromSlot("no_tape", slot), { from });
    }
  }, [setPlaybackError, raisePlaybackOops, stopPlayback]);

  const playSingle = useCallback(async (
    slot: PlayableSlot,
    playlistContext?: { slots: PlayableSlot[]; setlistId?: string | null },
  ) => {
    audioDebug.log("context", "playSingle", { id: slot.id, song: slot.song.title, hasUrl: !!slot.version?.archive_org_url, hasDirect: !!slot.directTrackUrl, withContext: !!playlistContext });
    const from = currentPath(); // the page this tap was made on
    playSetlistSeqRef.current++; // invalidate any in-flight playSetlist
    // See stopPlayback: without this the digging card stayed up over a tape
    // that was already playing — measured at 31s in a real browser, until an
    // unrelated stall error happened to hide it.
    setCueingTitle(null);
    engineSlotIdRef.current = null; // force the engine to (re)anchor on this slot
    // We're inside the user's tap — unlock the AudioContext while the gesture
    // window is open, before any async resolution starts.
    if (engineMode === "gapless") getEngine().unlock();
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

    const seq = ++playSingleSeqRef.current;
    // A fresh tap is a fresh attempt: drop any error left over from the last
    // one. Without this the banner from a failed tap survived the retry it had
    // just invited ("Tap play to try again"), sat over a tape that was loading
    // fine, AND suppressed CrateDigging — which hides whenever an error is set.
    clearPlaybackError();
    // Same for the apology card: this tap is the answer to it (often the very
    // tape it offered), so it must not sit over the music that follows.
    setPlaybackOops(null);
    // A retry keeps the slot id, so the slot-change reset below cannot see it.
    lastEngineErrorRef.current = null;
    setState({ playingSlot: slot, playlistMode, playlistIndex, playlistSlots, activeSetlistId });
    setAnchorTick((n) => n + 1); // see anchorTick: the same slot again must still reach the engine

    // Resolve direct track URL in background if missing
    if (!slot.directTrackUrl && slot.version?.archive_org_url) {
      const { slot: resolved, unreachable: cantReach } = await resolveSlot(slot);
      // resolveSlot returns the slot UNCHANGED when it cannot find the song
      // inside that recording. Under the legacy player that was survivable —
      // AudioPlayer fell back to the whole recording. On the gapless path
      // nothing rescues it, so isLoading (defined as !directTrackUrl) stayed
      // true and the bar span forever. Treat it as the determinate failure
      // it is, straight away rather than after the watchdog below.
      // resolveSlot now returns NULL rather than a trackless slot, because a
      // slot with no track is not survivable on either engine: gapless gets
      // `url: undefined` and spins, and the legacy player streams the whole
      // recording from the top, playing a different song under this one's
      // name. Both forms are handled here so the behaviour people see — the
      // error banner, or a skip inside a queue — is unchanged.
      if (!resolved || (!resolved.directTrackUrl && engineMode === "gapless")) {
        audioDebug.log("context", "unplayable slot — no direct track", { song: slot.song.title }, "error");
        // Two different things, said differently. "Not on this tape" is an
        // answer about the music; "couldn't reach" is an admission about the
        // network, and the tape is probably fine — which is exactly the case
        // people reported, where the song started playing moments later.
        if (seq !== playSingleSeqRef.current) {
          audioDebug.log("context", "stale resolve failure ignored — a newer tap owns the player",
            { song: slot.song.title, seq, current: playSingleSeqRef.current }, "warn");
          return;
        }
        // Skipping needs somewhere to skip TO. On the last slot it used to
        // say "Skipping…" and then "End of setlist", with no apology for the
        // song the fan had just tapped — so the last one fails like a single
        // tap instead.
        if (playlistMode && playlistIndex < playlistSlots.length - 1) {
          // Both of these SKIP, so neither may promise to keep looking — the
          // old "Still looking…" was followed immediately by advancePlaylist
          // and, with the Archive down, by "End of setlist".
          toast.info(
            cantReach
              ? `Skipping ${slot.song.title} — couldn't reach the Archive`
              : `Skipping ${slot.song.title} — not on this tape`,
          );
          if (!cantReach) raisePlaybackOops(failureFromSlot("not_on_tape", slot), { show: false });
          void advancePlaylistRef.current(1);
        } else {
          // Only the answer about the music is filed. "Couldn't reach" is the
          // network, and the retry the bar already offers is the fix for it.
          failUnresolvedSlot(slot, { slot: null, unreachable: cantReach }, from);
        }
        return;
      }
      if (resolved) {
        audioDebug.setDirectTrackUrl(resolved.directTrackUrl ?? null);
        audioDebug.log("context", "resolved direct track", { url: resolved.directTrackUrl });
        // `seq` as well as the id: the id alone is not identity enough when
        // two controls can legitimately build the same slot, and a late
        // resolve from an abandoned tap then lands on the current one. The
        // failure paths already checked seq; the success paths did not.
        setState(prev => seq === playSingleSeqRef.current && prev.playingSlot?.id === slot.id
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
      const { slot: resolved, unreachable: cantReach, uncertain } = await resolveSlot(slot);
      if (resolved?.version?.archive_org_url) {
        audioDebug.setSlot(resolved.id, resolved.song.title, resolved.version.archive_org_url, resolved.directTrackUrl ?? null);
        // `seq` as well as the id: the id alone is not identity enough when
        // two controls can legitimately build the same slot, and a late
        // resolve from an abandoned tap then lands on the current one. The
        // failure paths already checked seq; the success paths did not.
        setState(prev => seq === playSingleSeqRef.current && prev.playingSlot?.id === slot.id
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
        // Tap A can fail AFTER tap B has started. Without this guard A's
        // failure path cleared B's playingSlot and toasted over it, so the
        // reader's second choice silently died for the first one's reasons.
        if (seq !== playSingleSeqRef.current) {
          audioDebug.log("context", "stale resolve failure ignored — a newer tap owns the player",
            { song: slot.song.title, seq, current: playSingleSeqRef.current }, "warn");
          return;
        }
        audioDebug.log("context", "no audio found for song", { song: slot.song.title, unreachable: cantReach }, "error");
        failUnresolvedSlot(slot, { slot: null, unreachable: cantReach, uncertain }, from);
      }
    }
  }, [engineMode, getEngine, clearPlaybackError, raisePlaybackOops, failUnresolvedSlot]);

  /** Resolve a slot: ensure it has an archive URL and directTrackUrl */
  /**
   * Why a resolve failed, not just that it did.
   *
   * resolveSlot used to return `null` for three different things: "the song is
   * not on this tape" (an answer about the music), "the Archive did not
   * respond" (an admission about the network), and "the search came back
   * empty". The caller reported all three as "That song isn't on this tape."
   * — which is how a reader got told a tape was missing seconds before it
   * started playing. The named-night branch even logs "treating as unresolved,
   * not as 'no tape'" and then threw that distinction away in its return type.
   */
  interface ResolveOutcome {
    slot: PlayableSlot | null;
    /** A lookup FAILED rather than answering. Transient: worth asking again. */
    unreachable: boolean;
    /**
     * Absent, but from the one branch that cannot tell absent from a failed
     * request (the generic search swallows its errors). Good enough for the
     * old toast; not good enough to FILE a report and promise a fix notice,
     * because a miss there is more often the network than the catalog.
     */
    uncertain?: boolean;
  }
  const ok = (s: PlayableSlot): ResolveOutcome => ({ slot: s, unreachable: false });
  const absent = (): ResolveOutcome => ({ slot: null, unreachable: false });
  const unreachable = (): ResolveOutcome => ({ slot: null, unreachable: true });

  const resolveSlot = async (slot: PlayableSlot): Promise<ResolveOutcome> => {
    if (slot.version?.archive_org_url && slot.directTrackUrl) return ok(slot);

    // Prefer a server-precomputed direct track URL over a live archive.org
    // round-trip. Misses (private/uncrawled slots, synthetic ids) fall through
    // to the live resolution paths below — same behavior as before this change.
    const precomputed = await lookupPrecomputedPlayability(slot.id);
    if (precomputed) {
      audioDebug.log("resolve", "precomputed playability hit", { slot: slot.id, song: slot.song.title });
      const version: NotableVersion = slot.version
        ? { ...slot.version, archive_org_url: slot.version.archive_org_url ?? precomputed.detailsUrl }
        : {
            ...SYNTHETIC_VERSION_DEFAULTS,
            id: "", song_id: slot.song.id, show_date: "",
            archive_org_url: precomputed.detailsUrl, venue: null,
            city: null, era_id: null, rating: null, description: null,
          };
      return ok({ ...slot, version, directTrackUrl: precomputed.directTrackUrl });
    }

    if (slot.version?.archive_org_url && !slot.directTrackUrl) {
      // Has a specific show URL — find the track WITHIN that recording
      audioDebug.log("resolve", "findTrackInRecording", { url: slot.version.archive_org_url, song: slot.song.title });
      // Detailed, not the plain one: a 5xx or a dead connection makes
      // fetchMetadataWithFallback return a FAILED result rather than throwing,
      // so a `catch` here could never see it. That is why the first version of
      // this fix was cosmetic — the catch was dead code for every real network
      // failure, and the tests mocked a rejection production cannot produce.
      let directUrl: string | null = null;
      let trackUnreachable = false;
      try {
        const found = await findTrackInRecordingDetailed(slot.version.archive_org_url, slot.song.title);
        directUrl = found.url;
        trackUnreachable = found.unreachable;
      } catch (e) {
        audioDebug.log("resolve", "track lookup threw — unreachable, not absent",
          { url: slot.version.archive_org_url, song: slot.song.title, error: String(e) }, "warn");
        return unreachable();
      }
      // NO early return here, deliberately. Failing fast on an unreadable
      // stored tape forecloses the heal below — and the gate proved that is a
      // REGRESSION, not a trade: a stored identifier that persistently 503s
      // beside a healthy night search used to heal onto another tape of that
      // night, and with the early return it looped "tap play to try again"
      // forever instead. `trackUnreachable` is still carried, and the verdict
      // at the end of this branch returns unreachable() when the heal also
      // fails, so nothing is lost but the shortcut.
      //
      // The cost on a dead network is one extra search bounded by its own 12s
      // cap — but NOT, as this comment claimed until the gate measured it,
      // "under the 25s watchdog". The stored-tape leg is 12s + a 0.6s retry
      // wait + 12s = ~24.7s before the heal is even reached, so the verdict
      // lands at ~37s with "Still looking for that tape" showing from 25.6s.
      // (A `.flacNN` identifier adds a second variant and can push it further.)
      // That is 12s longer than failing fast, and it buys the accurate message
      // instead of the watchdog's — worth it, but it is a real wait, so do not
      // add another leg here without measuring with every request hung.
      if (directUrl) {
        return ok({ ...slot, directTrackUrl: directUrl });
      }

      // The stored recording does not contain this song. That happens because
      // a stored archive URL is not evidence of anything: ai-deadhead took
      // Charlie's own `archiveUrl` string ahead of the catalog's verified one,
      // so guides saved before that was fixed point at recordings chosen by a
      // model rather than found on the Archive. A Ripple guide saved on
      // 2026-10-04 named the right nights and pointed at tapes without Ripple
      // on them.
      //
      // We know which NIGHT this slot is describing, so go find a recording of
      // that night that actually carries the song, rather than giving up on a
      // URL we never had reason to trust. This heals already-saved guides
      // without a migration.
      const night = archiveKeyDate(slot.version.show_date);
      let healUnreachable = false;
      if (night) {
        audioDebug.log("resolve", "stored tape lacks the song — re-resolving the night", { song: slot.song.title, date: night }, "warn");
        try {
          const dated = await findRecordingForDate(slot.song.title, night);
          if (dated?.directTrackUrl) {
            return ok({
              ...slot,
              version: { ...slot.version, archive_org_url: dated.url },
              directTrackUrl: dated.directTrackUrl,
            });
          }
        } catch (e) {
          // findRecordingForDate THROWS on a failed request, deliberately, so
          // this is "could not ask", never "the song is not here".
          healUnreachable = true;
          audioDebug.log("resolve", "night re-resolve failed", { song: slot.song.title, error: String(e) }, "warn");
        }
      }

      // No tape we can read has this song on it. Say so; never hand back a
      // slot with no track, because the legacy player streams the whole
      // recording from the top and plays a DIFFERENT SONG under this one's
      // name. That is the failure this whole surface exists to prevent.
      audioDebug.log("resolve", "song is not on any readable tape of this night",
        { song: slot.song.title, unreachable: healUnreachable }, healUnreachable ? "warn" : "error");
      console.warn(`[QA] Could not resolve direct track for "${slot.song.title}" in ${slot.version.archive_org_url}`);
      return healUnreachable || trackUnreachable ? unreachable() : absent();
    }

    // The slot names its night but carries no tape: resolve THAT night.
    // Listening-guide slots arrive this way — the Version Explorer's picks come
    // with a date and often no URL — and so do catalog versions whose row has
    // no archive_org_url. Before this branch existed both fell straight through
    // to the generic by-title search below, which answers with the song's
    // best-drawing tape from some other year entirely.
    //
    // A named night that cannot be found deliberately does NOT fall through to
    // that search. The card above it says why THIS night matters; playing a
    // different one puts the prose and the music on different shows, which is
    // the exact bug src/lib/listeningGuide.ts was written to end. Better to say
    // we came up empty than to quietly swap the tape.
    const namedNight = slot.version?.show_date;
    let nightUnreachable = false;
    if (namedNight) {
      audioDebug.log("resolve", "findRecordingForDate", { song: slot.song.title, date: namedNight });
      // findRecordingForDate THROWS on a failed request, deliberately, to keep
      // "could not ask the Archive" distinct from "no tape of this night
      // circulates" — and it caches neither. Its sibling findArchiveRecording
      // does the opposite, swallowing the error and caching null, so the two
      // cannot be called the same way. An uncaught rejection here escapes
      // through playSetlist/playSingle/advancePlaylist: nothing plays, no
      // toast fires, and a single tap leaves playingSlot set, spinning.
      try {
        const dated = await findRecordingForDate(slot.song.title, namedNight);
        // A night with no readable track is not a playable slot — see above.
        if (dated?.directTrackUrl) {
          return ok({
            ...slot,
            version: {
              ...(slot.version ?? SYNTHETIC_VERSION_DEFAULTS),
              id: slot.version?.id ?? "",
              song_id: slot.song.id,
              show_date: namedNight,
              archive_org_url: dated.url,
              venue: slot.version?.venue ?? dated.venue,
            },
            directTrackUrl: dated.directTrackUrl || null,
          });
        }
        audioDebug.log("resolve", "no tape found for named night", { song: slot.song.title, date: namedNight }, "warn");
      } catch (e) {
        nightUnreachable = true;
        audioDebug.log(
          "resolve",
          "named-night lookup failed — treating as unresolved, not as 'no tape'",
          { song: slot.song.title, date: namedNight, error: String(e) },
          "warn",
        );
      }
      // Nothing cached either way, so the next attempt asks again. The two
      // reasons are NOT the same and the caller is told which it was.
      return nightUnreachable ? unreachable() : absent();
    }

    // No archive URL and no night — a generic search is all that is left.
    audioDebug.log("resolve", "findArchiveRecording (generic search)", { song: slot.song.title });
    const result = await findArchiveRecording(slot.song.title);
    if (result?.directTrackUrl) {
      return ok({
        ...slot,
        version: {
          ...SYNTHETIC_VERSION_DEFAULTS,
          id: "", song_id: slot.song.id, show_date: result.date || "",
          archive_org_url: result.url, venue: result.venue,
          city: null, era_id: null, rating: null, description: null,
        },
        directTrackUrl: result.directTrackUrl || null,
      });
    }
    // findArchiveRecording swallows its own errors and caches null, so this
    // branch genuinely cannot tell the two apart — reported as absent, which
    // is the conservative read for a toast, and flagged so nothing is filed.
    return { slot: null, unreachable: false, uncertain: true };
  };

  const playSetlist = useCallback(async (slots: PlayableSlot[], setlistId?: string) => {
    if (slots.length === 0) {
      // Log before returning. This used to be a bare `return`, so pressing Play
      // All on a setlist whose slots had not loaded produced a debug snapshot
      // with playbackState "idle" and events: [] — indistinguishable from never
      // having pressed anything. A reporter cannot tell those apart, and on
      // 2026-10-05 one copied exactly that snapshot and it cost a round trip to
      // interpret. Every entry point into playback now leaves a trace.
      audioDebug.log("context", "playSetlist — nothing to play", { setlistId, count: 0 }, "warn");
      return;
    }
    const seq = ++playSetlistSeqRef.current;
    const from = currentPath(); // the page Play All was pressed on
    // Supersession runs BOTH ways. Without this, a slow single tap that failed
    // after Play All had started cleared its playingSlot and toasted over the
    // tape that was playing.
    playSingleSeqRef.current++;
    clearPlaybackError(); // same reason as playSingle: a new run is a new attempt
    setPlaybackOops(null);
    lastEngineErrorRef.current = null;
    // Play All clears playingSlot and leaves it null until the first track
    // resolves, so nothing else marks this wait as busy. Named so the card can
    // say which song it is hunting for.
    setCueingTitle(slots[0]?.song.title ?? null);
    engineSlotIdRef.current = null; // force the engine to (re)anchor on the new setlist
    // Inside the user's tap — unlock audio before async track resolution starts.
    if (engineMode === "gapless") getEngine().unlock();
    audioDebug.log("context", "playSetlist", { count: slots.length, setlistId, seq });
    audioDebug.setPlaybackState("starting");

    // CRITICAL: stop any current playback IMMEDIATELY so two streams can never overlap
    // while we asynchronously resolve the first playable track in the new setlist.
    if (stateRef.current.playingSlot) {
      void finalizePlayEvent("skipped");
      audioDebug.setSlot(null, null, null, null);
      setState({ playingSlot: null, playlistMode: false, playlistIndex: 0, playlistSlots: [], activeSetlistId: null });
    }

    const sorted = [...slots].sort((a, b) => a.setNumber - b.setNumber || a.position - b.position);

    let startIndex = -1;
    let startSlot: PlayableSlot | null = null;

    // Did we ever actually get to ask? A run of 5xx must not be reported as
    // "no tape circulates" — that is an answer about the music, and nobody
    // earned it. This is the same distinction playSingle makes, which the
    // first version of the fix threaded through the single-tap path only.
    let anyUnreachable = false;
    let anyUncertain = false;
    for (let i = 0; i < sorted.length; i++) {
      const { slot: resolved, unreachable: cantReach, uncertain } = await resolveSlot(sorted[i]);
      if (cantReach) anyUnreachable = true;
      if (uncertain) anyUncertain = true;
      // Bail out if a newer playSetlist call has superseded this one.
      if (seq !== playSetlistSeqRef.current) {
        audioDebug.log("context", "playSetlist superseded, aborting", { seq, current: playSetlistSeqRef.current, setlistId }, "warn");
        return; // the newer run owns cueingTitle now — do not clear it
      }
      if (resolved?.version?.archive_org_url) {
        startIndex = i;
        startSlot = resolved;
        sorted[i] = resolved; // Update in place for playlist
        setCueingTitle(null); // playingSlot takes over from here
        break;
      }
    }

    if (!startSlot || startIndex < 0) {
      audioDebug.log("context", "no audio found in setlist",
        { setlistId, unreachable: anyUnreachable }, anyUnreachable ? "warn" : "error");
      // Reaches a setlist, a Songbook issue, a listening guide and the era
      // ladder alike, so it cannot say "songs in the setlist". Taper voice: a
      // tape either circulates or it does not — but only say that when we got
      // an answer.
      setCueingTitle(null);
      if (anyUnreachable) {
        toast.error("Couldn't reach the Archive just now — try again");
      } else if (anyUncertain) {
        toast.error("No tape circulating for any of these yet");
      } else {
        raisePlaybackOops({
          kind: "none_in_setlist",
          songId: sorted[0]?.song.id ?? null,
          songTitle: sorted[0]?.song.title ?? "Setlist",
          showDate: null,
          setlistId: setlistId ?? null,
        }, { from });
      }
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
    });
  }, [engineMode, getEngine, clearPlaybackError, raisePlaybackOops]);

  const advancePlaylist: (dir: number) => Promise<void> = useCallback(async (dir: number) => {
    const { playlistIndex, playlistSlots } = stateRef.current;
    engineSlotIdRef.current = null; // user-driven jump — the sync effect re-anchors the queue
    // playSingle, playSetlist and stopPlayback all move this on. A skip that
    // was still resolving when the fan tapped something else used to land
    // anyway, taking the player back into the old queue.
    const seq = playSetlistSeqRef.current;
    const from = currentPath();
    audioDebug.log("context", "advancePlaylist", { dir, fromIndex: playlistIndex });

    let unresolved: { slot: PlayableSlot; index: number; outcome: ResolveOutcome } | null = null;
    for (let i = playlistIndex + dir; i >= 0 && i < playlistSlots.length; i += dir) {
      const outcome = await resolveSlot(playlistSlots[i]);
      if (seq !== playSetlistSeqRef.current) {
        audioDebug.log("context", "advancePlaylist superseded, aborting", { seq, current: playSetlistSeqRef.current }, "warn");
        return;
      }
      const resolved = outcome.slot;
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
      unresolved = { slot: playlistSlots[i], index: i, outcome };
      audioDebug.log("context", "skipping unresolved slot in playlist", { index: i, song: playlistSlots[i].song.title }, "warn");
    }

    // The set ran out on a night that would not resolve. The fan pressed play
    // on that night (it was in the run they started), so it fails exactly as
    // a tap on it would: see failUnresolvedSlot. It used to play the song
    // before it, say "End of setlist", and file nothing (2026-10-26 gate,
    // run 5). Backwards, running out is only the start of the set.
    if (dir > 0 && unresolved) {
      const { slot, index, outcome } = unresolved;
      audioDebug.log("context", "set ends on an unresolved slot", { index, song: slot.song.title, unreachable: outcome.unreachable }, "error");
      audioDebug.setSlot(slot.id, slot.song.title, slot.version?.archive_org_url ?? null, null);
      setState((prev) => ({ ...prev, playlistIndex: index, playingSlot: slot }));
      failUnresolvedSlot(slot, outcome, from);
      return;
    }

    audioDebug.log("context", "end of setlist", {});
    stopPlayback();
    toast.info("End of setlist");
  }, [stopPlayback, engineMode, failUnresolvedSlot]);

  // ── Engine bridge: engine → state ───────────────────────────────────
  // Fresh closures every render; the long-lived engine delegates through the ref.
  engineCbRef.current = {
    onTrackStarted: (slotId) => {
      if (engineMode !== "gapless") return;
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
      const broken = stateRef.current.playingSlot;
      const errorKey = broken ? `${broken.id}|${broken.directTrackUrl ?? ""}` : null;
      if (errorKey && errorKey === lastEngineErrorRef.current) {
        // The same dead track, said twice. Everything below has already
        // happened once for it: a second pass filed a second report, raised
        // the card again, advanced the queue twice and counted one bad track
        // as two toward the cap of three.
        audioDebug.log("context", "repeat engine error for the same track ignored", { slot: broken?.id }, "warn");
        return;
      }
      lastEngineErrorRef.current = errorKey;
      captureAudioEvent("audio_error", {
        engine: "gapless",
        message: String(error),
        track_url: stateRef.current.playingSlot?.directTrackUrl ?? null,
        playback_method: lastProgressRef.current.playbackType ?? "HTML5",
      });
      void finalizePlayEvent("error");
      consecutiveErrorsRef.current += 1;
      const st = stateRef.current;
      // Offline, the tape is not the problem and there is nothing to file.
      const failed = st.playingSlot && !looksOffline() ? failureFromSlot("wont_play", st.playingSlot) : null;
      // The same test advancePlaylist makes. A dead LAST track used to be
      // "skipped" into nothing: a quiet report, then "End of setlist" (twice,
      // before the repeat above was caught) and no word that the song the set
      // was heading for never played. With nothing after it, it is the fan's
      // dead tap, and it gets the card and the bar's error like one.
      const somethingAfter = st.playlistIndex < st.playlistSlots.length - 1;
      if (st.playlistMode && somethingAfter && consecutiveErrorsRef.current <= 3) {
        if (failed) raisePlaybackOops(failed, { show: false });
        void advancePlaylist(1); // keep the queue moving past a broken track
      } else {
        // Previously just a toast, which left a dead bar sitting on a track
        // that would never play and no way back other than closing it.
        setPlaybackError("That tape won't play. The source may be offline.");
        if (failed) raisePlaybackOops(failed);
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
        const { slot: r } = await resolveSlot(slot);
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
        prev.isPlaying || prev.autoplayBlocked
          ? { isPlaying: false, autoplayBlocked: false, error: null }
          : prev,
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
  }, [engineMode, state.playingSlot?.id, state.playingSlot?.directTrackUrl, anchorTick, getEngine, resolveAndAppendUpcoming]);

  // Keep the forward ref pointed at the live advancePlaylist.
  useEffect(() => {
    advancePlaylistRef.current = advancePlaylist;
  }, [advancePlaylist]);

  // Another slot is another tape. Both of a dead track's errors arrive in one
  // task, long before the render that moves the queue on, so this never
  // clears the marker between them.
  useEffect(() => {
    lastEngineErrorRef.current = null;
  }, [state.playingSlot?.id]);

  // No reset on slot change. It used to live here, and since every error
  // advances to a new slot it zeroed the count each time: on 2026-09-23 a
  // phone that could not load anything ran all 13 tracks of a setlist in six
  // seconds instead of stopping at three with "That tape won't play".

  // Resolution watchdog. The determinate case is handled inline in playSingle,
  // but none of the archive.org fetches carry an AbortController, so a hung
  // request would otherwise spin the bar indefinitely. This is the net.
  useEffect(() => {
    if (engineMode !== "gapless") return;
    const slot = state.playingSlot;
    if (!slot || slot.directTrackUrl) return;
    const timer = window.setTimeout(() => {
      if (stateRef.current.playingSlot?.id !== slot.id) return;
      if (stateRef.current.playingSlot?.directTrackUrl) return;
      audioDebug.log("context", "resolution timed out", { song: slot.song.title }, "error");
      // A slot that already has its answer is not still being looked for. A
      // failed resolve leaves the slot without a track, which is all this
      // checks, so 25s after "That song isn't on this tape." the bar used to
      // change its mind to "Still looking for that tape."
      setTransportState((prev) =>
        prev.error?.slotId === slot.id
          ? prev
          : { ...prev, error: { slotId: slot.id, message: "Still looking for that tape. Archive.org may be slow right now." } },
      );
    }, RESOLVE_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineMode, state.playingSlot?.id, state.playingSlot?.directTrackUrl]);

  // Stall watchdog — the gapless counterpart to the 25s detector that lives in
  // AudioPlayer.tsx and never runs on this path. Deliberately passive: it
  // surfaces a retry and never pauses or tears down playback, because a false
  // positive that killed a good stream would be worse than a missed stall.
  //
  // The clock it watches only moves while the page is on screen: progress is
  // driven by the library's animation-frame loop, which iOS stops when Safari
  // is backgrounded — while the <audio> keeps playing. So a hidden page proves
  // nothing, and coming back must not count the time away as a stall. Before
  // this, every trip to another app ended in "The tape stopped feeding" over a
  // tape that was still playing (2026-09-23).
  useEffect(() => {
    if (engineMode !== "gapless") return;
    if (!transportState.isPlaying) return;
    let lastTime = lastProgressRef.current.currentTime;
    let lastMovedAt = Date.now();
    const restartClock = () => {
      lastTime = lastProgressRef.current.currentTime;
      lastMovedAt = Date.now();
    };
    const id = window.setInterval(() => {
      if (document.visibilityState === "hidden") {
        restartClock();
        return;
      }
      const p = lastProgressRef.current;
      if (p.currentTime !== lastTime) {
        restartClock();
        // Moving again, so a stall warning already on screen is wrong now.
        setTransportState((prev) =>
          prev.error?.message === STALL_MESSAGE ? { ...prev, error: null } : prev,
        );
        return;
      }
      // Sitting at the very end is an ending, not a stall.
      if (p.duration > 0 && p.currentTime / p.duration >= 0.99) return;
      if (Date.now() - lastMovedAt < STALL_TIMEOUT_MS) return;
      audioDebug.log("context", "playback stalled", { at: p.currentTime }, "warn");
      setPlaybackError(STALL_MESSAGE);
    }, 5_000);
    document.addEventListener("visibilitychange", restartClock);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", restartClock);
    };
  }, [engineMode, transportState.isPlaying, state.playingSlot?.id, setPlaybackError]);

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
          const { slot: r } = await resolveSlot(slot);
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

  /**
   * Gesture-time audio unlock, for flows where the tap and the playback are
   * separated by seconds of async work (Charlie building a show, fetching a
   * night off the Archive). Same call playSetlist makes at the top of its own
   * user gesture — just hoisted to the gesture that starts the wait.
   */
  const unlockAudio = useCallback(() => {
    if (engineMode !== "gapless") return;
    audioDebug.log("context", "unlockAudio (pre-gesture)");
    getEngine().unlock();
  }, [engineMode, getEngine]);

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
    cueingTitle,
    autoplayBlocked: transportState.autoplayBlocked,
    error:
      transportState.error && transportState.error.slotId === (state.playingSlot?.id ?? null)
        ? transportState.error.message
        : null,
    retry: () => {
      const slot = stateRef.current.playingSlot;
      if (!slot) return;
      clearPlaybackError();
      consecutiveErrorsRef.current = 0;
      engineSlotIdRef.current = null; // force the sync effect to re-anchor
      resolveGenRef.current++;
      audioDebug.log("context", "retry requested", { song: slot.song.title });
      // Drop the resolved URL so playSingle runs the full resolution path
      // again rather than re-loading the same dead address.
      void playSingle(
        { ...slot, directTrackUrl: null },
        stateRef.current.playlistMode
          ? {
              slots: stateRef.current.playlistSlots,
              setlistId: stateRef.current.activeSetlistId,
            }
          : undefined,
      );
    },
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
    // Moving on is an answer to the card too, like any fresh tap: it is about
    // the song being left, and it used to sit over the next one.
    next: () => {
      setPlaybackOops(null);
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
      setPlaybackOops(null);
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
    <AudioPlayerContext.Provider
      value={{
        ...state, transport, playSingle, playSetlist, queueSetlist, stopPlayback, advancePlaylist, unlockAudio,
        playbackOops, dismissPlaybackOops, reportPlaybackFailure: raisePlaybackOops,
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  );
};
