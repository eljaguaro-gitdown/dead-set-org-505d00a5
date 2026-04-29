import { useNavigate, Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAudioSignature } from "@/hooks/useAudioSignature";
import { getVariant } from "@/lib/abTest";
import { COMMUNITY_FEED_OPTIMISTIC_INSERT, type CommunityFeedSetlist } from "@/lib/communityFeedEvents";

import PageLayout from "@/components/PageLayout";
import SiteHeader from "@/components/SiteHeader";

import HeroSection from "@/components/landing/HeroSection";
import HowItWorks from "@/components/landing/HowItWorks";
import PersonalNote from "@/components/landing/PersonalNote";
import { BROWSE_COMMUNITY_STORAGE_KEY, COMMUNITY_SECTION_ID } from "@/components/landing/BrowseCommunityLink";
import ShareAppButton from "@/components/ShareAppButton";
import LastUpdatedBadge from "@/components/LastUpdatedBadge";
import { Button } from "@/components/ui/button";
import { ChevronRight, Instagram } from "lucide-react";

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
  created_at: string;
}

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  useAudioSignature();
  const [featured, setFeatured] = useState<FeaturedSetlist[]>([]);
  const [topRated, setTopRated] = useState<FeaturedSetlist[]>([]);

  // A/B test: variant B auto-starts the wizard (first landing only)
  useEffect(() => {
    if (loading) return;
    if (user) return;

    // Never redirect during an OAuth return
    const isOAuthReturn =
      window.location.hash.includes("access_token") ||
      window.location.hash.includes("refresh_token") ||
      new URLSearchParams(window.location.search).has("code");
    if (isOAuthReturn) return;

    // Only redirect once per session — if the user navigated back to "/",
    // don't hijack them again.
    const alreadyRedirected = sessionStorage.getItem("ds_ab_redirected");
    if (alreadyRedirected) return;

    // Don't auto-redirect returning visitors — only truly new ones
    const isReturningVisitor = localStorage.getItem("ds_visitor_id");
    if (isReturningVisitor) return;

    const variant = getVariant();
    if (variant === "B") {
      sessionStorage.setItem("ds_ab_redirected", "1");
      navigate("/builder?wizard=true", { replace: true });
    }
  }, [navigate, user, loading]);

  useEffect(() => {
    const fetchFeatured = async () => {
      const { data: setlists } = await supabase
        .from("setlists")
        .select("id, title, creator_id, era_id, upvote_count, play_count, created_at")
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(6);

      if (!setlists || setlists.length === 0) return;

      const sorted = setlists;

      // Run all three lookups in parallel instead of sequentially
      const creatorIds = [...new Set(sorted.map((s) => s.creator_id))];
      const eraIds = [...new Set(sorted.map((s) => s.era_id).filter(Boolean))] as string[];
      const setlistIds = sorted.map((s) => s.id);

      const [profilesRes, erasRes, slotsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name").in("user_id", creatorIds),
        eraIds.length > 0
          ? supabase.from("eras").select("id, name").in("id", eraIds)
          : Promise.resolve({ data: [] as { id: string; name: string }[] }),
        supabase.from("setlist_slots").select("setlist_id").in("setlist_id", setlistIds),
      ]);

      const profileMap = new Map((profilesRes.data || []).map((p) => [p.user_id, p.display_name]));
      const eraMap = new Map(((erasRes.data || []) as { id: string; name: string }[]).map((e) => [e.id, e.name]));
      const countMap = new Map<string, number>();
      (slotsRes.data || []).forEach((s) => {
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

    const handleOptimisticInsert = (event: Event) => {
      const { detail } = event as CustomEvent<CommunityFeedSetlist>;

      setFeatured((prev) => {
        const next = [detail, ...prev.filter((item) => item.id !== detail.id)];
        return next
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 6);
      });
    };

    fetchFeatured();

    const channel = supabase
      .channel("landing-community-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "setlists" },
        (payload) => {
          const newSetlist = payload.new as {
            is_public: boolean | null;
          };

          if (!newSetlist.is_public) return;
          fetchFeatured();
        }
      )
      .subscribe();

    window.addEventListener(COMMUNITY_FEED_OPTIMISTIC_INSERT, handleOptimisticInsert as EventListener);

    return () => {
      window.removeEventListener(COMMUNITY_FEED_OPTIMISTIC_INSERT, handleOptimisticInsert as EventListener);
      supabase.removeChannel(channel);
    };
  }, []);

  // Top rated community setlists — sorted by upvotes, then play count
  useEffect(() => {
    const fetchTopRated = async () => {
      const { data: setlists } = await supabase
        .from("setlists")
        .select("id, title, creator_id, era_id, upvote_count, play_count, created_at")
        .eq("is_public", true)
        .gt("upvote_count", 0)
        .order("upvote_count", { ascending: false })
        .order("play_count", { ascending: false })
        .limit(8);

      if (!setlists || setlists.length === 0) return;

      const creatorIds = [...new Set(setlists.map((s) => s.creator_id))];
      const eraIds = [...new Set(setlists.map((s) => s.era_id).filter(Boolean))] as string[];
      const setlistIds = setlists.map((s) => s.id);

      const [profilesRes, erasRes, slotsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name").in("user_id", creatorIds),
        eraIds.length > 0
          ? supabase.from("eras").select("id, name").in("id", eraIds)
          : Promise.resolve({ data: [] as { id: string; name: string }[] }),
        supabase.from("setlist_slots").select("setlist_id").in("setlist_id", setlistIds),
      ]);

      const profileMap = new Map((profilesRes.data || []).map((p) => [p.user_id, p.display_name]));
      const eraMap = new Map(((erasRes.data || []) as { id: string; name: string }[]).map((e) => [e.id, e.name]));
      const countMap = new Map<string, number>();
      (slotsRes.data || []).forEach((s) => {
        countMap.set(s.setlist_id, (countMap.get(s.setlist_id) || 0) + 1);
      });

      setTopRated(
        setlists.map((s) => ({
          ...s,
          creator_name: profileMap.get(s.creator_id) || "Unknown",
          era_name: s.era_id ? eraMap.get(s.era_id) || undefined : undefined,
          song_count: countMap.get(s.id) || 0,
        }))
      );
    };
    fetchTopRated();
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
          <>
            <button
              onClick={() => navigate("/my-setlists")}
              className="font-mono text-xs sm:text-[10px] tracking-[0.2em] text-muted-foreground hover:text-primary transition-colors uppercase min-h-[44px] flex items-center"
            >
              My Setlists
            </button>
            <button
              onClick={() => navigate("/backstage")}
              className="font-display italic text-sm sm:text-base tracking-wide text-[#0D0D0D] bg-gradient-to-r from-[#C9A84C] to-[#E8D48B] hover:from-[#E8D48B] hover:to-[#C9A84C] transition-all duration-300 rounded-md px-5 py-2.5 min-h-[44px] flex items-center gap-2 shadow-[0_0_20px_rgba(201,168,76,0.3)] hover:shadow-[0_0_28px_rgba(201,168,76,0.5)]"
            >
              🎟️ Backstage
            </button>
          </>
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
      <HeroSection showReturningSignIn={!user} featured={featured} />

      {/* How It Works — 3 steps */}
      <HowItWorks />

      {/* Personal note — the soul (humans before algorithms) */}
      <PersonalNote />

      {/* Top Community Setlists — sorted by upvotes */}
      {topRated.length > 0 && (
        <section id="top-community" className="py-16 sm:py-24 border-t border-border/30">
          <div className="px-6 sm:px-12 mb-10 max-w-3xl mx-auto text-center">
            <div className="font-mono text-[10px] tracking-[0.3em] text-primary/70 uppercase mb-3">
              ⚡ Most Loved
            </div>
            <h2 className="font-display italic text-3xl sm:text-5xl text-primary leading-tight">
              Top Community Setlists
            </h2>
            <p className="font-body text-base sm:text-lg text-muted-foreground mt-4 max-w-xl mx-auto">
              The ones other Deadheads keep coming back to. Ranked by likes and plays.
            </p>
          </div>

          <div className="overflow-x-auto scrollbar-hide px-6 sm:px-12 snap-x snap-mandatory">
            <div className="flex gap-4 sm:gap-5 min-w-max pb-2">
              {topRated.map((setlist, i) => (
                <motion.button
                  key={setlist.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.4 }}
                  onClick={() => navigate(`/setlist/${setlist.id}`)}
                  className="relative w-[240px] sm:w-[300px] shrink-0 snap-start border border-primary/30 bg-card rounded-xl p-4 sm:p-5 text-left hover:border-primary hover:-translate-y-0.5 transition-all duration-200 group shadow-[0_0_24px_rgba(201,168,76,0.05)] hover:shadow-[0_0_32px_rgba(201,168,76,0.15)]"
                >
                  {/* Rank badge */}
                  <div className="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-primary text-primary-foreground font-display font-bold text-sm flex items-center justify-center shadow-md">
                    {i + 1}
                  </div>
                  <div className="flex items-start justify-between gap-2 mt-1">
                    <h3 className="font-display text-base font-bold text-foreground truncate group-hover:text-primary transition-colors">
                      {setlist.title}
                    </h3>
                  </div>
                  <Link
                    to={`/user/${setlist.creator_id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-body text-sm text-muted-foreground mt-1 truncate block hover:text-primary transition-colors"
                  >
                    by {setlist.creator_name}
                  </Link>
                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-sm font-mono text-primary tabular-nums">
                      ⚡ {setlist.upvote_count}
                    </span>
                    {setlist.play_count > 0 && (
                      <span className="text-sm font-mono text-muted-foreground/70 tabular-nums">
                        ▶ {setlist.play_count}
                      </span>
                    )}
                    {setlist.era_name && (
                      <span className="px-2 py-0.5 text-[10px] font-mono rounded-md border border-primary/20 text-primary/70 tracking-wider uppercase">
                        {setlist.era_name}
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
              onClick={() => navigate("/browse?sort=top")}
              className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground hover:text-primary uppercase gap-1.5"
            >
              See the full leaderboard
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </section>
      )}

      {/* Community section — elevated and prominent */}
      {featured.length > 0 && (
        <section id="community" className="py-16 sm:py-24 border-t border-border/30 bg-[#0d0d0d]">
          <div className="px-6 sm:px-12 mb-10 max-w-3xl mx-auto text-center">
            <div className="font-mono text-[10px] tracking-[0.3em] text-primary/70 uppercase mb-3">
              From the community
            </div>
            <h2 className="font-display italic text-3xl sm:text-5xl text-primary leading-tight">
              What other heads are spinning
            </h2>
            <p className="font-body text-base sm:text-lg text-muted-foreground mt-4 max-w-xl mx-auto">
              Real setlists built by real Deadheads — discover a night you've never heard,
              or recreate one you'll never forget.
            </p>
            <Button
              onClick={() => navigate("/browse")}
              className="mt-6 bg-primary text-primary-foreground hover:bg-primary/90 font-display gap-2 h-12 px-6 text-base"
            >
              Browse all setlists
              <ChevronRight className="w-4 h-4" />
            </Button>
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
                  className="w-[220px] sm:w-[280px] shrink-0 snap-start border border-border bg-card rounded-xl p-4 sm:p-5 text-left hover:border-primary/50 hover:-translate-y-0.5 transition-all duration-200 group"
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
                  <Link to={`/user/${setlist.creator_id}`} onClick={(e) => e.stopPropagation()} className="font-body text-xs text-muted-foreground mt-1 truncate block hover:text-primary transition-colors">
                    by {setlist.creator_name}
                  </Link>
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
        </section>
      )}

      {/* Minimal footer */}
      <footer className="py-8 border-t border-border/30">
          <div className="flex flex-col items-center gap-3">
            <LastUpdatedBadge />
            <ShareAppButton variant="full" />
            <a
              href="https://instagram.com/grateful_jaguaro"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground/70 hover:text-primary tracking-wider transition-colors"
              aria-label="Follow Dead-Set.Org on Instagram"
            >
              <Instagram className="w-3.5 h-3.5" />
              <span>@grateful_jaguaro</span>
            </a>
            <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground/40 tracking-wider">
              <span>© Dead-Set.Org</span>
              <span>·</span>
              <Link to="/updates" className="hover:text-muted-foreground transition-colors">Build Notes</Link>
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
