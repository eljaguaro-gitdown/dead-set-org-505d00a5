import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Clock, Filter, SortAsc, Search, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import PageLayout from "@/components/PageLayout";
import SiteHeader from "@/components/SiteHeader";
import AdSenseLoader from "@/components/AdSenseLoader";
import type { Database } from "@/integrations/supabase/types";

type Setlist = Database["public"]["Tables"]["setlists"]["Row"];
type Era = Database["public"]["Tables"]["eras"]["Row"];

interface SetlistWithMeta extends Setlist {
  slot_count: number;
  creator_name: string;
  era_name: string | null;
}

const Browse = () => {
  const navigate = useNavigate();
  const [setlists, setSetlists] = useState<SetlistWithMeta[]>([]);
  const [eras, setEras] = useState<Era[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [eraFilter, setEraFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "title" | "most_upvoted">("newest");

  useEffect(() => {
    const fetchEras = async () => {
      const { data } = await supabase.from("eras").select("*").order("year_start");
      if (data) setEras(data);
    };
    fetchEras();
  }, []);

  useEffect(() => {
    const fetchSetlists = async () => {
      setLoading(true);
      let query = supabase.from("setlists").select("*").eq("is_public", true);
      if (eraFilter !== "all") query = query.eq("era_id", eraFilter);
      const { data: setlistData } = await query.order("created_at", { ascending: false });
      if (!setlistData) { setLoading(false); return; }

      const enriched = await Promise.all(
        setlistData.map(async (s) => {
          const [slotsRes, profileRes, eraRes] = await Promise.all([
            supabase.from("setlist_slots").select("id", { count: "exact", head: true }).eq("setlist_id", s.id),
            supabase.from("profiles").select("display_name").eq("user_id", s.creator_id).single(),
            s.era_id ? supabase.from("eras").select("name").eq("id", s.era_id).single() : Promise.resolve({ data: null }),
          ]);
          return {
            ...s,
            slot_count: slotsRes.count || 0,
            creator_name: profileRes.data?.display_name || "Unknown Head",
            era_name: eraRes.data?.name || null,
          } as SetlistWithMeta;
        })
      );
      setSetlists(enriched);
      setLoading(false);
    };
    fetchSetlists();
  }, [eraFilter]);

  const filtered = useMemo(() => {
    let result = setlists.filter((s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.creator_name.toLowerCase().includes(search.toLowerCase())
    );
    result.sort((a, b) => {
      if (sortBy === "most_upvoted") return ((b as any).upvote_count || 0) - ((a as any).upvote_count || 0);
      if (sortBy === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return a.title.localeCompare(b.title);
    });
    return result;
  }, [setlists, search, sortBy]);

  return (
    <PageLayout>
      <SiteHeader large>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/auth")}
          className="font-body border-border text-foreground"
        >
          Sign Up / Log In
        </Button>
      </SiteHeader>

      {/* Filters */}
      <div className="border-b border-border/50 px-3 sm:px-4 py-3">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <div className="relative flex-1 min-w-0">
            <Input
              placeholder="Search setlists..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-card/80 backdrop-blur-sm border-border text-foreground font-body text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Select value={eraFilter} onValueChange={setEraFilter}>
              <SelectTrigger className="flex-1 sm:w-[180px] bg-card/80 backdrop-blur-sm border-border text-foreground font-body text-xs h-9">
                <Filter className="w-3 h-3 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="All eras" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all" className="font-body text-xs">All eras</SelectItem>
                {eras.map((era) => (
                  <SelectItem key={era.id} value={era.id} className="font-body text-xs">
                    {era.name} ({era.year_start}–{era.year_end})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="flex-1 sm:w-[160px] bg-card/80 backdrop-blur-sm border-border text-foreground font-body text-xs h-9">
                <SortAsc className="w-3 h-3 mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="newest" className="font-body text-xs">Newest</SelectItem>
                <SelectItem value="most_upvoted" className="font-body text-xs">Most Upvoted</SelectItem>
                <SelectItem value="oldest" className="font-body text-xs">Oldest</SelectItem>
                <SelectItem value="title" className="font-body text-xs">A–Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 px-4 py-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="font-display text-2xl text-foreground mb-3">Browse Setlists</h1>
            <p className="font-body text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Explore dream Grateful Dead setlists curated by fellow Deadheads. From the Primal Dead era through the Final Run, 
              discover unique combinations of jams, deep cuts, and crowd favorites spanning 1965–1995. 
              Find inspiration for your own setlist or upvote your favorites.
            </p>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-48 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <p className="font-display text-xl text-muted-foreground">No setlists found</p>
              <p className="font-body text-sm text-muted-foreground mt-2">
                Be the first to create and share one!
              </p>
              <Button onClick={() => navigate("/auth")} className="mt-6 bg-primary text-primary-foreground font-body">
                Create a Setlist
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((setlist, i) => (
                <motion.div
                  key={setlist.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => navigate(`/setlist/${setlist.id}`)}
                  className="group cursor-pointer rounded-lg border border-border bg-card/80 backdrop-blur-sm hover:border-primary/40 transition-all duration-300 overflow-hidden"
                >
                  <div className="h-2 bg-gradient-to-r from-primary via-accent to-secondary" />
                  <div className="p-5">
                    <h3 className="font-display text-base text-foreground group-hover:text-primary transition-colors truncate">
                      {setlist.title}
                    </h3>
                    <p className="font-body text-xs text-muted-foreground mt-1">by {setlist.creator_name}</p>
                    <div className="flex items-center gap-3 mt-3 flex-wrap">
                      {setlist.era_name && (
                        <span className="px-2 py-0.5 text-[10px] font-body text-accent border border-accent/30 rounded-full">
                          {setlist.era_name}
                        </span>
                      )}
                      <span className="text-[10px] font-body text-muted-foreground">{setlist.slot_count} songs</span>
                      {((setlist as any).upvote_count || 0) > 0 && (
                        <span className="text-[10px] font-body text-primary flex items-center gap-0.5">
                          <ThumbsUp className="w-2.5 h-2.5" />
                          {(setlist as any).upvote_count}
                        </span>
                      )}
                      <span className="text-[10px] font-body text-muted-foreground flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {new Date(setlist.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
};

export default Browse;
