import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import { findArchiveRecording } from "@/lib/archiveOrg";
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
}

interface AudioPlayerState {
  playingSlot: PlayableSlot | null;
  playlistMode: boolean;
  playlistIndex: number;
  playlistSlots: PlayableSlot[];
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
  });

  // Use ref to avoid stale closures in async callbacks
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const stopPlayback = useCallback(() => {
    setState({ playingSlot: null, playlistMode: false, playlistIndex: 0, playlistSlots: [] });
  }, []);

  const playSingle = useCallback((slot: PlayableSlot) => {
    setState({ playingSlot: slot, playlistMode: false, playlistIndex: 0, playlistSlots: [] });
  }, []);

  const playSetlist = useCallback(async (slots: PlayableSlot[], setlistId?: string) => {
    if (slots.length === 0) return;
    const sorted = [...slots].sort((a, b) => a.setNumber - b.setNumber || a.position - b.position);

    let startIndex = -1;
    let startSlot: PlayableSlot | null = null;

    for (let i = 0; i < sorted.length; i++) {
      const slot = sorted[i];
      if (slot.version?.archive_org_url) {
        startIndex = i;
        startSlot = slot;
        break;
      }
      const result = await findArchiveRecording(slot.song.title);
      if (result) {
        startIndex = i;
        startSlot = {
          ...slot,
          version: {
            id: "", song_id: slot.song.id, show_date: result.date || "",
            archive_org_url: result.url, venue: result.venue,
            city: null, era_id: null, rating: null, description: null,
          },
        };
        break;
      }
    }

    if (!startSlot || startIndex < 0) {
      toast.error("Couldn't find audio for any songs in the setlist");
      return;
    }

    // Increment play count
    if (setlistId) {
      const { supabase } = await import("@/integrations/supabase/client");
      supabase.rpc("increment_play_count", { _setlist_id: setlistId });
    }

    setState({
      playingSlot: startSlot,
      playlistMode: true,
      playlistIndex: startIndex,
      playlistSlots: sorted,
    });
  }, []);

  const advancePlaylist = useCallback(async (dir: number) => {
    const { playlistIndex, playlistSlots } = stateRef.current;

    for (let i = playlistIndex + dir; i >= 0 && i < playlistSlots.length; i += dir) {
      let nextSlot = playlistSlots[i];
      if (!nextSlot.version?.archive_org_url) {
        const result = await findArchiveRecording(nextSlot.song.title);
        if (result) {
          nextSlot = {
            ...nextSlot,
            version: {
              id: "", song_id: nextSlot.song.id, show_date: result.date || "",
              archive_org_url: result.url, venue: result.venue,
              city: null, era_id: null, rating: null, description: null,
            },
          };
        } else {
          continue;
        }
      }
      setState((prev) => ({
        ...prev,
        playlistIndex: i,
        playingSlot: nextSlot,
      }));
      return;
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
