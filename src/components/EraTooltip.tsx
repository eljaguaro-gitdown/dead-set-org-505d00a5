import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";

export interface EraInfo {
  description: string;
  keySongs: string[];
}

/** Client-side era education data keyed by era name (partial match) */
export const ERA_EDUCATION: Record<string, EraInfo> = {
  "Primal Dead": {
    description: "Raw, psychedelic beginnings. Acid Tests, Fillmore West, and the invention of the jam band.",
    keySongs: ["Dark Star", "St. Stephen", "The Eleven"],
  },
  "Workingman": {
    description: "Acoustic country-rock meets electric Dead. American Beauty and Workingman's Dead define this period.",
    keySongs: ["Uncle John's Band", "Truckin'", "Friend of the Devil", "Ripple"],
  },
  "Europe": {
    description: "Jazz-influenced improvisations with the classic two-drummer lineup. Europe '72 is the essential document.",
    keySongs: ["China Cat → Rider", "Playing in the Band", "Brown-Eyed Women"],
  },
  "Wall of Sound": {
    description: "Massive PA system, massive jams. The pinnacle of live sound engineering.",
    keySongs: ["Eyes of the World", "Weather Report Suite", "Scarlet Begonias"],
  },
  "Hiatus": {
    description: "The comeback era. Smaller venues, tighter playing, and the legendary Cornell '77.",
    keySongs: ["Estimated Prophet", "Terrapin Station", "Help → Slip → Franklin's"],
  },
  "Terrapin": {
    description: "The comeback era. Smaller venues, tighter playing, and the legendary Cornell '77.",
    keySongs: ["Estimated Prophet", "Terrapin Station", "Help → Slip → Franklin's"],
  },
  "Shakedown": {
    description: "Disco-era Dead with Shakedown Street and late-night Winterland runs.",
    keySongs: ["Shakedown Street", "Fire on the Mountain", "I Need a Miracle"],
  },
  "'80s Dead": {
    description: "The Brent Mydland years. Huge venues, Touch of Grey mainstream crossover.",
    keySongs: ["Touch of Grey", "Hell in a Bucket", "West LA Fadeaway"],
  },
  "Brent": {
    description: "The Brent Mydland years. Huge venues, Touch of Grey mainstream crossover.",
    keySongs: ["Touch of Grey", "Hell in a Bucket", "West LA Fadeaway"],
  },
  "Final": {
    description: "Vince Welnick on keys. The long farewell tour. Soldier Field, July '95.",
    keySongs: ["Liberty", "So Many Roads", "Days Between"],
  },
  "Vince": {
    description: "Vince Welnick on keys. The long farewell tour. Soldier Field, July '95.",
    keySongs: ["Liberty", "So Many Roads", "Days Between"],
  },
};

export const getEraEducation = (eraName: string): EraInfo | null => {
  for (const [key, info] of Object.entries(ERA_EDUCATION)) {
    if (eraName.toLowerCase().includes(key.toLowerCase())) return info;
  }
  return null;
};

interface EraTooltipProps {
  eraName: string;
  yearRange?: string;
  children: React.ReactNode;
}

const EraTooltip = ({ eraName, yearRange, children }: EraTooltipProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const info = getEraEducation(eraName);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  if (!info) return <>{children}</>;

  return (
    <div
      ref={ref}
      className="relative inline-block"
      onMouseEnter={() => !isMobile && setOpen(true)}
      onMouseLeave={() => !isMobile && setOpen(false)}
      onClick={(e) => {
        if (isMobile) {
          e.stopPropagation();
          setOpen((o) => !o);
        }
      }}
    >
      {children}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: isMobile ? 10 : -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: isMobile ? 10 : -5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`absolute z-[60] w-[260px] p-3 rounded-lg bg-card border border-primary/30 shadow-xl shadow-background/50 ${
              isMobile
                ? "left-1/2 -translate-x-1/2 top-full mt-2"
                : "left-1/2 -translate-x-1/2 bottom-full mb-2"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Arrow */}
            <div
              className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-card border-primary/30 rotate-45 ${
                isMobile
                  ? "-top-1 border-l border-t"
                  : "-bottom-1 border-r border-b"
              }`}
            />
            <p className="font-display text-xs text-card-foreground">
              {eraName}
            </p>
            {yearRange && (
              <p className="text-[10px] font-body text-muted-foreground mt-0.5">{yearRange}</p>
            )}
            <p className="font-body text-[11px] text-muted-foreground mt-2 leading-relaxed">
              {info.description}
            </p>
            <div className="flex flex-wrap gap-1 mt-2">
              {info.keySongs.map((song) => (
                <span
                  key={song}
                  className="px-1.5 py-0.5 text-[9px] font-body rounded-sm bg-primary/10 text-accent-foreground border border-primary/15"
                >
                  {song}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EraTooltip;
