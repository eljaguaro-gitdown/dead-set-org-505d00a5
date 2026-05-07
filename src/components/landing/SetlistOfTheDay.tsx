import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Calendar, ChevronRight, Music } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import PlaySetlistButton from "@/components/PlaySetlistButton";

interface Spotlight {
  id: string;
  title: string;
  creatorId: string;
  creatorName: string;
  songCount: number;
  yearsLabel: string | null;
  eraName: string | null;
  upvoteCount: number;
  playCount: number;
}

const SetlistOfTheDay = () => {
  const navigate = useNavigate();
  const [spotlight, setSpotlight] = useState<Spotlight | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: spot } = await supabase.rpc("get_hero_spotlight");
      const setlistId = Array.isArray(spot) && spot[0]?.setlist_id;
      if (!setlistId) {
        if (!cancelled) setLoading(false);
        return;
      }

      const { data: sl } = await supabase
        .from("setlists")
        .select("id, title, creator_id, era_id, upvote_count, play_count, setlist_slots(notes)")
        .eq("id", setlistId)
        .maybeSingle();
      if (!sl || cancelled) {
        if (!cancelled) setLoading(false);
        return;
      }

      const slotRows = (sl as any).setlist_slots as { notes: string | null }[] | null;
      const [profileRes, eraRes] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("user_id", sl.creator_id).maybeSingle(),
        sl.era_id
          ? supabase.from("eras").select("name").eq("id", sl.era_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      const years = new Set<string>();
      (slotRows ?? []).forEach((r) => {
        const m = r.notes?.match(/From\s+(\d{4})-/);
        if (m) years.add(m[1]);
      });
      const sortedYears = [...years].sort();
      const yearsLabel =
        sortedYears.length === 0
          ? null
          : sortedYears.length === 1
            ? sortedYears[0]
            : `${sortedYears[0]}–${sortedYears[sortedYears.length - 1]}`;

      if (cancelled) return;
      setSpotlight({
        id: sl.id,
        title: sl.title,
        creatorId: sl.creator_id,
        creatorName: profileRes.data?.display_name || "a fellow head",
        songCount: slotRows?.length ?? 0,
        yearsLabel,
        eraName: (eraRes.data as { name: string } | null)?.name ?? null,
        upvoteCount: sl.upvote_count ?? 0,
        playCount: sl.play_count ?? 0,
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !spotlight) return null;

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const handleOpen = () => navigate(`/setlist/${spotlight.id}`);

  return (
    <section
      id="setlist-of-the-day"
      className="py-16 sm:py-24 border-t border-border/30"
    >
      <div className="px-6 sm:px-12 max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="font-mono text-[10px] tracking-[0.3em] text-primary/70 uppercase mb-3 inline-flex items-center gap-2">
            <Calendar className="w-3 h-3" />
            Setlist of the Day · {today}
          </div>
          <h2 className="font-display italic text-3xl sm:text-5xl text-primary leading-tight">
            One night, hand-picked.
          </h2>
          <p className="font-body text-base sm:text-lg text-muted-foreground mt-4 max-w-xl mx-auto">
            A featured setlist from the community — a new one every 24 hours.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          onClick={handleOpen}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleOpen();
            }
          }}
          className="relative border border-primary/30 bg-card rounded-2xl p-6 sm:p-8 cursor-pointer hover:border-primary hover:-translate-y-0.5 transition-all duration-200 group shadow-[0_0_32px_rgba(201,168,76,0.06)] hover:shadow-[0_0_48px_rgba(201,168,76,0.18)]"
        >
          <div className="flex items-start gap-4 sm:gap-6">
            <div onClick={(e) => e.stopPropagation()}>
              <PlaySetlistButton setlistId={spotlight.id} size="lg" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-display italic text-2xl sm:text-3xl text-foreground group-hover:text-primary transition-colors leading-tight">
                {spotlight.title}
              </h3>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/user/${spotlight.creatorId}`);
                }}
                className="font-body text-sm sm:text-base text-muted-foreground mt-1 hover:text-primary transition-colors"
              >
                by {spotlight.creatorName}
              </button>
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                {spotlight.eraName && (
                  <span className="px-2 py-0.5 text-[10px] font-mono rounded-md border border-primary/30 text-primary/80 tracking-wider uppercase">
                    {spotlight.eraName}
                  </span>
                )}
                {spotlight.yearsLabel && (
                  <span className="font-mono text-[11px] tracking-wider text-muted-foreground/70 uppercase">
                    {spotlight.yearsLabel}
                  </span>
                )}
                <span className="font-mono text-[11px] tracking-wider text-muted-foreground/60 uppercase inline-flex items-center gap-1">
                  <Music className="w-3 h-3" />
                  {spotlight.songCount} songs
                </span>
                {spotlight.upvoteCount > 0 && (
                  <span className="font-mono text-sm text-primary tabular-nums">
                    ⚡ {spotlight.upvoteCount}
                  </span>
                )}
                {spotlight.playCount > 0 && (
                  <span className="font-mono text-sm text-muted-foreground/70 tabular-nums">
                    ▶ {spotlight.playCount}
                  </span>
                )}
              </div>
              <div className="mt-5 inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.2em] text-primary uppercase group-hover:gap-2.5 transition-all">
                Open the setlist
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default SetlistOfTheDay;
