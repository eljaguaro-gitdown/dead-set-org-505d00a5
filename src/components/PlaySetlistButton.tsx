import { useState, type MouseEvent } from "react";
import { Play, Loader2, Pause } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAudioPlayer, type PlayableSlot } from "@/contexts/AudioPlayerContext";
import { toast } from "sonner";

interface PlaySetlistButtonProps {
  setlistId: string;
  /** Visual size variant. */
  size?: "sm" | "md" | "lg";
  /** Optional extra classes (positioning, etc). */
  className?: string;
  /** Accessible label override. */
  label?: string;
}

const sizeMap = {
  sm: { btn: "w-8 h-8", icon: "w-3.5 h-3.5" },
  md: { btn: "w-10 h-10", icon: "w-4 h-4" },
  lg: { btn: "w-12 h-12", icon: "w-5 h-5" },
};

/**
 * One-tap play button for a setlist card. Fetches the setlist's slots on
 * demand, builds PlayableSlot[], and hands off to the global audio player.
 *
 * Stops propagation so it can be safely placed inside a card that has its
 * own onClick (e.g. navigate-to-detail).
 */
const PlaySetlistButton = ({
  setlistId,
  size = "md",
  className = "",
  label = "Play setlist",
}: PlaySetlistButtonProps) => {
  const { playSetlist, stopPlayback, activeSetlistId, playingSlot } = useAudioPlayer();
  const [loading, setLoading] = useState(false);

  const isThisPlaying = activeSetlistId === setlistId && !!playingSlot;
  const sz = sizeMap[size];

  const handleClick = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isThisPlaying) {
      stopPlayback();
      return;
    }

    setLoading(true);
    try {
      // Pull slots + songs for this setlist
      const { data: slots, error } = await supabase
        .from("setlist_slots")
        .select(
          "id, set_number, position, segue_to_next, song_id, notable_version_id, songs(id, title), notable_versions(id, song_id, show_date, archive_org_url, venue, city, era_id, rating, description)"
        )
        .eq("setlist_id", setlistId)
        .order("set_number")
        .order("position");

      if (error) throw error;
      if (!slots || slots.length === 0) {
        toast.info("This setlist is empty");
        return;
      }

      const playable: PlayableSlot[] = slots
        .filter((s: any) => s.songs)
        .map((s: any) => ({
          id: s.id,
          song: { id: s.songs.id, title: s.songs.title },
          version: s.notable_versions ?? null,
          setNumber: s.set_number,
          position: s.position,
          segueToNext: s.segue_to_next ?? false,
          directTrackUrl: null,
        }));

      if (playable.length === 0) {
        toast.info("No playable songs in this setlist");
        return;
      }

      await playSetlist(playable, setlistId);
    } catch (err) {
      console.error("[PlaySetlistButton] failed", err);
      toast.error("Couldn't start playback");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      aria-label={isThisPlaying ? "Stop playback" : label}
      title={isThisPlaying ? "Stop" : label}
      className={`${sz.btn} shrink-0 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:scale-105 active:scale-95 transition-transform disabled:opacity-60 disabled:cursor-wait ${className}`}
    >
      {loading ? (
        <Loader2 className={`${sz.icon} animate-spin`} />
      ) : isThisPlaying ? (
        <Pause className={`${sz.icon} fill-current`} />
      ) : (
        <Play className={`${sz.icon} fill-current ml-0.5`} />
      )}
    </button>
  );
};

export default PlaySetlistButton;
