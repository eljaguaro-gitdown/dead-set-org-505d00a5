import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import dancingBear from "@/assets/dancing-bear.gif";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

import StealYourFace from "@/components/StealYourFace";
import AmbientPlayer from "@/components/AmbientPlayer";
import PageLayout from "@/components/PageLayout";
import SiteHeader from "@/components/SiteHeader";
import AdSenseLoader from "@/components/AdSenseLoader";
import { Button } from "@/components/ui/button";
import { Star, ChevronRight } from "lucide-react";

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
  const { user, loading } = useAuth();
  const [featured, setFeatured] = useState<FeaturedSetlist[]>([]);

  useEffect(() => {
    const fetchFeatured = async () => {
      const { data: setlists } = await supabase
        .from("setlists")
        .select("id, title, creator_id, era_id, upvote_count, play_count")
        .eq("is_public", true)
        .order("upvote_count", { ascending: false })
        .limit(6);

      if (!setlists || setlists.length === 0) return;

      const creatorIds = [...new Set(setlists.map((s) => s.creator_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", creatorIds);
      const profileMap = new Map(
        (profiles || []).map((p) => [p.user_id, p.display_name])
      );

      const eraIds = [
        ...new Set(setlists.map((s) => s.era_id).filter(Boolean)),
      ] as string[];
      let eraMap = new Map<string, string>();
      if (eraIds.length > 0) {
        const { data: eras } = await supabase
          .from("eras")
          .select("id, name")
          .in("id", eraIds);
        eraMap = new Map((eras || []).map((e) => [e.id, e.name]));
      }

      const setlistIds = setlists.map((s) => s.id);
      const { data: slotCounts } = await supabase
        .from("setlist_slots")
        .select("setlist_id")
        .in("setlist_id", setlistIds);
      const countMap = new Map<string, number>();
      (slotCounts || []).forEach((s) => {
        countMap.set(s.setlist_id, (countMap.get(s.setlist_id) || 0) + 1);
      });

      setFeatured(
        setlists.map((s) => ({
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
      <AdSenseLoader />
      <SiteHeader large>
        <button
          onClick={() => navigate("/browse")}
          className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground hover:text-primary transition-colors uppercase"
        >
          Browse
        </button>
        {user ? (
          <button
            onClick={() => navigate("/my-setlists")}
            className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground hover:text-primary transition-colors uppercase"
          >
            My Setlists
          </button>
        ) : (
          <button
            onClick={() => navigate("/auth")}
            className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground hover:text-primary transition-colors uppercase"
          >
            Sign In
          </button>
        )}
      </SiteHeader>

      {/* Hero — centered on Cosmic Charlie */}
      <main className="flex-1 flex flex-col items-center justify-center px-5 sm:px-12 relative overflow-hidden min-h-[calc(100vh-80px)]">
        {/* Gold radial glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-[radial-gradient(circle,hsl(var(--dead-gold)/0.08),transparent_70%)]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex flex-col items-center gap-6 sm:gap-8 relative z-10 text-center max-w-2xl w-full"
        >
          {/* SYF logo */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0 }}
          >
            <StealYourFace size={isMobileCheck() ? 80 : 140} />
          </motion.div>

          {/* Primary tagline */}
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.06 }}
            className="font-display text-3xl sm:text-5xl md:text-6xl text-primary leading-none tracking-tight"
          >
            Build your dream Dead show.
          </motion.h1>

          {/* Secondary — Cosmic Charlie intro */}
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12 }}
            className="font-body text-sm sm:text-base text-muted-foreground leading-relaxed max-w-md px-2"
          >
            Cosmic Charlie knows every setlist the Dead ever played. Tell Charlie your mood, pick an era, and curate your miracle.
          </motion.p>

          {/* Ambient audio teaser */}
          <AmbientPlayer />

          {/* Primary CTA — Cosmic Charlie gateway */}
          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.18 }}
            onClick={() => navigate("/builder?wizard=true")}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="group relative flex items-center gap-3 sm:gap-4 px-8 sm:px-12 py-4 sm:py-5 bg-primary text-primary-foreground rounded-lg shadow-[0_4px_40px_hsl(var(--glow-gold))] hover:shadow-[0_4px_60px_hsl(var(--glow-gold))] hover:brightness-110 transition-all duration-200 w-full sm:w-auto justify-center"
          >
            <img
              src={dancingBear}
              alt="Dancing Bear"
              className="w-8 h-8 sm:w-10 sm:h-10 object-contain"
            />
            <div className="flex flex-col items-start">
              <span className="font-body text-sm sm:text-base font-bold tracking-wide">
                Need a Miracle?
              </span>
              <span className="font-body text-[10px] sm:text-xs text-primary-foreground/70">
                Let Cosmic Charlie build your dream set
              </span>
            </div>
            <Star className="w-4 h-4 opacity-60 group-hover:opacity-100 transition-opacity" />
          </motion.button>

          {/* Secondary CTA */}
          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate("/browse")}
            className="gap-2 w-full sm:w-auto"
          >
            Browse Community Setlists
            <ChevronRight className="w-4 h-4" />
          </Button>
        </motion.div>
      </main>

      {/* Trending all-time carousel */}
      {featured.length > 0 && (
        <section className="py-12 sm:py-20 border-t border-border/30">
          <div className="px-6 sm:px-12 mb-8">
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-border" />
              <span className="font-mono text-[10px] tracking-[0.3em] text-primary/60 uppercase">
                🔥 Trending All Time
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
          </div>

          <div className="overflow-x-auto scrollbar-hide px-6 sm:px-12">
            <div className="flex gap-5 min-w-max pb-2">
              {featured.map((setlist, i) => (
                <motion.button
                  key={setlist.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.4 }}
                  onClick={() => navigate(`/setlist/${setlist.id}`)}
                  className="w-[240px] sm:w-[280px] shrink-0 border border-border bg-card rounded-xl p-5 text-left hover:border-border/80 hover:-translate-y-0.5 transition-all duration-200 group"
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
      <footer className="py-6 text-center border-t border-border/30">
        <div className="flex items-center justify-center gap-3 text-[10px] font-mono text-muted-foreground/40 tracking-wider">
          <span>© Dead Set</span>
          <span>·</span>
          <button
            onClick={() => navigate("/privacy")}
            className="hover:text-muted-foreground transition-colors"
          >
            Privacy
          </button>
        </div>
      </footer>
    </PageLayout>
  );
};

// Simple inline mobile check for stagger
function isMobileCheck() {
  return typeof window !== "undefined" && window.innerWidth < 640;
}

export default Index;
