import { useEffect, useState } from "react";
import { CalendarIcon, ArrowUpRight, Star } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const MIN_DATE = new Date(1965, 0, 1);
const MAX_DATE = new Date(1995, 6, 9); // Jerry's last show

const formatNice = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

const track = (event: string, props?: Record<string, unknown>) => {
  // PostHog if loaded; safe no-op otherwise.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ph = (typeof window !== "undefined" ? (window as any).posthog : null);
  if (ph?.capture) ph.capture(event, props);
};

interface ScoreShowByDateProps {
  onPullSetlist: (date: Date) => void;
  onSurpriseMe: () => void;
}

const ScoreShowByDate = ({ onPullSetlist, onSurpriseMe }: ScoreShowByDateProps) => {
  const [date, setDate] = useState<Date | undefined>();
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    track("builder_date_mode_viewed");
  }, []);

  const handleSelect = (d: Date | undefined) => {
    setDate(d);
    if (!touched && d) {
      setTouched(true);
      track("builder_date_mode_started", { date: format(d, "yyyy-MM-dd") });
    }
  };

  const handlePull = () => {
    if (!date) return;
    onPullSetlist(date);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="px-3 sm:px-4 pt-4 pb-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          {/* Door 1: Score a Show by Date */}
          <div
            className="rounded-2xl border border-[hsl(var(--border))] bg-card paper-grain p-5 sm:p-6 flex flex-col gap-4 shadow-sm"
            style={{ borderColor: "hsl(45 50% 54% / 0.25)" }}
          >
            <div className="space-y-1.5">
              <h2
                className="font-display italic text-card-foreground"
                style={{ fontSize: "28px", lineHeight: 1.15, color: "#c24a33" }}
              >
                Score a Show by Date
              </h2>
              <p
                className="font-body"
                style={{ fontSize: "15px", fontWeight: 300, color: "#6b665c" }}
              >
                Every day has a tape. Pick yours.
              </p>
              <p
                className="font-body leading-relaxed pt-1"
                style={{ fontSize: "14px", fontWeight: 300, color: "#5a5448" }}
              >
                Your first show. Your anniversary. The day you met someone who mattered.
                Cosmic Charlie pulls the setlist from the tape.
              </p>
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "w-full h-12 px-4 rounded-[10px] flex items-center gap-3 text-left",
                    "bg-[#f1e6ca] border border-[hsl(45_30%_30%/0.6)]",
                    "focus:outline-none focus:ring-2 focus:ring-[#c24a33] focus:border-[#c24a33]",
                    "transition-colors hover:border-[#c24a33]/70",
                  )}
                >
                  <CalendarIcon className="w-5 h-5 shrink-0" style={{ color: "#c24a33" }} />
                  {date ? (
                    <span
                      className="text-base text-card-foreground"
                      style={{ fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace" }}
                    >
                      {format(date, "yyyy-MM-dd")}
                    </span>
                  ) : (
                    <span className="text-base text-muted-foreground font-body">
                      Pick a date (1965 — 1995)
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-card border-border" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={handleSelect}
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

            <Tooltip>
              <TooltipTrigger asChild>
                <span className="block">
                  <Button
                    type="button"
                    onClick={handlePull}
                    disabled={!date}
                    className="w-full h-12 rounded-[10px] font-display gap-2 text-base"
                    style={{ background: "#c24a33", color: "#f1e6ca" }}
                  >
                    Pull the Setlist
                    <ArrowUpRight className="w-5 h-5" />
                  </Button>
                </span>
              </TooltipTrigger>
              {!date && (
                <TooltipContent side="bottom" className="font-body text-xs">
                  Pick a date between 1965-01-01 and 1995-07-09.
                  The Dead weren't on the road outside that window.
                </TooltipContent>
              )}
            </Tooltip>

            {date ? (
              <p className="text-xs font-body text-muted-foreground -mt-1">
                {formatNice(date)} — Cosmic Charlie's pick from the tape.
              </p>
            ) : (
              <p className="text-xs font-body text-muted-foreground/70 -mt-1">
                Pick a date between 1965 and 1995 to pull that night's setlist.
              </p>
            )}
          </div>

          {/* Door 2: Cosmic Charlie's Pick (existing flow) */}
          <button
            type="button"
            onClick={onSurpriseMe}
            className="text-left rounded-2xl border border-[hsl(var(--border))] bg-card paper-grain p-5 sm:p-6 flex flex-col gap-4 shadow-sm hover:border-primary/60 transition-colors group"
          >
            <div className="space-y-1.5 flex-1">
              <h2
                className="font-display italic text-card-foreground"
                style={{ fontSize: "28px", lineHeight: 1.15, color: "#c24a33" }}
              >
                Let Cosmic Charlie Pick
              </h2>
              <p
                className="font-body"
                style={{ fontSize: "15px", fontWeight: 300, color: "#6b665c" }}
              >
                No date in mind? Roll the dice.
              </p>
              <p
                className="font-body leading-relaxed pt-1"
                style={{ fontSize: "14px", fontWeight: 300, color: "#5a5448" }}
              >
                Tell Charlie a mood, an era, or just say surprise me — and he'll pull
                a setlist from the tape that fits the night.
              </p>
            </div>
            <div
              className="w-full h-12 rounded-[10px] font-display gap-2 text-base flex items-center justify-center border border-[#c24a33]/60 group-hover:bg-[#c24a33]/10 transition-colors"
              style={{ color: "#c24a33" }}
            >
              <Star className="w-5 h-5" />
              Open Cosmic Charlie
            </div>
          </button>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default ScoreShowByDate;
