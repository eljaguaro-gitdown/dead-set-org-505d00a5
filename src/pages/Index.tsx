import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

import PageLayout from "@/components/PageLayout";
import SiteHeader from "@/components/SiteHeader";

import HeroSection from "@/components/landing/HeroSection";
import HowItWorks from "@/components/landing/HowItWorks";
import PersonalNote from "@/components/landing/PersonalNote";
import ShareAppButton from "@/components/ShareAppButton";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

interface FeaturedSetlist {
  id: string;
  title: string;
  creator_id: string;
  era_id: string | null;
  upvote_count: number;
  play_count: number;
  creator_name?: string;
  era_name?: string;
  song_count?: number;
}

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [featured, setFeatured] = useState<FeaturedSetlist[]>([]);

  useEffect(() => {
    const fetchFeatured = async () => {
      const { data: setlists } = await supabase
        .from("setlists")
        .select("id, title, creator_id, era_id, upvote_count, play_count")
        .eq("is_public", true)
        .order("play_count", { ascending: false })
        .limit(50);

      if (!setlists || setlists.length === 0) return;

      const sorted = [...setlists]
        .sort((a, b) => (b.play_count + b.upvote_count) - (a.play_count + a.upvote_count))
        .slice(0, 6);

      const creatorIds = [...new Set(sorted.map((s) => s.creator_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", creatorIds);
      const profileMap = new Map(
        (profiles || []).map((p) => [p.user_id, p.display_name])
      );

      const eraIds = [
        ...new Set(sorted.map((s) => s.era_id).filter(Boolean)),
      ] as string[];
      let eraMap = new Map<string, string>();
      if (eraIds.length > 0) {
        const { data: eras } = await supabase
          .from("eras")
          .select("id, name")
          .in("id", eraIds);
        eraMap = new Map((eras || []).map((e) => [e.id, e.name]));
      }

      const setlistIds = sorted.map((s) => s.id);
      const { data: slotCounts } = await supabase
        .from("setlist_slots")
        .select("setlist_id")
        .in("setlist_id", setlistIds);
      const countMap = new Map<string, number>();
      (slotCounts || []).forEach((s) => {
        countMap.set(s.setlist_id, (countMap.get(s.setlist_id) || 0) + 1);
      });

      setFeatured(
        sorted.map((s) => ({
          ...s,
          creator_name: profileMap.get(s.creator_id) || "Unknown",
          era_name: s.era_id ? eraMap.get(s.era_id) || undefined : undefined,
          song_count: countMap.get(s.id) || 0,
        }))
      );
    };
    fetchFeatured();
  }, []);

  return (
    <PageLayout>
      
      <SiteHeader large>
        <button
          onClick={() => navigate("/browse")}
          className="font-mono text-xs sm:text-[10px] tracking-[0.2em] text-muted-foreground hover:text-primary transition-colors uppercase min-h-[44px] flex items-center"
        >
          Browse
        </button>
        <button
          onClick={() => navigate("/builder?wizard=true")}
          className="font-mono text-xs sm:text-[10px] tracking-[0.2em] text-muted-foreground hover:text-primary transition-colors uppercase border border-primary/30 rounded-md px-3 py-2 hover:border-primary/60 min-h-[44px] flex items-center"
        >
          Build a setlist
        </button>
        {user ? (
          <button
            onClick={() => navigate("/my-setlists")}
            className="font-mono text-xs sm:text-[10px] tracking-[0.2em] text-muted-foreground hover:text-primary transition-colors uppercase min-h-[44px] flex items-center"
          >
            My Setlists
          </button>
        ) : (
          <button
            onClick={() => navigate("/auth")}
            className="font-mono text-xs sm:text-[10px] tracking-[0.2em] text-muted-foreground hover:text-primary transition-colors uppercase min-h-[44px] flex items-center"
          >
            Sign In
          </button>
        )}
      </SiteHeader>

      {/* Hero — headline, subhead, audio strip, CTAs */}
      <HeroSection />

      {/* How It Works — 3 steps */}
      <HowItWorks />

      {/* Personal note — the soul (humans before algorithms) */}
      <PersonalNote />

      {/* Community carousel */}
      {featured.length > 0 && (
        <section className="py-12 sm:py-20 border-t border-border/30">
          <div className="px-6 sm:px-12 mb-8">
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-border" />
              <span className="font-mono text-[10px] tracking-[0.3em] text-primary/60 uppercase">
                From the community
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
          </div>

          <div className="overflow-x-auto scrollbar-hide px-6 sm:px-12 snap-x snap-mandatory">
            <div className="flex gap-4 sm:gap-5 min-w-max pb-2">
              {featured.map((setlist, i) => (
                <motion.button
                  key={setlist.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.4 }}
                  onClick={() => navigate(`/setlist/${setlist.id}`)}
                  className="w-[220px] sm:w-[280px] shrink-0 snap-start border border-border bg-card rounded-xl p-4 sm:p-5 text-left hover:border-border/80 hover:-translate-y-0.5 transition-all duration-200 group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-base font-bold text-foreground truncate group-hover:text-primary transition-colors">
                      {setlist.title}
                    </h3>
                    {setlist.upvote_count > 0 && (
                      <span className="shrink-0 text-xs font-mono text-primary tabular-nums">
                        ⚡ {setlist.upvote_count}
                      </span>
                    )}
                  </div>
                  <p className="font-body text-xs text-muted-foreground mt-1 truncate">
                    by {setlist.creator_name}
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    {setlist.era_name && (
                      <span className="px-2 py-0.5 text-[10px] font-mono rounded-md border border-primary/20 text-primary/70 tracking-wider uppercase">
                        {setlist.era_name}
                      </span>
                    )}
                    {setlist.play_count > 0 && (
                      <span className="text-[10px] font-mono text-muted-foreground/60 tracking-wider">
                        ▶ {setlist.play_count}
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-muted-foreground/60 tracking-wider">
                      {setlist.song_count} songs
                    </span>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>

          <div className="flex justify-center mt-8">
            <Button
              variant="ghost"
              onClick={() => navigate("/browse")}
              className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground hover:text-primary uppercase gap-1.5"
            >
              See all community setlists
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </section>
      )}

      {/* Minimal footer */}
      <footer className="py-8 border-t border-border/30">
        <div className="flex flex-col items-center gap-4">
          <ShareAppButton variant="full" />
          <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground/40 tracking-wider">
            <span>© Dead Set</span>
            <span>·</span>
            <button
              onClick={() => navigate("/privacy")}
              className="hover:text-muted-foreground transition-colors"
            >
              Privacy
            </button>
          </div>
        </div>
      </footer>
    </PageLayout>
  );
};

export default Index;
