import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap, Search, SortAsc, Play, Music, TrendingUp, Heart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import PageLayout from "@/components/PageLayout";
import SiteHeader from "@/components/SiteHeader";
import AdSenseLoader from "@/components/AdSenseLoader";
import DancingBearButton from "@/components/DancingBearButton";
import StealYourFace from "@/components/StealYourFace";
import EraTooltip from "@/components/EraTooltip";
import FavoriteButton from "@/components/FavoriteButton";
import PlaySetlistButton from "@/components/PlaySetlistButton";
import { useFavorites } from "@/hooks/useFavorites";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Setlist = Database["public"]["Tables"]["setlists"]["Row"];
type Era = Database["public"]["Tables"]["eras"]["Row"];

interface SetlistWithMeta extends Setlist {
  slot_count: number;
  creator_name: string;
  creator_avatar: string | null;
  era_name: string | null;
  preview_songs: string[];
}

const ERA_COLORS: Record<string, string> = {
  "Primal Dead": "var(--dead-red)",
  "'72 Europe": "var(--dead-blue)",
  "Wall of Sound": "var(--dead-orange)",
  "Terrapin Era": "var(--dead-gold)",
  "'80s Dead": "var(--dead-pink)",
  "Brent Era": "var(--dead-green)",
  "Vince Era": "var(--dead-purple)",
};

const getEraColor = (eraName: string | null) => {
  if (!eraName) return "var(--primary)";
  for (const [key, color] of Object.entries(ERA_COLORS)) {
    if (eraName.toLowerCase().includes(key.toLowerCase())) return color;
  }
  return "var(--primary)";
};

const PAGE_SIZE = 18;

const Browse = () => {
  const navigate = useNavigate();
  const { isFavorite, toggleFavorite, isAuthenticated } = useFavorites();
  const [setlists, setSetlists] = useState<SetlistWithMeta[]>([]);
  const [trending, setTrending] = useState<SetlistWithMeta[]>([]);
  const [featured, setFeatured] = useState<SetlistWithMeta[]>([]);
  const [eras, setEras] = useState<Era[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [eraFilter, setEraFilter] = useState<string>("all");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "most_upvoted" | "most_played">("newest");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);

  const handleToggleFavorite = useCallback(async (setlistId: string) => {
    if (!isAuthenticated) {
      toast("Sign in to save favorites", { description: "Create an account to bookmark setlists" });
      return;
    }
    const wasFav = isFavorite(setlistId);
    await toggleFavorite(setlistId);
    toast(wasFav ? "Removed from favorites" : "Added to favorites ❤️", { duration: 1500 });
  }, [isAuthenticated, isFavorite, toggleFavorite]);

  useEffect(() => {
    supabase.from("eras").select("*").order("year_start").then(({ data }) => {
      if (data) setEras(data);
    });
  }, []);

  // Fetch featured (top 3 by upvotes) and trending (most played in last 7 days) — once
  useEffect(() => {
    const fetchFeatured = async () => {
      const { data } = await supabase
        .from("setlists")
        .select("id, title, creator_id, description, era_id, is_public, is_collaborative, play_count, upvote_count, created_at, updated_at")
        .eq("is_public", true)
        .order("upvote_count", { ascending: false })
        .limit(3);
      if (!data || data.length === 0) return;
      const enriched = await enrichSetlists(data as unknown as Setlist[]);
      setFeatured(enriched);
    };

    const fetchTrending = async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("setlists")
        .select("id, title, creator_id, description, era_id, is_public, is_collaborative, play_count, upvote_count, created_at, updated_at")
        .eq("is_public", true)
        .gt("play_count", 0)
        .gte("updated_at", sevenDaysAgo)
        .order("play_count", { ascending: false })
        .limit(6);
      if (!data || data.length === 0) return;
      const enriched = await enrichSetlists(data as unknown as Setlist[]);
      setTrending(enriched);
    };

    fetchFeatured();
    fetchTrending();
  }, []);

  // Main fetch
  useEffect(() => {
    const fetchSetlists = async () => {
      setLoading(true);
      setVisibleCount(PAGE_SIZE);

      let query = supabase.from("setlists").select("id, title, creator_id, description, era_id, is_public, is_collaborative, play_count, upvote_count, created_at, updated_at", { count: "exact" }).eq("is_public", true);
      if (eraFilter !== "all") query = query.eq("era_id", eraFilter);

      let orderCol = "created_at";
      let asc = false;
      if (sortBy === "oldest") { orderCol = "created_at"; asc = true; }
      else if (sortBy === "most_upvoted") { orderCol = "upvote_count"; }
      else if (sortBy === "most_played") { orderCol = "play_count"; }

      const { data, count } = await query.order(orderCol, { ascending: asc }).limit(200);
      if (!data) { setLoading(false); return; }
      setTotalCount(count || data.length);

      const enriched = await enrichSetlists(data as unknown as Setlist[]);
      setSetlists(enriched);
      setLoading(false);
    };
    fetchSetlists();
  }, [eraFilter, sortBy]);

  const enrichSetlists = async (data: Setlist[]): Promise<SetlistWithMeta[]> => {
    if (data.length === 0) return [];

    const ids = data.map((s) => s.id);
    const creatorIds = [...new Set(data.map((s) => s.creator_id))];
    const eraIds = [...new Set(data.map((s) => s.era_id).filter(Boolean))] as string[];

    // Parallel fetches
    const [slotsRes, profilesRes, erasRes] = await Promise.all([
      supabase.from("setlist_slots").select("setlist_id, song_id, set_number, position").in("setlist_id", ids).order("set_number").order("position"),
      supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", creatorIds),
      eraIds.length > 0 ? supabase.from("eras").select("id, name").in("id", eraIds) : Promise.resolve({ data: [] as any[] }),
    ]);

    const profileMap = new Map((profilesRes.data || []).map((p) => [p.user_id, p]));
    const eraMap = new Map((erasRes.data || []).map((e) => [e.id, e.name]));

    // Get song titles for preview
    const allSongIds = [...new Set((slotsRes.data || []).map((s) => s.song_id))];
    const { data: songsData } = allSongIds.length > 0
      ? await supabase.from("songs").select("id, title").in("id", allSongIds)
      : { data: [] as any[] };
    const songMap = new Map((songsData || []).map((s) => [s.id, s.title]));

    // Group slots by setlist
    const slotsBySetlist = new Map<string, typeof slotsRes.data>();
    for (const slot of slotsRes.data || []) {
      if (!slotsBySetlist.has(slot.setlist_id)) slotsBySetlist.set(slot.setlist_id, []);
      slotsBySetlist.get(slot.setlist_id)!.push(slot);
    }

    return data.map((s) => {
      const profile = profileMap.get(s.creator_id);
      const sSlots = slotsBySetlist.get(s.id) || [];
      const previewSongs = sSlots
        .filter((sl) => sl.set_number === 1)
        .slice(0, 4)
        .map((sl) => songMap.get(sl.song_id) || "Unknown");

      return {
        ...s,
        slot_count: sSlots.length,
        creator_name: profile?.display_name || "Unknown Head",
        creator_avatar: profile?.avatar_url || null,
        era_name: s.era_id ? eraMap.get(s.era_id) || null : null,
        preview_songs: previewSongs,
      };
    });
  };

  const filtered = useMemo(() => {
    let result = setlists
      // Hide empty/untitled setlists from public browse
      .filter((s) => s.slot_count > 0 && s.title !== "Untitled Setlist");
    if (showFavoritesOnly) {
      result = result.filter((s) => isFavorite(s.id));
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) => s.title.toLowerCase().includes(q) || s.creator_name.toLowerCase().includes(q)
      );
    }
    return result;
  }, [setlists, search, showFavoritesOnly, isFavorite]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  return (
    <PageLayout>
      <AdSenseLoader />
      <SiteHeader large>
        <DancingBearButton />
        {!isAuthenticated && (
          <button
            onClick={() => navigate("/auth")}
            className="font-display text-sm tracking-[0.15em] text-muted-foreground hover:text-primary transition-colors uppercase"
          >
            Sign In
          </button>
        )}
      </SiteHeader>

      {/* Featured Section */}
      {featured.length > 0 && (
        <section className="border-b border-border/30 py-6 sm:py-8">
          <div className="px-4 sm:px-6 max-w-6xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <Zap className="w-4 h-4 text-primary" />
              <h2 className="font-display text-sm tracking-[0.2em] text-muted-foreground uppercase">Featured Setlists</h2>
            </div>
            <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
              <div className="flex gap-4 min-w-max sm:min-w-0 sm:grid sm:grid-cols-3">
                {featured.map((s) => (
                  <FeaturedCard key={s.id} setlist={s} onClick={() => navigate(`/setlist/${s.id}`)} />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Trending Section */}
      {trending.length > 0 && (
        <section className="border-b border-border/30 py-6 sm:py-8">
          <div className="px-4 sm:px-6 max-w-6xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="w-4 h-4 text-accent" />
              <h2 className="font-display text-sm tracking-[0.2em] text-muted-foreground uppercase">Trending This Week</h2>
            </div>
            <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
              <div className="flex gap-3 min-w-max sm:min-w-0 sm:grid sm:grid-cols-3 lg:grid-cols-6">
                {trending.map((s) => (
                  <TrendingCard key={s.id} setlist={s} onClick={() => navigate(`/setlist/${s.id}`)} />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}


      <div className="border-b border-border/30 px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto space-y-3">
          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <button
                onClick={() => setShowFavoritesOnly((p) => !p)}
                className={`h-9 px-3 rounded-md border transition-colors flex items-center gap-1.5 shrink-0 ${
                  showFavoritesOnly
                    ? "bg-primary/15 border-primary/40 text-primary"
                    : "bg-card/60 border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
                }`}
                title="Show favorites only"
              >
                <Heart className={`w-3.5 h-3.5 ${showFavoritesOnly ? "fill-primary" : ""}`} />
                <span className="font-body text-xs hidden sm:inline">Favorites</span>
              </button>
            )}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search setlists or creators..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-card/60 border-border text-foreground font-body text-sm h-9"
              />
            </div>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-[140px] sm:w-[160px] bg-card/60 border-border text-foreground font-body text-xs h-9">
                <SortAsc className="w-3 h-3 mr-1 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="newest" className="font-body text-xs">Newest</SelectItem>
                <SelectItem value="most_upvoted" className="font-body text-xs">Most Upvoted</SelectItem>
                <SelectItem value="most_played" className="font-body text-xs">Most Played</SelectItem>
                <SelectItem value="oldest" className="font-body text-xs">Oldest</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Era chips */}
          <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="flex gap-2 min-w-max">
              <button
                onClick={() => setEraFilter("all")}
                className={`px-3 py-1 text-xs font-body rounded-full border transition-colors whitespace-nowrap ${
                  eraFilter === "all"
                    ? "bg-primary/15 text-primary border-primary/40"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
                }`}
              >
                All Eras
              </button>
              {eras.map((era) => {
                const color = getEraColor(era.name);
                const isActive = eraFilter === era.id;
                return (
                  <button
                    key={era.id}
                    onClick={() => setEraFilter(isActive ? "all" : era.id)}
                    className="px-3 py-1 text-xs font-body rounded-full border transition-colors whitespace-nowrap"
                    style={
                      isActive
                        ? { backgroundColor: `hsl(${color} / 0.15)`, color: `hsl(${color})`, borderColor: `hsl(${color} / 0.4)` }
                        : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }
                    }
                  >
                    {era.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 px-4 sm:px-6 py-6">
        <div className="max-w-6xl mx-auto">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-52 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <StealYourFace size={60} />
              <p className="font-display text-xl text-muted-foreground mt-4">No setlists found</p>
              <p className="font-body text-sm text-muted-foreground mt-2">
                Be the first to create and share one!
              </p>
              <button
                onClick={() => navigate("/builder")}
                className="mt-6 px-6 py-2.5 bg-primary text-primary-foreground font-body text-sm rounded-lg hover:bg-primary/90 transition-colors"
              >
                Build a Setlist
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {visible.map((setlist, i) => (
                  <SetlistCard
                    key={setlist.id}
                    setlist={setlist}
                    index={i}
                    onClick={() => navigate(`/setlist/${setlist.id}`)}
                    isFav={isFavorite(setlist.id)}
                    onToggleFav={handleToggleFavorite}
                  />
                ))}
              </div>
              {hasMore && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                    className="px-8 py-2.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 font-body text-sm transition-colors"
                  >
                    Load More
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </PageLayout>
  );
};

/** Featured card — larger, more visual */
const FeaturedCard = ({ setlist, onClick }: { setlist: SetlistWithMeta; onClick: () => void }) => {
  const eraColor = getEraColor(setlist.era_name);
  return (
    <motion.div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      className="w-[280px] sm:w-auto shrink-0 text-left rounded-xl border border-border bg-card/80 overflow-hidden group hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 cursor-pointer"
      whileHover={{ y: -4 }}
    >
      <div className="h-1.5" style={{ background: `linear-gradient(to right, hsl(${eraColor}), hsl(var(--primary)))` }} />
      <div className="p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-3">
          {setlist.creator_avatar ? (
            <img src={setlist.creator_avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
          ) : (
            <div className="w-5 h-5 rounded-full bg-muted" />
          )}
          <Link to={`/user/${setlist.creator_id}`} onClick={(e) => e.stopPropagation()} className="text-[10px] font-body text-muted-foreground hover:text-primary transition-colors">{setlist.creator_name}</Link>
          <PlaySetlistButton setlistId={setlist.id} size="md" className="ml-auto" />
        </div>
        <h3 className="font-display text-lg text-foreground group-hover:text-primary transition-colors leading-tight line-clamp-2">
          {setlist.title}
        </h3>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {setlist.era_name && (
            <EraTooltip eraName={setlist.era_name}>
              <span
                className="px-2 py-0.5 text-[10px] font-body rounded-full border cursor-help"
                style={{ borderColor: `hsl(${eraColor} / 0.4)`, color: `hsl(${eraColor})` }}
              >
                {setlist.era_name}
              </span>
            </EraTooltip>
          )}
          <span className="text-[10px] font-body text-muted-foreground">{setlist.slot_count} songs</span>
          {setlist.upvote_count > 0 && (
            <span className="text-[10px] font-body text-primary flex items-center gap-0.5">
              <Zap className="w-2.5 h-2.5 fill-primary" /> {setlist.upvote_count}
            </span>
          )}
          {setlist.play_count > 0 && (
            <span className="text-[10px] font-body text-accent flex items-center gap-0.5">
              <Play className="w-2.5 h-2.5 fill-accent" /> {setlist.play_count} plays
            </span>
          )}
        </div>
        {setlist.preview_songs.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/30">
            {setlist.preview_songs.map((name, i) => (
              <p key={i} className="text-xs font-body text-muted-foreground/70 leading-relaxed truncate">
                {name}
              </p>
            ))}
            {setlist.slot_count > 4 && (
              <p className="text-xs font-body text-muted-foreground/50 mt-0.5">
                + {setlist.slot_count - 4} more
              </p>
            )}
          </div>
        )}
      </div>
    </motion.button>
  );
};

/** Standard setlist card */
const SetlistCard = ({ setlist, index, onClick, isFav, onToggleFav }: { setlist: SetlistWithMeta; index: number; onClick: () => void; isFav: boolean; onToggleFav: (id: string) => void }) => {
  const eraColor = getEraColor(setlist.era_name);
  return (
    <motion.button
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.3) }}
      onClick={onClick}
      className="text-left rounded-lg border border-border bg-card/60 overflow-hidden group hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-300"
    >
      <div className="h-0.5" style={{ background: `hsl(${eraColor} / 0.5)` }} />
      <div className="p-4">
        {/* Creator row */}
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {setlist.creator_avatar ? (
              <img src={setlist.creator_avatar} alt="" className="w-4 h-4 rounded-full object-cover" />
            ) : (
              <div className="w-4 h-4 rounded-full bg-muted" />
            )}
            <Link to={`/user/${setlist.creator_id}`} onClick={(e) => e.stopPropagation()} className="text-[10px] font-body text-muted-foreground truncate hover:text-primary transition-colors">{setlist.creator_name}</Link>
          </div>
          <FavoriteButton isFavorite={isFav} onToggle={() => onToggleFav(setlist.id)} />
        </div>

        {/* Title */}
        <h3 className="font-display text-sm text-foreground group-hover:text-primary transition-colors leading-tight line-clamp-2">
          {setlist.title}
        </h3>

        {/* Meta row */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {setlist.era_name && (
            <EraTooltip eraName={setlist.era_name}>
              <span
                className="px-2 py-0.5 text-[9px] font-body rounded-full border cursor-help"
                style={{ borderColor: `hsl(${eraColor} / 0.35)`, color: `hsl(${eraColor})` }}
              >
                {setlist.era_name}
              </span>
            </EraTooltip>
          )}
          <span className="text-[10px] font-body text-muted-foreground">{setlist.slot_count} songs</span>
          {setlist.upvote_count > 0 && (
            <span className="text-[10px] font-body text-primary flex items-center gap-0.5">
              <Zap className="w-2.5 h-2.5 fill-primary" /> {setlist.upvote_count}
            </span>
          )}
          {setlist.play_count > 0 && (
            <span className="text-[10px] font-body text-muted-foreground flex items-center gap-0.5">
              <Play className="w-2.5 h-2.5" /> {setlist.play_count} plays
            </span>
          )}
        </div>

        {/* Song preview */}
        {setlist.preview_songs.length > 0 && (
          <div className="mt-3 pt-2 border-t border-border/20 space-y-0.5">
            {setlist.preview_songs.map((name, i) => (
              <p key={i} className="text-xs font-body text-muted-foreground/70 truncate leading-relaxed">
                {name}
              </p>
            ))}
            {setlist.slot_count > setlist.preview_songs.length && (
              <p className="text-[9px] font-body text-muted-foreground/30">
                ...and {setlist.slot_count - setlist.preview_songs.length} more
              </p>
            )}
          </div>
        )}
      </div>
    </motion.button>
  );
};

/** Trending card — compact, play-count focused */
const TrendingCard = ({ setlist, onClick }: { setlist: SetlistWithMeta; onClick: () => void }) => {
  const eraColor = getEraColor(setlist.era_name);
  return (
    <motion.button
      onClick={onClick}
      className="w-[160px] sm:w-auto shrink-0 text-left rounded-lg border border-border bg-card/60 overflow-hidden group hover:border-accent/30 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
      whileHover={{ scale: 1.02 }}
    >
      <div className="h-0.5" style={{ background: `hsl(${eraColor} / 0.5)` }} />
      <div className="p-3">
        <h3 className="font-display text-xs text-foreground group-hover:text-primary transition-colors leading-tight line-clamp-2">
          {setlist.title}
        </h3>
        <Link to={`/user/${setlist.creator_id}`} onClick={(e) => e.stopPropagation()} className="text-[9px] font-body text-muted-foreground mt-1 truncate block hover:text-primary transition-colors">{setlist.creator_name}</Link>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[10px] font-body text-accent flex items-center gap-0.5">
            <Play className="w-2.5 h-2.5 fill-accent" /> {setlist.play_count} plays
          </span>
          <span className="text-[9px] font-body text-muted-foreground">{setlist.slot_count} songs</span>
        </div>
      </div>
    </motion.button>
  );
};

export default Browse;
