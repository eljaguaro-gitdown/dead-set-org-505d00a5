import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Globe, Lock, Music, Trash2, Calendar, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import PageLayout from "@/components/PageLayout";
import SiteHeader from "@/components/SiteHeader";
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
      <PageLayout>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 w-64 bg-muted rounded-lg" />
            ))}
          </div>
        </div>
      </PageLayout>
    );
  }

  if (!user) {
    navigate("/auth");
    return null;
  }

  const hasSetlists = !loading && setlists.length > 0;

  return (
    <PageLayout>
      <SiteHeader large>
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
          size="icon"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/profile")}
          title="Profile"
        >
          <User className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="text-muted-foreground hover:text-foreground font-body"
        >
          Sign Out
        </Button>
      </SiteHeader>

      {/* Content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        {/* Hero CTA */}
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
          <div className="space-y-0 rounded-md overflow-hidden shadow-2xl border-2 border-[hsl(25,15%,30%)]">
            {setlists.map((s, i) => {
              // Colorful chaotic tape spines like a real collection wall
              const tapeStyles = [
                { bg: "hsl(340,60%,75%)", text: "hsl(340,70%,20%)", accent: "hsl(340,50%,55%)" },   // hot pink
                { bg: "hsl(140,40%,70%)", text: "hsl(140,60%,15%)", accent: "hsl(140,40%,40%)" },   // green
                { bg: "hsl(48,70%,80%)",  text: "hsl(35,60%,18%)",  accent: "hsl(35,70%,45%)" },    // yellow
                { bg: "hsl(30,30%,88%)",  text: "hsl(25,40%,15%)",  accent: "hsl(25,30%,45%)" },    // cream/white
                { bg: "hsl(200,50%,75%)", text: "hsl(210,60%,18%)", accent: "hsl(210,50%,40%)" },   // sky blue
                { bg: "hsl(15,60%,72%)",  text: "hsl(10,50%,18%)",  accent: "hsl(10,50%,40%)" },    // salmon/orange
                { bg: "hsl(280,35%,78%)", text: "hsl(280,50%,20%)", accent: "hsl(280,40%,45%)" },   // lavender
                { bg: "hsl(60,50%,82%)",  text: "hsl(50,50%,18%)",  accent: "hsl(50,50%,40%)" },    // pale yellow
                { bg: "hsl(170,35%,72%)", text: "hsl(170,50%,15%)", accent: "hsl(170,40%,35%)" },   // teal
                { bg: "hsl(0,55%,75%)",   text: "hsl(0,50%,20%)",   accent: "hsl(0,45%,45%)" },     // red/coral
              ];
              const style = tapeStyles[i % tapeStyles.length];
              // Slight random rotation for organic feel
              const rotations = [-0.3, 0.15, -0.1, 0.25, -0.2, 0.1, -0.15, 0.3, -0.05, 0.2];
              const rot = rotations[i % rotations.length];

              return (
                <motion.button
                  key={s.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => navigate(`/builder/${s.id}`)}
                  style={{
                    backgroundColor: style.bg,
                    transform: `rotate(${rot}deg)`,
                  }}
                  className="w-full text-left flex items-stretch group hover:brightness-90 hover:scale-[1.01] transition-all duration-150 relative border-b border-[hsl(25,15%,30%/0.3)]"
                >
                  {/* Clear plastic edge effect */}
                  <div className="w-1.5 shrink-0 bg-[hsl(25,10%,40%/0.3)]" />
                  
                  {/* Colored label area */}
                  <div className="flex-1 flex items-center px-4 py-2 min-h-[2.8rem] relative overflow-hidden">
                    {/* Faint lined paper effect */}
                    <div className="absolute inset-0 opacity-[0.07]" style={{
                      backgroundImage: "repeating-linear-gradient(transparent, transparent 11px, hsl(25,30%,30%) 11px, hsl(25,30%,30%) 12px)",
                    }} />
                    
                    <div className="flex items-center gap-3 min-w-0 flex-1 relative z-10">
                      <span
                        className="font-body text-lg truncate tracking-wide"
                        style={{ color: style.text }}
                      >
                        {s.title}
                      </span>
                      {s.slot_count > 0 && (
                        <span
                          className="font-body text-sm shrink-0 opacity-70"
                          style={{ color: style.accent }}
                        >
                          {s.slot_count} songs
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0 relative z-10">
                      <span
                        className="font-body text-sm opacity-60"
                        style={{ color: style.text }}
                      >
                        {new Date(s.updated_at).toLocaleDateString()}
                      </span>
                      {s.is_public ? (
                        <Globe className="w-4 h-4 opacity-50" style={{ color: style.text }} />
                      ) : (
                        <Lock className="w-4 h-4 opacity-40" style={{ color: style.text }} />
                      )}
                      <button
                        onClick={(e) => handleDelete(s.id, e)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-destructive"
                        style={{ color: style.accent }}
                        title="Delete setlist"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Right plastic edge */}
                  <div className="w-1 shrink-0 bg-[hsl(25,10%,40%/0.2)]" />
                </motion.button>
              );
            })}
          </div>
        )}
      </main>
    </PageLayout>
  );
};

export default MySetlists;
