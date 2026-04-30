import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import { findArchiveRecording, findTrackInRecording } from "@/lib/archiveOrg";
import { audioDebug } from "@/lib/audioDebug";
import { startPlayEvent, finalizePlayEvent } from "@/lib/playEventTracker";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type NotableVersion = Database["public"]["Tables"]["notable_versions"]["Row"];
type Song = Database["public"]["Tables"]["songs"]["Row"];

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
  playSingle: (slot: PlayableSlot) => void;
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
    audioDebug.setSlot(null, null, null, null);
    audioDebug.setPlaybackState("stopped");
    void finalizePlayEvent("skipped");
    setState({ playingSlot: null, playlistMode: false, playlistIndex: 0, playlistSlots: [], activeSetlistId: null });
  }, []);

  const playSingle = useCallback(async (slot: PlayableSlot) => {
    audioDebug.log("context", "playSingle", { id: slot.id, song: slot.song.title, hasUrl: !!slot.version?.archive_org_url, hasDirect: !!slot.directTrackUrl });
    audioDebug.setSlot(slot.id, slot.song.title, slot.version?.archive_org_url ?? null, slot.directTrackUrl ?? null);
    audioDebug.setPlaybackState("starting");
    // Start playback immediately so user sees feedback
    setState({ playingSlot: slot, playlistMode: false, playlistIndex: 0, playlistSlots: [], activeSetlistId: null });
    // Then resolve direct track URL in background if missing
    if (!slot.directTrackUrl && slot.version?.archive_org_url) {
      const resolved = await resolveSlot(slot);
      if (resolved) {
        audioDebug.setDirectTrackUrl(resolved.directTrackUrl ?? null);
        audioDebug.log("context", "resolved direct track", { url: resolved.directTrackUrl });
        setState(prev => prev.playingSlot?.id === slot.id
          ? { ...prev, playingSlot: resolved }
          : prev
        );
      }
    } else if (!slot.version?.archive_org_url) {
      const resolved = await resolveSlot(slot);
      if (resolved?.version?.archive_org_url) {
        audioDebug.setSlot(resolved.id, resolved.song.title, resolved.version.archive_org_url, resolved.directTrackUrl ?? null);
        setState(prev => prev.playingSlot?.id === slot.id
          ? { ...prev, playingSlot: resolved }
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
    audioDebug.log("context", "playSetlist", { count: slots.length, setlistId });
    audioDebug.setPlaybackState("starting");
    const sorted = [...slots].sort((a, b) => a.setNumber - b.setNumber || a.position - b.position);

    let startIndex = -1;
    let startSlot: PlayableSlot | null = null;

    for (let i = 0; i < sorted.length; i++) {
      const resolved = await resolveSlot(sorted[i]);
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

    if (setlistId) {
      const { supabase } = await import("@/integrations/supabase/client");
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
