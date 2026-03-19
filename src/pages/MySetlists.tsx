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
          <div className="space-y-0 border border-border/50 rounded-md overflow-hidden shadow-lg">
            {setlists.map((s, i) => {
              // Cycle through tape brand colors like real collections
              const spineColors = [
                "bg-[hsl(35,40%,88%)]", // cream/white label
                "bg-[hsl(35,30%,82%)]", // aged white
                "bg-[hsl(40,45%,85%)]", // warm ivory
                "bg-[hsl(210,15%,85%)]", // cool grey-blue
                "bg-[hsl(45,50%,87%)]", // yellowish
                "bg-[hsl(30,20%,80%)]", // neutral tan
              ];
              const brandColors = [
                "bg-dead-blue", // TDK blue
                "bg-dead-red",  // Maxell red
                "bg-primary",   // gold accent
                "bg-dead-green",
                "bg-dead-purple",
                "bg-dead-orange",
              ];
              const spineColor = spineColors[i % spineColors.length];
              const brandColor = brandColors[i % brandColors.length];

              return (
                <motion.button
                  key={s.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => navigate(`/builder/${s.id}`)}
                  className={`w-full text-left flex items-stretch group border-b border-border/30 last:border-b-0 hover:brightness-95 transition-all ${spineColor}`}
                >
                  {/* Brand color strip (like TDK/Maxell side label) */}
                  <div className={`w-3 shrink-0 ${brandColor}`} />
                  
                  {/* Spine content — mimics handwritten cassette label */}
                  <div className="flex-1 flex items-center justify-between px-4 py-2.5 min-h-[3rem]">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="font-body text-base text-[hsl(25,30%,20%)] truncate font-medium tracking-wide">
                        {s.title}
                      </span>
                      <span className="font-body text-xs text-[hsl(25,20%,40%)] shrink-0">
                        {s.slot_count > 0 ? `${s.slot_count} songs` : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-body text-xs text-[hsl(25,20%,45%)]">
                        {new Date(s.updated_at).toLocaleDateString()}
                      </span>
                      {s.is_public ? (
                        <Globe className="w-3.5 h-3.5 text-[hsl(25,20%,40%)]" />
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-[hsl(25,15%,55%)]" />
                      )}
                      <button
                        onClick={(e) => handleDelete(s.id, e)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-[hsl(25,20%,45%)] hover:text-destructive"
                        title="Delete setlist"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Right brand strip */}
                  <div className={`w-2 shrink-0 ${brandColor} opacity-60`} />
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
