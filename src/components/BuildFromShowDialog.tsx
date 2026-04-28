import { useState, useCallback } from "react";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Song = Database["public"]["Tables"]["songs"]["Row"];
type NotableVersion = Database["public"]["Tables"]["notable_versions"]["Row"];

export interface ShowSeed {
  title: string;
  eraId: string | null;
  versions: { song: Song; version: NotableVersion }[];
}

interface BuildFromShowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once a date is picked and matching versions are loaded. */
  onSeed: (seed: ShowSeed) => void | Promise<void>;
}

// Dead touring window
const MIN_DATE = new Date(1965, 7, 1);
const MAX_DATE = new Date(1995, 6, 9); // Jerry's last show: 1995-07-09

const formatNiceDate = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

const BuildFromShowDialog = ({ open, onOpenChange, onSeed }: BuildFromShowDialogProps) => {
  const [date, setDate] = useState<Date | undefined>();
  const [loading, setLoading] = useState(false);

  const handleBuild = useCallback(async () => {
    if (!date) return;
    setLoading(true);
    try {
      const iso = format(date, "yyyy-MM-dd");

      // Pull every notable version from this date
      const { data: versions, error: vErr } = await supabase
        .from("notable_versions")
        .select("*")
        .eq("show_date", iso);

      if (vErr) throw vErr;

      if (!versions || versions.length === 0) {
        toast.error("No catalogued versions from that date yet", {
          description: "Try a nearby date — coverage grows weekly.",
        });
        setLoading(false);
        return;
      }

      // Hydrate songs
      const songIds = [...new Set(versions.map((v) => v.song_id))];
      const { data: songs, error: sErr } = await supabase
        .from("songs")
        .select("*")
        .in("id", songIds);
      if (sErr) throw sErr;

      const songMap = new Map((songs || []).map((s) => [s.id, s]));
      const pairs = versions
        .map((v) => {
          const song = songMap.get(v.song_id);
          return song ? { song, version: v } : null;
        })
        .filter(Boolean) as { song: Song; version: NotableVersion }[];

      // Sort by rating desc then title — there's no true setlist order in our data
      pairs.sort((a, b) => {
        const ra = a.version.rating ?? 0;
        const rb = b.version.rating ?? 0;
        if (rb !== ra) return rb - ra;
        return a.song.title.localeCompare(b.song.title);
      });

      const venue = pairs.find((p) => p.version.venue)?.version.venue;
      const niceDate = formatNiceDate(date);
      const title = venue ? `${niceDate} — ${venue}` : niceDate;
      const eraId = pairs.find((p) => p.version.era_id)?.version.era_id ?? null;

      await onSeed({ title, eraId, versions: pairs });
      onOpenChange(false);
      setDate(undefined);
      toast.success(`Found ${pairs.length} ${pairs.length === 1 ? "song" : "songs"} from ${niceDate}`, {
        description: pairs.length < 6 ? "Add the rest from the Vault when you're ready." : undefined,
      });
    } catch (e) {
      console.error("BuildFromShow error:", e);
      toast.error("Couldn't load that show — try again");
    } finally {
      setLoading(false);
    }
  }, [date, onSeed, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl text-foreground flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Recreate a show
          </DialogTitle>
          <DialogDescription className="font-body text-base text-muted-foreground pt-1">
            Pick a date and we'll pull every catalogued version from that night.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-body h-12 text-base",
                  !date && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-5 w-5" />
                {date ? formatNiceDate(date) : "Pick a show date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-card border-border" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                disabled={(d) => d < MIN_DATE || d > MAX_DATE}
                defaultMonth={date || new Date(1977, 4, 1)}
                captionLayout="dropdown-buttons"
                fromYear={1965}
                toYear={1995}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          <p className="text-sm text-muted-foreground font-body leading-relaxed">
            Honest note: we'll pull every version we have from that date and drop them into Set 1.
            Order may need your touch — and we don't have every show catalogued yet.
          </p>

          <div className="flex gap-2 justify-end pt-2">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="font-body"
            >
              Cancel
            </Button>
            <Button
              onClick={handleBuild}
              disabled={!date || loading}
              className="bg-primary text-primary-foreground font-display gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Build from this show
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BuildFromShowDialog;
