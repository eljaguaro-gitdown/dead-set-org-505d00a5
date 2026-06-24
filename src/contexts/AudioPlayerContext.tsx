import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import { findArchiveRecording, findTrackInRecording } from "@/lib/archiveOrg";
import { audioDebug } from "@/lib/audioDebug";
import { startPlayEvent, finalizePlayEvent } from "@/lib/playEventTracker";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

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

interface AudioPlayerContextValue extends AudioPlayerState {
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
}

const defaultAudioPlayerContext: AudioPlayerContextValue = {
  playingSlot: null,
  playlistMode: false,
  playlistIndex: 0,
  playlistSlots: [],
  activeSetlistId: null,
  playSingle: () => undefined,
  playSetlist: async () => undefined,
  queueSetlist: async () => undefined,
  stopPlayback: () => undefined,
  advancePlaylist: async () => undefined,
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

  // Track per-song play events for analytics.
  // Fires whenever the playing song slot changes — start a new event,
  // implicitly finalizing any previous one as "skipped".
  useEffect(() => {
    const slot = state.playingSlot;
    if (!slot) return;
    void startPlayEvent({
      setlistId: state.activeSetlistId,
      slotId: slot.id,
      songId: slot.song.id,
      songTitle: slot.song.title,
      archiveUrl: slot.version?.archive_org_url ?? null,
      showDate: slot.version?.show_date ?? null,
      venue: slot.version?.venue ?? null,
    });
  }, [state.playingSlot?.id, state.activeSetlistId]);

  const stopPlayback = useCallback(() => {
    audioDebug.log("context", "stopPlayback");
    playSetlistSeqRef.current++; // invalidate any in-flight playSetlist
    audioDebug.setSlot(null, null, null, null);
    audioDebug.setPlaybackState("stopped");
    void finalizePlayEvent("skipped");
    setState({ playingSlot: null, playlistMode: false, playlistIndex: 0, playlistSlots: [], activeSetlistId: null });
  }, []);

  const playSingle = useCallback(async (
    slot: PlayableSlot,
    playlistContext?: { slots: PlayableSlot[]; setlistId?: string | null },
  ) => {
    audioDebug.log("context", "playSingle", { id: slot.id, song: slot.song.title, hasUrl: !!slot.version?.archive_org_url, hasDirect: !!slot.directTrackUrl, withContext: !!playlistContext });
    playSetlistSeqRef.current++; // invalidate any in-flight playSetlist
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

    setState({ playingSlot: slot, playlistMode, playlistIndex, playlistSlots, activeSetlistId });

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
        setState({ playingSlot: null, playlistMode: false, playlistIndex: 0, playlistSlots: [], activeSetlistId: null });
      }
    }
  }, []);

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
    });
  }, []);

  const advancePlaylist = useCallback(async (dir: number) => {
    const { playlistIndex, playlistSlots } = stateRef.current;
    audioDebug.log("context", "advancePlaylist", { dir, fromIndex: playlistIndex });

    for (let i = playlistIndex + dir; i >= 0 && i < playlistSlots.length; i += dir) {
      const resolved = await resolveSlot(playlistSlots[i]);
      if (resolved?.version?.archive_org_url) {
        audioDebug.setSlot(resolved.id, resolved.song.title, resolved.version.archive_org_url, resolved.directTrackUrl ?? null);
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
  }, [stopPlayback]);

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

  return (
    <AudioPlayerContext.Provider value={{ ...state, playSingle, playSetlist, queueSetlist, stopPlayback, advancePlaylist }}>
      {children}
    </AudioPlayerContext.Provider>
  );
};
