import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { TrendingUp, Zap, Music, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import EraTooltip from "@/components/EraTooltip";
import type { Database } from "@/integrations/supabase/types";

type Setlist = Database["public"]["Tables"]["setlists"]["Row"];

interface SetlistCard {
  id: string;
  title: string;
  creator_name: string;
  creator_avatar: string | null;
  era_name: string | null;
  upvote_count: number;
  play_count: number;
  song_count: number;
  preview_songs: string[];
  created_at: string;
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
  if (!eraName) return "hsl(var(--primary))";
  for (const [key, color] of Object.entries(ERA_COLORS)) {
    if (eraName.toLowerCase().includes(key.toLowerCase())) return color;
  }
  return "hsl(var(--primary))";
};

const CommunityHighlights = () => {
  const navigate = useNavigate();
  const [trending, setTrending] = useState<SetlistCard[]>([]);
  const [newest, setNewest] = useState<SetlistCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const enrichSetlists = async (data: Setlist[]): Promise<SetlistCard[]> => {
      if (data.length === 0) return [];

      const ids = data.map((s) => s.id);
      const creatorIds = [...new Set(data.map((s) => s.creator_id))];
      const eraIds = [...new Set(data.map((s) => s.era_id).filter(Boolean))] as string[];

      const [slotsRes, profilesRes, erasRes] = await Promise.all([
        supabase.from("setlist_slots").select("setlist_id, song_id, set_number, position").in("setlist_id", ids).order("set_number").order("position"),
        supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", creatorIds),
        eraIds.length > 0 ? supabase.from("eras").select("id, name").in("id", eraIds) : Promise.resolve({ data: [] as any[] }),
      ]);

      const profileMap = new Map((profilesRes.data || []).map((p) => [p.user_id, p]));
      const eraMap = new Map((erasRes.data || []).map((e) => [e.id, e.name]));

      const allSongIds = [...new Set((slotsRes.data || []).map((s) => s.song_id))];
      const { data: songsData } = allSongIds.length > 0
        ? await supabase.from("songs").select("id, title").in("id", allSongIds)
        : { data: [] as any[] };
      const songMap = new Map((songsData || []).map((s) => [s.id, s.title]));

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
          .slice(0, 3)
          .map((sl) => songMap.get(sl.song_id) || "Unknown");

        return {
          id: s.id,
          title: s.title,
          creator_name: profile?.display_name || "Unknown Head",
          creator_avatar: profile?.avatar_url || null,
          era_name: s.era_id ? eraMap.get(s.era_id) || null : null,
          upvote_count: s.upvote_count,
          play_count: s.play_count,
          song_count: sSlots.length,
          preview_songs: previewSongs,
          created_at: s.created_at,
        };
      });
    };

    const fetchAll = async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [trendingRes, newestRes] = await Promise.all([
        supabase
          .from("setlists")
          .select("*")
          .eq("is_public", true)
          .gt("play_count", 0)
          .gte("updated_at", sevenDaysAgo)
          .order("play_count", { ascending: false })
          .limit(6),
        supabase
          .from("setlists")
          .select("*")
          .eq("is_public", true)
          .order("created_at", { ascending: false })
          .limit(6),
      ]);

      const [trendingEnriched, newestEnriched] = await Promise.all([
        enrichSetlists(trendingRes.data || []),
        enrichSetlists(newestRes.data || []),
      ]);

      setTrending(trendingEnriched);
      setNewest(newestEnriched);
      setLoading(false);
    };

    fetchAll();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 py-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 bg-muted/30 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  const hasContent = trending.length > 0 || newest.length > 0;
  if (!hasContent) return null;

  return (
    <div className="space-y-6">
      {/* Trending This Week */}
      {trending.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-accent" />
              <h3 className="font-display text-sm tracking-[0.15em] text-muted-foreground uppercase">
                Trending This Week
              </h3>
            </div>
            <button
              onClick={() => navigate("/browse")}
              className="flex items-center gap-1 font-body text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              See all <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
            <div className="flex gap-3 min-w-max">
              {trending.map((s, i) => (
                <SetlistMiniCard key={s.id} setlist={s} index={i} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* New From the Community */}
      {newest.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <h3 className="font-display text-sm tracking-[0.15em] text-muted-foreground uppercase">
                New From the Community
              </h3>
            </div>
            <button
              onClick={() => navigate("/browse")}
              className="flex items-center gap-1 font-body text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              See all <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
            <div className="flex gap-3 min-w-max">
              {newest.map((s, i) => (
                <SetlistMiniCard key={s.id} setlist={s} index={i} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

const SetlistMiniCard = ({ setlist, index }: { setlist: SetlistCard; index: number }) => {
  const navigate = useNavigate();
  const eraColor = getEraColor(setlist.era_name);

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={() => navigate(`/setlist/${setlist.id}`)}
      className="w-[200px] sm:w-[220px] shrink-0 border border-border/40 bg-card/60 backdrop-blur-sm rounded-lg p-4 text-left hover:border-primary/40 hover:shadow-[0_4px_20px_hsl(var(--primary)/0.1)] transition-all group"
    >
      <h4 className="font-display text-sm text-foreground truncate group-hover:text-primary transition-colors leading-tight">
        {setlist.title}
      </h4>
      <p className="font-body text-[11px] text-muted-foreground mt-1 truncate">
        by {setlist.creator_name}
      </p>

      {/* Song preview */}
      {setlist.preview_songs.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {setlist.preview_songs.map((song, i) => (
            <p key={i} className="font-body text-xs text-muted-foreground/70 truncate leading-snug">
              {song}
            </p>
          ))}
          {setlist.song_count > 3 && (
            <p className="font-body text-xs text-muted-foreground/50">
              +{setlist.song_count - 3} more
            </p>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 mt-2.5">
        {setlist.era_name && (
          <EraTooltip eraName={setlist.era_name}>
            <span
              className="px-1.5 py-0.5 text-[9px] font-marker rounded-sm border"
              style={{
                borderColor: eraColor,
                color: eraColor,
                backgroundColor: `color-mix(in srgb, ${eraColor} 10%, transparent)`,
              }}
            >
              {setlist.era_name}
            </span>
          </EraTooltip>
        )}
        {setlist.play_count > 0 && (
          <span className="text-[10px] font-body text-muted-foreground/50 flex items-center gap-0.5">
            ▶ {setlist.play_count}
          </span>
        )}
        {setlist.upvote_count > 0 && (
          <span className="text-[10px] font-body text-muted-foreground/50 flex items-center gap-0.5">
            ⚡ {setlist.upvote_count}
          </span>
        )}
        <span className="text-[10px] font-body text-muted-foreground/40 ml-auto">
          <Music className="w-2.5 h-2.5 inline mr-0.5" />
          {setlist.song_count}
        </span>
      </div>
    </motion.button>
  );
};

export default CommunityHighlights;
