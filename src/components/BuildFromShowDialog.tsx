import { useState, useCallback } from "react";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Sparkles, ExternalLink, Dice5, Layers } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { matchScore } from "@/lib/archiveOrg";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Song = Database["public"]["Tables"]["songs"]["Row"];

export interface SeededSlot {
  song: Song;
  setNumber: number;
  position: number;
  segueToNext: boolean;
}

export interface ShowSeed {
  title: string;
  eraId: string | null;
  archiveUrl: string;
  slots: SeededSlot[];
  unmatchedCount: number;
}

interface BuildFromShowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSeed: (seed: ShowSeed) => void | Promise<void>;
}

const MIN_DATE = new Date(1965, 7, 1);
const MAX_DATE = new Date(1995, 6, 9); // Jerry's last show: 1995-07-09

const formatNiceDate = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

// Pick the best song from the local catalog for a given archive.org track title.
function fuzzyMatchSong(rawTitle: string, songs: Song[]): Song | null {
  let best: { song: Song; score: number } | null = null;
  for (const song of songs) {
    const score = matchScore(rawTitle, song.title);
    if (score >= 60 && (!best || score > best.score)) {
      best = { song, score };
    }
  }
  return best?.song ?? null;
}

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const BuildFromShowDialog = ({ open, onOpenChange, onSeed }: BuildFromShowDialogProps) => {
  const [mode, setMode] = useState<"date" | "calendar-day" | "all-years">("date");
  const [date, setDate] = useState<Date | undefined>();
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [day, setDay] = useState<number>(new Date().getDate());
  const [loading, setLoading] = useState(false);

  const runFetch = useCallback(
    async (body: { date?: string } | { month: number; day: number; aggregate?: boolean }, fallbackTitle: string) => {
      setLoading(true);
      try {
        const { data: show, error: fnErr } = await supabase.functions.invoke("fetch-show-setlist", { body });

        if (fnErr || !show || show.error) {
          const msg = show?.error || fnErr?.message || "Couldn't find that show";
          const nearby: string[] = Array.isArray(show?.nearbyDates) ? show.nearbyDates : [];
          toast.error(msg, {
            description: nearby.length
              ? `Try one of these instead: ${nearby.slice(0, 3).join(" · ")}`
              : "Try a nearby date — not every night is on archive.org.",
            action: nearby.length
              ? { label: `Try ${nearby[0]}`, onClick: () => { setMode("date"); setDate(new Date(nearby[0] + "T12:00:00")); } }
              : undefined,
          });
          return;
        }

        const { data: songs, error: sErr } = await supabase.from("songs").select("*");
        if (sErr) throw sErr;

        const slots: SeededSlot[] = [];
        const positions = new Map<number, number>();
        let unmatched = 0;

        for (const track of show.tracks as Array<{ rawTitle: string; setNumber: number; position: number; segueToNext: boolean; }>) {
          const matched = fuzzyMatchSong(track.rawTitle, songs || []);
          if (!matched) { unmatched++; continue; }
          const pos = positions.get(track.setNumber) || 0;
          positions.set(track.setNumber, pos + 1);
          slots.push({ song: matched, setNumber: track.setNumber, position: pos, segueToNext: track.segueToNext });
        }

        if (slots.length === 0) {
          toast.error("Found the show, but no songs matched our catalog");
          return;
        }

        // Use the resolved date returned by the edge function for nice titles
        const resolvedDate = show.date ? new Date(show.date + "T12:00:00") : (date || new Date());
        const niceDate = formatNiceDate(resolvedDate);
        const title = show.venue ? `${niceDate} — ${show.venue}` : (fallbackTitle || niceDate);

        await onSeed({ title, eraId: null, archiveUrl: show.archiveUrl, slots, unmatchedCount: unmatched });

        onOpenChange(false);
        setDate(undefined);
        toast.success(`Loaded ${slots.length} songs from ${niceDate}`, {
          description: unmatched > 0
            ? `${unmatched} track${unmatched === 1 ? "" : "s"} skipped (jams, tunings, or songs not in our catalog yet).`
            : "Set order and segues match the show.",
        });
      } catch (e) {
        console.error("BuildFromShow error:", e);
        toast.error("Couldn't load that show — try again");
      } finally {
        setLoading(false);
      }
    },
    [date, onSeed, onOpenChange],
  );

  const handleBuildDate = useCallback(() => {
    if (!date) return;
    runFetch({ date: format(date, "yyyy-MM-dd") }, formatNiceDate(date));
  }, [date, runFetch]);

  const handleBuildCalendarDay = useCallback(() => {
    runFetch({ month, day }, `${MONTHS[month - 1]} ${day} — across the years`);
  }, [month, day, runFetch]);

  const handleBuildAllYears = useCallback(() => {
    runFetch({ month, day, aggregate: true }, `${MONTHS[month - 1]} ${day} — every year`);
  }, [month, day, runFetch]);

  const daysInMonth = new Date(2000, month, 0).getDate(); // leap-safe enough for picker

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl text-foreground flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Recreate a show
          </DialogTitle>
          <DialogDescription className="font-body text-base text-muted-foreground pt-1">
            Pull the actual setlist from a specific night — or roll the dice on a calendar day across all years.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as "date" | "calendar-day")} className="pt-2">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="date" className="font-body">Specific date</TabsTrigger>
            <TabsTrigger value="calendar-day" className="font-body">Calendar day</TabsTrigger>
          </TabsList>

          <TabsContent value="date" className="space-y-4 pt-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-body h-12 text-base", !date && "text-muted-foreground")}
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

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading} className="font-body">
                Cancel
              </Button>
              <Button
                onClick={handleBuildDate}
                disabled={!date || loading}
                className="bg-primary text-primary-foreground font-display gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {loading ? "Loading show…" : "Build from this show"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="calendar-day" className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground font-body leading-relaxed">
              Pick a month and day — we'll pull a full show from a random year the Dead played that calendar day (1965–1995).
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-body text-muted-foreground">Month</label>
                <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                  <SelectTrigger className="h-12 font-body text-base"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border max-h-72">
                    {MONTHS.map((m, i) => (
                      <SelectItem key={m} value={String(i + 1)} className="font-body">{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-body text-muted-foreground">Day</label>
                <Select value={String(Math.min(day, daysInMonth))} onValueChange={(v) => setDay(Number(v))}>
                  <SelectTrigger className="h-12 font-body text-base"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border max-h-72">
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                      <SelectItem key={d} value={String(d)} className="font-body">{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading} className="font-body">
                Cancel
              </Button>
              <Button
                onClick={handleBuildCalendarDay}
                disabled={loading}
                className="bg-primary text-primary-foreground font-display gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Dice5 className="w-4 h-4" />}
                {loading ? "Finding a show…" : `Roll the dice on ${MONTHS[month - 1]} ${day}`}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <p className="text-sm text-muted-foreground font-body leading-relaxed flex items-start gap-1.5 pt-2">
          <ExternalLink className="w-4 h-4 mt-0.5 shrink-0 opacity-60" />
          <span>
            Setlist data sourced from <span className="text-primary">archive.org</span>.
            Coverage is excellent for ’72 onward; a few early shows may be missing.
          </span>
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default BuildFromShowDialog;
