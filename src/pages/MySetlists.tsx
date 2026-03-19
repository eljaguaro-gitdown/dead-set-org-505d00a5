import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Globe, Lock, Music, Trash2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import StealYourFace from "@/components/StealYourFace";
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
        // Get slot counts
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
            className="border-border text-foreground font-body"
            onClick={() => navigate("/browse")}
          >
            Browse
          </Button>
          <Button
            size="sm"
            className="font-body gap-1.5"
            onClick={() => navigate("/builder")}
          >
            <Plus className="w-3.5 h-3.5" /> New Setlist
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
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-2xl text-foreground">My Setlists</h1>
          <span className="text-sm text-muted-foreground font-body">
            {setlists.length} setlist{setlists.length !== 1 ? "s" : ""}
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : setlists.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16 space-y-4"
          >
            <Music className="w-12 h-12 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground font-body">
              You haven't created any setlists yet.
            </p>
            <Button onClick={() => navigate("/builder")} className="font-body gap-1.5">
              <Plus className="w-4 h-4" /> Create Your First Setlist
            </Button>
          </motion.div>
        ) : (
          <div className="space-y-2">
            {setlists.map((s, i) => (
              <motion.button
                key={s.id}
                initial={{ opacity: 0, y: 10 }}
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
