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
  creator_name?: string;
  era_name?: string;
  song_count?: number;
}

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [featured, setFeatured] = useState<FeaturedSetlist[]>([]);

  // No auto-redirect — all users see the landing page

  useEffect(() => {
    const fetchFeatured = async () => {
      const { data: setlists } = await supabase
        .from("setlists")
        .select("id, title, creator_id, era_id, upvote_count")
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
          className="font-display text-sm tracking-[0.15em] text-muted-foreground hover:text-primary transition-colors uppercase"
        >
          Browse
        </button>
        {user ? (
          <button
            onClick={() => navigate("/my-setlists")}
            className="font-display text-sm tracking-[0.15em] text-muted-foreground hover:text-primary transition-colors uppercase"
          >
            My Setlists
          </button>
        ) : (
          <button
            onClick={() => navigate("/auth")}
            className="font-display text-sm tracking-[0.15em] text-muted-foreground hover:text-primary transition-colors uppercase"
          >
            Sign In
          </button>
        )}
      </SiteHeader>

      {/* Hero — single screen, centered on Cosmic Charlie */}
      <main className="flex-1 flex flex-col items-center justify-center px-5 sm:px-4 relative overflow-hidden min-h-[calc(100vh-80px)]">
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] sm:w-[700px] h-[500px] sm:h-[700px] rounded-full bg-[radial-gradient(circle,hsl(var(--dead-gold)/0.08),transparent_70%)]" />
          <div className="absolute top-1/3 left-1/4 w-[300px] sm:w-[450px] h-[300px] sm:h-[450px] rounded-full bg-[radial-gradient(circle,hsl(var(--dead-red)/0.04),transparent_70%)]" />
        </div>

        {/* Film grain overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48ZmlsdGVyIGlkPSJmIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iMC45IiBudW1PY3RhdmVzPSI0IiBzdGl0Y2hUaWxlcz0ic3RpdGNoIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsdGVyPSJ1cmwoI2YpIi8+PC9zdmc+')]" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex flex-col items-center gap-4 sm:gap-7 relative z-10 text-center max-w-xl w-full"
        >
          {/* SYF logo */}
          <div className="sm:hidden">
            <StealYourFace size={90} />
          </div>
          <div className="hidden sm:block">
            <StealYourFace size={180} />
          </div>

          {/* Primary tagline */}
          <h1 className="font-display text-2xl sm:text-5xl md:text-6xl tracking-tight text-primary leading-none">
            Build your dream Dead show.
          </h1>

          {/* Secondary — Cosmic Charlie intro */}
          <p className="font-body text-xs sm:text-base text-muted-foreground leading-relaxed max-w-md px-2">
            Cosmic Charlie knows every setlist the Dead ever played. Tell Charlie your mood, vibe, dream and curate your miracle.
          </p>

          {/* Ambient audio teaser */}
          <AmbientPlayer />

          {/* Primary CTA — Cosmic Charlie gateway */}
          <motion.button
            onClick={() => navigate("/builder")}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="group relative flex items-center gap-3 sm:gap-4 px-6 sm:px-14 py-4 sm:py-6 bg-primary text-primary-foreground rounded-md shadow-[0_0_40px_hsl(var(--glow-gold))] hover:shadow-[0_0_60px_hsl(var(--glow-gold))] transition-shadow duration-300 w-full sm:w-auto justify-center"
          >
            <img
              src={dancingBear}
              alt="Dancing Bear"
              className="w-8 h-8 sm:w-12 sm:h-12 object-contain"
            />
            <div className="flex flex-col items-start">
              <span className="font-display text-sm sm:text-lg tracking-widest uppercase leading-tight">
                Need a Miracle?
              </span>
              <span className="font-body text-[9px] sm:text-xs text-primary-foreground/70 tracking-wide">
                Let Cosmic Charlie build your dream set
              </span>
            </div>
            <Star className="w-4 h-4 sm:w-5 sm:h-5 opacity-60 group-hover:opacity-100 transition-opacity" />
          </motion.button>

          {/* Secondary CTA */}
          <Button
            variant="outline"
            size="lg"
            onClick={() => navigate("/browse")}
            className="font-display text-xs sm:text-sm px-6 sm:px-8 py-4 sm:py-5 border-primary/40 text-primary hover:bg-primary/10 tracking-widest uppercase gap-2 w-full sm:w-auto"
          >
            Browse Community Setlists
            <ChevronRight className="w-4 h-4" />
          </Button>
        </motion.div>
      </main>

      {/* Trending all-time carousel */}
      {featured.length > 0 && (
        <section className="py-10 sm:py-16 border-t border-border/30">
          <div className="px-4 sm:px-8 mb-6">
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-border" />
              <span className="font-display text-sm tracking-[0.2em] text-primary uppercase">
                🔥 Trending All Time
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
          </div>

          <div className="overflow-x-auto scrollbar-hide px-4 sm:px-8">
            <div className="flex gap-4 min-w-max pb-2">
              {featured.map((setlist, i) => (
                <motion.button
                  key={setlist.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.4 }}
                  onClick={() => navigate(`/setlist/${setlist.id}`)}
                  className="w-[220px] sm:w-[260px] shrink-0 border border-border/60 bg-card/50 backdrop-blur-sm rounded-lg p-5 text-left hover:border-primary/40 hover:shadow-[0_0_20px_hsl(var(--glow-gold)/0.15)] transition-all group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display text-sm text-foreground truncate group-hover:text-primary transition-colors">
                      {setlist.title}
                    </h3>
                    {setlist.upvote_count > 0 && (
                      <span className="shrink-0 text-xs font-display text-primary">
                        ⚡ {setlist.upvote_count}
                      </span>
                    )}
                  </div>
                  <p className="font-body text-xs text-muted-foreground mt-1 truncate">
                    by {setlist.creator_name}
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    {setlist.era_name && (
                      <span className="px-2 py-0.5 text-[10px] font-marker rounded-sm border border-primary/30 text-primary/80">
                        {setlist.era_name}
                      </span>
                    )}
                    <span className="text-[10px] font-body text-muted-foreground/60">
                      {setlist.song_count} songs
                    </span>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>

          <div className="flex justify-center mt-6">
            <Button
              variant="ghost"
              onClick={() => navigate("/browse")}
              className="font-display text-xs tracking-[0.15em] text-muted-foreground hover:text-primary uppercase gap-1.5"
            >
              See all community setlists
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </section>
      )}

      {/* Minimal footer */}
      <footer className="py-4 text-center border-t border-border/30">
        <div className="flex items-center justify-center gap-3 text-xs font-body text-muted-foreground/50">
          <span>© Dead Set</span>
          <span>·</span>
          <button
            onClick={() => navigate("/privacy")}
            className="hover:text-muted-foreground transition-colors underline underline-offset-2"
          >
            Privacy
          </button>
        </div>
      </footer>
    </PageLayout>
  );
};

export default Index;
