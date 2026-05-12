import { useState, useCallback, useEffect, useRef } from "react";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Sparkles, ExternalLink, Dice5, Layers, CheckCircle2, ArrowLeft } from "lucide-react";
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
  sourceDate?: string;
  sourceVenue?: string | null;
  sourceArchiveUrl?: string | null;
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

interface PreviewData {
  seed: ShowSeed;
  niceDate: string;
  venue: string | null;
  trackTitles: string[];
  totalTracks: number;
  setBreakdown: Array<{ setNumber: number; count: number }>;
}

const BuildFromShowDialog = ({ open, onOpenChange, onSeed }: BuildFromShowDialogProps) => {
  const [mode, setMode] = useState<"date" | "calendar-day" | "all-years">("date");
  const [date, setDate] = useState<Date | undefined>();
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [day, setDay] = useState<number>(new Date().getDate());
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);

  const resetAll = useCallback(() => {
    setPreview(null);
    setDate(undefined);
  }, []);

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

        const songIds = Array.from(
          new Set(
            ((show.tracks || []) as Array<{ songId?: string | null }>)
              .map((track) => track.songId)
              .filter((songId): songId is string => !!songId),
          ),
        );
        const { data: songs, error: sErr } = await supabase.from("songs").select("*");
        if (sErr) throw sErr;
        const missingSongIds = songIds.filter((songId) => !(songs || []).some((song) => song.id === songId));
        const { data: resolvedInsertedSongs, error: insertedErr } = missingSongIds.length
          ? await supabase.from("songs").select("*").in("id", missingSongIds)
          : { data: [], error: null };
        if (insertedErr) throw insertedErr;
        const songCatalog = [...(songs || []), ...(resolvedInsertedSongs || [])];
        const songsById = new Map(songCatalog.map((s) => [s.id, s]));

        const slots: SeededSlot[] = [];
        const trackTitles: string[] = [];
        const positions = new Map<number, number>();
        let unmatched = 0;

        for (const track of show.tracks as Array<{ rawTitle: string; setNumber: number; position: number; segueToNext: boolean; songId?: string | null; sourceDate?: string; sourceVenue?: string | null }>) {
          const matched = (track.songId && songsById.get(track.songId)) || fuzzyMatchSong(track.rawTitle, songCatalog);
          if (!matched) { unmatched++; continue; }
          const pos = positions.get(track.setNumber) || 0;
          positions.set(track.setNumber, pos + 1);
          slots.push({ song: matched, setNumber: track.setNumber, position: pos, segueToNext: track.segueToNext, sourceDate: track.sourceDate, sourceVenue: track.sourceVenue, sourceArchiveUrl: show.archiveUrl });
          trackTitles.push(matched.title);
        }

        if (slots.length === 0) {
          toast.error("Found the show, but no songs matched our catalog");
          return;
        }

        const isAggregate = (show.date || "").endsWith("-aggregate");
        const resolvedDate = !isAggregate && show.date
          ? new Date(show.date + "T12:00:00")
          : (date || new Date());
        const niceDate = isAggregate ? (show.venue || fallbackTitle) : formatNiceDate(resolvedDate);
        const title = isAggregate
          ? (show.venue || fallbackTitle)
          : (show.venue ? `${formatNiceDate(resolvedDate)} — ${show.venue}` : (fallbackTitle || formatNiceDate(resolvedDate)));

        const setCounts = new Map<number, number>();
        for (const s of slots) setCounts.set(s.setNumber, (setCounts.get(s.setNumber) || 0) + 1);
        const setBreakdown = Array.from(setCounts.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([setNumber, count]) => ({ setNumber, count }));

        setPreview({
          seed: { title, eraId: null, archiveUrl: show.archiveUrl, slots, unmatchedCount: unmatched },
          niceDate,
          venue: show.venue || null,
          trackTitles,
          totalTracks: slots.length,
          setBreakdown,
        });
      } catch (e) {
        console.error("BuildFromShow error:", e);
        toast.error("Couldn't load that show — try again");
      } finally {
        setLoading(false);
      }
    },
    [date],
  );

  const handleConfirm = useCallback(async () => {
    if (!preview) return;
    setConfirming(true);
    try {
      await onSeed(preview.seed);
      onOpenChange(false);
      resetAll();
      toast.success(`Loaded ${preview.totalTracks} songs from ${preview.niceDate}`, {
        description: preview.seed.unmatchedCount > 0
          ? `${preview.seed.unmatchedCount} track${preview.seed.unmatchedCount === 1 ? "" : "s"} skipped (jams, tunings, or songs not in our catalog yet).`
          : "Set order and segues match the show.",
      });
    } catch (e) {
      console.error("BuildFromShow confirm error:", e);
      toast.error("Couldn't save that setlist — try again");
    } finally {
      setConfirming(false);
    }
  }, [preview, onSeed, onOpenChange, resetAll]);

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
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetAll(); onOpenChange(o); }}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl text-foreground flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            {preview ? "Confirm this show" : "Recreate a show"}
          </DialogTitle>
          <DialogDescription className="font-body text-base text-muted-foreground pt-1">
            {preview
              ? "Charlie found Source #1 on archive.org. Review the setlist below, then confirm to build it."
              : "Pull the actual setlist from a specific night — or roll the dice on a calendar day across all years."}
          </DialogDescription>
        </DialogHeader>

        {preview ? (
          <div className="space-y-4 pt-2">
            <div className="rounded-xl border border-border bg-background/40 p-4 space-y-2">
              <div className="font-display text-xl text-foreground">{preview.niceDate}</div>
              {preview.venue && (
                <div className="font-body text-sm text-muted-foreground">{preview.venue}</div>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="text-xs font-body px-2 py-1 rounded-md bg-primary/10 text-primary">
                  {preview.totalTracks} song{preview.totalTracks === 1 ? "" : "s"}
                </span>
                {preview.setBreakdown.map(({ setNumber, count }) => (
                  <span key={setNumber} className="text-xs font-body px-2 py-1 rounded-md bg-muted text-muted-foreground">
                    {setNumber === 0 ? "Encore" : `Set ${setNumber}`}: {count}
                  </span>
                ))}
                {preview.seed.unmatchedCount > 0 && (
                  <span className="text-xs font-body px-2 py-1 rounded-md bg-muted text-muted-foreground">
                    {preview.seed.unmatchedCount} skipped
                  </span>
                )}
              </div>
              {preview.seed.archiveUrl && (
                <a
                  href={preview.seed.archiveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-body text-primary hover:underline pt-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Source #1 on archive.org
                </a>
              )}
            </div>

            <div className="rounded-xl border border-border bg-background/20 max-h-64 overflow-y-auto">
              <ol className="divide-y divide-border">
                {preview.trackTitles.map((t, i) => (
                  <li key={i} className="flex items-baseline gap-3 px-4 py-2 font-body text-sm text-foreground">
                    <span className="text-muted-foreground w-6 shrink-0 text-right">{i + 1}.</span>
                    <span className="truncate">{t}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="flex gap-2 justify-between pt-2">
              <Button
                variant="ghost"
                onClick={() => setPreview(null)}
                disabled={confirming}
                className="font-body gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={confirming}
                className="bg-primary text-primary-foreground font-display gap-2"
              >
                {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {confirming ? "Building…" : "Build this setlist"}
              </Button>
            </div>
          </div>
        ) : (
        <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)} className="pt-2">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="date" className="font-body">Specific date</TabsTrigger>
            <TabsTrigger value="calendar-day" className="font-body">Random year</TabsTrigger>
            <TabsTrigger value="all-years" className="font-body">All years</TabsTrigger>
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

          <TabsContent value="all-years" className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground font-body leading-relaxed">
              Pick a month and day — we'll scan every show the Dead played that calendar day across all years and assemble a setlist with one of each unique song.
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
                onClick={handleBuildAllYears}
                disabled={loading}
                className="bg-primary text-primary-foreground font-display gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                {loading ? "Scanning shows…" : `Pull ${MONTHS[month - 1]} ${day} from every year`}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
        )}

        {!preview && (
          <p className="text-sm text-muted-foreground font-body leading-relaxed flex items-start gap-1.5 pt-2">
            <ExternalLink className="w-4 h-4 mt-0.5 shrink-0 opacity-60" />
            <span>
              Setlist data sourced from <span className="text-primary">archive.org</span>.
              Coverage is excellent for ’72 onward; a few early shows may be missing.
            </span>
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BuildFromShowDialog;
