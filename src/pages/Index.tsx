import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getPostAuthRedirect } from "@/lib/postAuthRedirect";
import StealYourFace from "@/components/StealYourFace";
import DancingBear from "@/components/DancingBear";
import AmbientPlayer from "@/components/AmbientPlayer";
import PageLayout from "@/components/PageLayout";
import SiteHeader from "@/components/SiteHeader";
import AdSenseLoader from "@/components/AdSenseLoader";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

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

  useEffect(() => {
    if (!loading && user) {
      getPostAuthRedirect(user.id).then((path) => {
        navigate(path, { replace: true });
      });
    }
  }, [user, loading, navigate]);

  // Fetch top public setlists
  useEffect(() => {
    const fetchFeatured = async () => {
      const { data: setlists } = await supabase
        .from("setlists")
        .select("id, title, creator_id, era_id, upvote_count")
        .eq("is_public", true)
        .order("upvote_count", { ascending: false })
        .limit(6);

      if (!setlists || setlists.length === 0) return;

      // Fetch creator names
      const creatorIds = [...new Set(setlists.map((s) => s.creator_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", creatorIds);
      const profileMap = new Map(
        (profiles || []).map((p) => [p.user_id, p.display_name])
      );

      // Fetch era names
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

      // Fetch song counts
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
        <button
          onClick={() => navigate("/auth")}
          className="font-display text-sm tracking-[0.15em] text-muted-foreground hover:text-primary transition-colors uppercase"
        >
          Sign In
        </button>
      </SiteHeader>

      {/* Hero — single screen */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] sm:w-[700px] h-[500px] sm:h-[700px] rounded-full bg-[radial-gradient(circle,hsl(var(--dead-gold)/0.08),transparent_70%)]" />
          <div className="absolute top-1/3 left-1/4 w-[300px] sm:w-[450px] h-[300px] sm:h-[450px] rounded-full bg-[radial-gradient(circle,hsl(var(--dead-red)/0.04),transparent_70%)]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex flex-col items-center gap-6 sm:gap-8 relative z-10 text-center"
        >
          {/* SYF logo — generous sizing */}
          <div className="sm:hidden">
            <StealYourFace size={140} />
          </div>
          <div className="hidden sm:block">
            <StealYourFace size={200} />
          </div>

          {/* Tagline */}
          <h1 className="font-display text-3xl sm:text-5xl md:text-6xl tracking-tight text-foreground leading-none">
            Build your dream Dead show.
          </h1>

          {/* Ambient audio teaser */}
          <AmbientPlayer />

          {/* CTA */}
          <Button
            size="lg"
            onClick={() => navigate("/builder")}
            className="font-display text-base sm:text-lg px-10 sm:px-14 py-6 sm:py-7 bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_40px_hsl(var(--glow-gold))] tracking-widest uppercase"
          >
            Start Building
          </Button>

          {/* Secondary link */}
          <button
            onClick={() => navigate("/browse")}
            className="flex items-center gap-1 font-body text-sm text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            or browse community setlists
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      </main>

      {/* Community carousel — below the fold */}
      {featured.length > 0 && (
        <section className="py-10 sm:py-16 border-t border-border/30">
          <div className="px-4 sm:px-8 mb-5">
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-border" />
              <span className="font-display text-xs tracking-[0.2em] text-muted-foreground uppercase">
                From the community
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
          </div>

          <div className="overflow-x-auto scrollbar-hide px-4 sm:px-8">
            <div className="flex gap-4 min-w-max pb-2">
              {featured.map((setlist) => (
                <button
                  key={setlist.id}
                  onClick={() => navigate(`/setlist/${setlist.id}`)}
                  className="w-[220px] sm:w-[260px] shrink-0 border border-border/60 bg-card/50 backdrop-blur-sm rounded-lg p-5 text-left hover:border-primary/40 transition-all group"
                >
                  <h3 className="font-display text-sm text-foreground truncate group-hover:text-primary transition-colors">
                    {setlist.title}
                  </h3>
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
                    {setlist.upvote_count > 0 && (
                      <span className="text-[10px] font-body text-muted-foreground/60 ml-auto">
                        ⚡ {setlist.upvote_count}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="py-4 sm:py-6 text-center border-t border-border/50 space-y-2">
        <div className="flex items-center justify-center gap-2 text-muted-foreground text-xs sm:text-sm font-body">
          <span>Built by Deadheads, for Deadheads</span>
          <span className="mx-1">·</span>
          <DancingBear color="primary" />
          <DancingBear color="gold" />
          <DancingBear color="blue" />
        </div>
        <p className="font-hand text-xs text-muted-foreground/70 max-w-md mx-auto px-4">
          🎵 Powered by live recordings from the{" "}
          <a
            href="https://archive.org"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 text-primary/70 hover:text-primary transition-colors"
          >
            Internet Archive
          </a>
        </p>
        <button
          onClick={() => navigate("/privacy")}
          className="font-hand text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors underline underline-offset-2"
        >
          Privacy Policy
        </button>
      </footer>
    </PageLayout>
  );
};

export default Index;
