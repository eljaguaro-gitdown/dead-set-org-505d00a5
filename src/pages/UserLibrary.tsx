import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Music, Play, Zap, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import PageLayout from "@/components/PageLayout";
import SiteHeader from "@/components/SiteHeader";
import DancingBearButton from "@/components/DancingBearButton";
import EraTooltip from "@/components/EraTooltip";
import FavoriteButton from "@/components/FavoriteButton";
import { useFavorites } from "@/hooks/useFavorites";
import { toast } from "sonner";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface SetlistWithMeta {
  id: string;
  title: string;
  era_name: string | null;
  upvote_count: number;
  play_count: number;
  slot_count: number;
  preview_songs: string[];
  created_at: string;
}

interface UserProfile {
  display_name: string | null;
  avatar_url: string | null;
  user_id: string;
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

const UserLibrary = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { isFavorite, toggleFavorite, isAuthenticated } = useFavorites();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [setlists, setSetlists] = useState<SetlistWithMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const fetch = async () => {
      setLoading(true);

      // Fetch profile and public setlists in parallel
      const [profileRes, setlistsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, avatar_url").eq("user_id", userId).single(),
        supabase
          .from("setlists")
          .select("id, title, era_id, play_count, upvote_count, created_at")
          .eq("creator_id", userId)
          .eq("is_public", true)
          .order("created_at", { ascending: false }),
      ]);

      if (profileRes.data) setProfile(profileRes.data);

      const data = setlistsRes.data || [];
      if (data.length === 0) {
        setSetlists([]);
        setLoading(false);
        return;
      }

      const ids = data.map((s) => s.id);
      const eraIds = [...new Set(data.map((s) => s.era_id).filter(Boolean))] as string[];

      const [slotsRes, erasRes] = await Promise.all([
        supabase.from("setlist_slots").select("setlist_id, song_id, set_number, position").in("setlist_id", ids).order("set_number").order("position"),
        eraIds.length > 0 ? supabase.from("eras").select("id, name").in("id", eraIds) : Promise.resolve({ data: [] as any[] }),
      ]);

      const eraMap = new Map((erasRes.data || []).map((e: any) => [e.id, e.name]));
      const allSongIds = [...new Set((slotsRes.data || []).map((s) => s.song_id))];
      const { data: songsData } = allSongIds.length > 0
        ? await supabase.from("songs").select("id, title").in("id", allSongIds)
        : { data: [] as any[] };
      const songMap = new Map((songsData || []).map((s: any) => [s.id, s.title]));

      const slotsBySetlist = new Map<string, any[]>();
      for (const slot of slotsRes.data || []) {
        if (!slotsBySetlist.has(slot.setlist_id)) slotsBySetlist.set(slot.setlist_id, []);
        slotsBySetlist.get(slot.setlist_id)!.push(slot);
      }

      const enriched: SetlistWithMeta[] = data
        .map((s) => {
          const slots = slotsBySetlist.get(s.id) || [];
          const preview = slots.filter((sl) => sl.set_number === 1).slice(0, 4).map((sl) => songMap.get(sl.song_id) || "Unknown");
          return {
            id: s.id,
            title: s.title,
            era_name: s.era_id ? eraMap.get(s.era_id) || null : null,
            upvote_count: s.upvote_count,
            play_count: s.play_count,
            slot_count: slots.length,
            preview_songs: preview,
            created_at: s.created_at,
          };
        })
        .filter((s) => s.slot_count > 0 && s.title !== "Untitled Setlist");

      setSetlists(enriched);
      setLoading(false);
    };

    fetch();
  }, [userId]);

  const handleToggleFav = async (id: string) => {
    if (!isAuthenticated) {
      toast("Sign in to save favorites", { description: "Create an account to bookmark setlists" });
      return;
    }
    const wasFav = isFavorite(id);
    await toggleFavorite(id);
    toast(wasFav ? "Removed from favorites" : "Added to favorites ❤️", { duration: 1500 });
  };

  const displayName = profile?.display_name || "Unknown Head";

  return (
    <PageLayout>
      <SiteHeader large>
        <DancingBearButton />
      </SiteHeader>

      <div className="px-4 sm:px-6 max-w-6xl mx-auto py-8">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 font-body text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {/* Profile header */}
        <div className="flex items-center gap-4 mb-8">
          <Avatar className="w-14 h-14">
            {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={displayName} />}
            <AvatarFallback className="bg-muted text-muted-foreground font-display text-lg">
              {displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="font-display text-2xl text-foreground">{displayName}</h1>
            <p className="font-body text-sm text-muted-foreground">
              {loading ? "Loading..." : `${setlists.length} public setlist${setlists.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

        {/* Setlist grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-52 bg-muted/30 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : setlists.length === 0 ? (
          <div className="text-center py-20">
            <Music className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-display text-lg text-muted-foreground">No public setlists yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {setlists.map((setlist, i) => {
              const eraColor = getEraColor(setlist.era_name);
              return (
                <motion.button
                  key={setlist.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  onClick={() => navigate(`/setlist/${setlist.id}`)}
                  className="text-left rounded-lg border border-border bg-card/60 overflow-hidden group hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="h-0.5" style={{ background: `hsl(${eraColor} / 0.5)` }} />
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-display text-sm text-foreground group-hover:text-primary transition-colors leading-tight line-clamp-2">
                        {setlist.title}
                      </h3>
                      <FavoriteButton isFavorite={isFavorite(setlist.id)} onToggle={() => handleToggleFav(setlist.id)} />
                    </div>
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
                          <Play className="w-2.5 h-2.5" /> {setlist.play_count}
                        </span>
                      )}
                    </div>
                    {setlist.preview_songs.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-border/20 space-y-0.5">
                        {setlist.preview_songs.map((name, j) => (
                          <p key={j} className="text-xs font-body text-muted-foreground/70 truncate leading-relaxed">{name}</p>
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
            })}
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default UserLibrary;
