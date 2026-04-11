import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import { findArchiveRecording, findTrackInRecording } from "@/lib/archiveOrg";
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
  stopPlayback: () => void;
  advancePlaylist: (dir: number) => Promise<void>;
}

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

export const useAudioPlayer = () => {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) throw new Error("useAudioPlayer must be used within AudioPlayerProvider");
  return ctx;
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

  const stopPlayback = useCallback(() => {
    setState({ playingSlot: null, playlistMode: false, playlistIndex: 0, playlistSlots: [], activeSetlistId: null });
  }, []);

  const playSingle = useCallback(async (slot: PlayableSlot) => {
    // Start playback immediately so user sees feedback
    setState({ playingSlot: slot, playlistMode: false, playlistIndex: 0, playlistSlots: [], activeSetlistId: null });
    // Then resolve direct track URL in background if missing
    if (!slot.directTrackUrl && slot.version?.archive_org_url) {
      const resolved = await resolveSlot(slot);
      if (resolved) {
        setState(prev => prev.playingSlot?.id === slot.id
          ? { ...prev, playingSlot: resolved }
          : prev
        );
      }
    } else if (!slot.version?.archive_org_url) {
      const resolved = await resolveSlot(slot);
      if (resolved?.version?.archive_org_url) {
        setState(prev => prev.playingSlot?.id === slot.id
          ? { ...prev, playingSlot: resolved }
          : prev
        );
      } else {
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
      const directUrl = await findTrackInRecording(slot.version.archive_org_url, slot.song.title);
      if (directUrl) {
        return { ...slot, directTrackUrl: directUrl };
      }
      // Couldn't find specific track in that recording — still usable via AudioPlayer fallback
      console.warn(`[QA] Could not resolve direct track for "${slot.song.title}" in ${slot.version.archive_org_url}`);
      return slot;
    }

    // No archive URL at all — do a generic search as last resort
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
      toast.error("Couldn't find audio for any songs in the setlist");
      return;
    }

    if (setlistId) {
      const { supabase } = await import("@/integrations/supabase/client");
      supabase.rpc("increment_play_count", { _setlist_id: setlistId });
    }

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

    for (let i = playlistIndex + dir; i >= 0 && i < playlistSlots.length; i += dir) {
      const resolved = await resolveSlot(playlistSlots[i]);
      if (resolved?.version?.archive_org_url) {
        setState((prev) => ({
          ...prev,
          playlistIndex: i,
          playingSlot: resolved,
        }));
        return;
      }
    }

    stopPlayback();
    toast.info("End of setlist");
  }, [stopPlayback]);

  return (
    <AudioPlayerContext.Provider value={{ ...state, playSingle, playSetlist, stopPlayback, advancePlaylist }}>
      {children}
    </AudioPlayerContext.Provider>
  );
};
