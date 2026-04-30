import { useState, type MouseEvent } from "react";
import { Play, Loader2, Pause, ChevronDown, ListPlus, Disc3, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAudioPlayer, type PlayableSlot } from "@/contexts/AudioPlayerContext";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface PlaySetlistButtonProps {
  setlistId: string;
  /** Visual size variant. */
  size?: "sm" | "md" | "lg";
  /** Optional extra classes (positioning, etc). */
  className?: string;
  /** Accessible label override. */
  label?: string;
  /** Hide the secondary options menu (use the bare circular play button). */
  hideMenu?: boolean;
}

const sizeMap = {
  sm: { btn: "w-8 h-8", icon: "w-3.5 h-3.5", chev: "w-6 h-8" },
  md: { btn: "w-10 h-10", icon: "w-4 h-4", chev: "w-7 h-10" },
  lg: { btn: "w-12 h-12", icon: "w-5 h-5", chev: "w-8 h-12" },
};

type PlayMode = "all" | "openers" | "queue";

/**
 * One-tap play button for a setlist card. Fetches the setlist's slots on
 * demand, builds PlayableSlot[], and hands off to the global audio player.
 *
 * Primary click: play the whole setlist (or stop if already playing).
 * Secondary chevron: open a menu to play openers only or queue after current.
 */
const PlaySetlistButton = ({
  setlistId,
  size = "md",
  className = "",
  label = "Play setlist",
  hideMenu = false,
}: PlaySetlistButtonProps) => {
  const { playSetlist, queueSetlist, stopPlayback, activeSetlistId, playingSlot } = useAudioPlayer();
  const [loading, setLoading] = useState(false);

  const isThisPlaying = activeSetlistId === setlistId && !!playingSlot;
  const sz = sizeMap[size];
  const hasActivePlayback = !!playingSlot;

  /** Fetch + map slots, then run a play action against them. */
  const runWithSlots = async (
    action: (slots: PlayableSlot[]) => Promise<void>,
    onEmptyMessage = "This setlist is empty",
  ) => {
    setLoading(true);
    try {
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
        toast.info(onEmptyMessage);
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

      await action(playable);
    } catch (err) {
      console.error("[PlaySetlistButton] failed", err);
      toast.error("Couldn't start playback");
    } finally {
      setLoading(false);
    }
  };

  const handlePrimary = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isThisPlaying) {
      stopPlayback();
      return;
    }

    await runWithSlots((playable) => playSetlist(playable, setlistId));
  };

  const handleMode = async (mode: PlayMode) => {
    if (mode === "all") {
      await runWithSlots((playable) => playSetlist(playable, setlistId));
      return;
    }
    if (mode === "openers") {
      await runWithSlots(async (playable) => {
        // "Opener" = first song of each set (by set_number).
        const seen = new Set<number>();
        const openers = playable.filter((s) => {
          if (seen.has(s.setNumber)) return false;
          seen.add(s.setNumber);
          return true;
        });
        if (openers.length === 0) {
          toast.info("No openers found");
          return;
        }
        await playSetlist(openers, setlistId);
        toast.success(`Playing ${openers.length} opener${openers.length === 1 ? "" : "s"}`);
      });
      return;
    }
    if (mode === "queue") {
      await runWithSlots((playable) => queueSetlist(playable));
      return;
    }
  };

  return (
    <div
      className={`inline-flex items-center ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={handlePrimary}
        disabled={loading}
        aria-label={isThisPlaying ? "Stop playback" : label}
        title={isThisPlaying ? "Stop" : label}
        className={`${sz.btn} shrink-0 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:scale-105 active:scale-95 transition-transform disabled:opacity-60 disabled:cursor-wait`}
      >
        {loading ? (
          <Loader2 className={`${sz.icon} animate-spin`} />
        ) : isThisPlaying ? (
          <Pause className={`${sz.icon} fill-current`} />
        ) : (
          <Play className={`${sz.icon} fill-current ml-0.5`} />
        )}
      </button>

      {!hideMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              aria-label="Playback options"
              title="Playback options"
              className={`${sz.chev} ml-1 shrink-0 inline-flex items-center justify-center rounded-md text-primary/80 hover:text-primary hover:bg-primary/10 transition-colors`}
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={6}
            className="w-56"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenuLabel className="font-mono uppercase tracking-[0.15em] text-[11px] text-muted-foreground">
              Playback
            </DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => handleMode("all")}>
              <Disc3 className="w-4 h-4 mr-2 text-primary" />
              <div className="flex flex-col">
                <span>Play setlist as-is</span>
                <span className="text-[11px] text-muted-foreground">From the top, in order</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handleMode("openers")}>
              <Sparkles className="w-4 h-4 mr-2 text-primary" />
              <div className="flex flex-col">
                <span>Openers only</span>
                <span className="text-[11px] text-muted-foreground">First song of each set</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => handleMode("queue")} disabled={loading}>
              <ListPlus className="w-4 h-4 mr-2 text-primary" />
              <div className="flex flex-col">
                <span>{hasActivePlayback ? "Add to queue" : "Queue & play"}</span>
                <span className="text-[11px] text-muted-foreground">
                  {hasActivePlayback ? "After what's playing now" : "Nothing's playing yet"}
                </span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};

export default PlaySetlistButton;
