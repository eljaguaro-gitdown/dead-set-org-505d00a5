import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Globe, Lock, Music, Trash2, Calendar, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import StealYourFace from "@/components/StealYourFace";
import DancingBear from "@/components/DancingBear";
import type { Database } from "@/integrations/supabase/types";

type SetlistRow = Database["public"]["Tables"]["setlists"]["Row"];

interface SetlistWithMeta extends SetlistRow {
  slot_count: number;
}

const MySetlists = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const [setlists, setSetlists] = useState<SetlistWithMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchSetlists = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("setlists")
        .select("*")
        .eq("creator_id", user.id)
        .order("updated_at", { ascending: false });

      if (data && data.length > 0) {
        const counts = await Promise.all(
          data.map((s) =>
            supabase
              .from("setlist_slots")
              .select("id", { count: "exact", head: true })
              .eq("setlist_id", s.id)
          )
        );
        setSetlists(
          data.map((s, i) => ({ ...s, slot_count: counts[i].count || 0 }))
        );
      } else {
        setSetlists([]);
      }
      setLoading(false);
    };
    fetchSetlists();
  }, [user]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this setlist?")) return;
    await supabase.from("setlist_slots").delete().eq("setlist_id", id);
    await supabase.from("setlists").delete().eq("id", id);
    setSetlists((prev) => prev.filter((s) => s.id !== id));
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 w-64 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    navigate("/auth");
    return null;
  }

  const hasSetlists = !loading && setlists.length > 0;

  return (
    <div className="grain-overlay min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="flex items-center gap-2">
            <StealYourFace size={28} />
            <span className="font-display text-lg text-foreground">Dead Set</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-border text-foreground font-body gap-1.5"
            onClick={() => navigate("/browse")}
          >
            <Search className="w-3.5 h-3.5" /> Browse
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="text-muted-foreground hover:text-foreground font-body"
          >
            Sign Out
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        {/* Hero CTA — always visible */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <button
            onClick={() => navigate("/builder")}
            className="w-full group relative overflow-hidden rounded-xl border-2 border-dashed border-primary/30 hover:border-primary/60 bg-primary/5 hover:bg-primary/10 transition-all p-6 sm:p-8 text-center"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-colors">
                <Plus className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h2 className="font-display text-xl sm:text-2xl text-foreground">
                  Create a New Setlist
                </h2>
                <p className="font-body text-sm text-muted-foreground mt-1">
                  Pick your songs, arrange sets, and share the music
                </p>
              </div>
            </div>
            {/* Subtle glow */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.08),transparent_70%)]" />
          </button>
        </motion.div>

        {/* Setlists list */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg text-foreground">My Setlists</h2>
          {hasSetlists && (
            <span className="text-xs text-muted-foreground font-body">
              {setlists.length} setlist{setlists.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-18 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : setlists.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-center py-10"
          >
            <div className="flex justify-center gap-1 mb-3">
              <DancingBear color="primary" />
              <DancingBear color="gold" />
              <DancingBear color="blue" />
            </div>
            <p className="text-muted-foreground font-body text-sm">
              No setlists yet — hit the button above to get started!
            </p>
          </motion.div>
        ) : (
          <div className="space-y-2">
            {setlists.map((s, i) => (
              <motion.button
                key={s.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => navigate(`/builder/${s.id}`)}
                className="w-full text-left bg-card border border-border rounded-lg p-4 hover:border-primary/40 transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-base text-foreground truncate">
                        {s.title}
                      </h3>
                      {s.is_public ? (
                        <Globe className="w-3.5 h-3.5 text-accent shrink-0" />
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground font-body">
                      <span className="flex items-center gap-1">
                        <Music className="w-3 h-3" /> {s.slot_count} song{s.slot_count !== 1 ? "s" : ""}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {new Date(s.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDelete(s.id, e)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-muted-foreground hover:text-destructive"
                    title="Delete setlist"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default MySetlists;
