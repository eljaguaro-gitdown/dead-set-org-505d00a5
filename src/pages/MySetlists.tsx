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
type EraRow = Database["public"]["Tables"]["eras"]["Row"];

interface SetlistWithMeta extends SetlistRow {
  slot_count: number;
  era?: EraRow | null;
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
        .select("*, eras(*)")
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
          data.map((s, i) => ({
            ...s,
            slot_count: counts[i].count || 0,
            era: (s as any).eras || null,
          }))
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
          <div
            className="rounded overflow-hidden relative"
            style={{
              boxShadow: "inset 0 3px 12px rgba(0,0,0,0.5), inset 0 -3px 12px rgba(0,0,0,0.4), 0 12px 40px rgba(0,0,0,0.6)",
              background: "linear-gradient(180deg, hsl(25,12%,10%) 0%, hsl(25,10%,16%) 2%, hsl(25,10%,16%) 98%, hsl(25,12%,8%) 100%)",
              // Film grain + warm color cast like a 70s/80s photo
              filter: "saturate(0.85) contrast(1.05)",
            }}
          >
            {/* Warm photo vignette overlay */}
            <div className="absolute inset-0 z-30 pointer-events-none rounded" style={{
              background: "radial-gradient(ellipse at center, transparent 50%, rgba(15,8,2,0.5) 100%)",
            }} />
            
            {setlists.map((s, i) => {
              // Real cassette spine colors — faded pastels, some bright, some aged
              const tapeStyles = [
                { bg: "linear-gradient(90deg, #8a7d6e 0%, #d4c8b8 4%, #d4c8b8 96%, #8a7d6e 100%)", labelBg: "#e8a0b0", labelBorder: "#c07888", text: "#2a1510", sub: "#5a4030" },
                { bg: "linear-gradient(90deg, #7a7268 0%, #c8d4b8 4%, #c8d4b8 96%, #7a7268 100%)", labelBg: "#88c898", labelBorder: "#58a068", text: "#0a2810", sub: "#2a5030" },
                { bg: "linear-gradient(90deg, #8a8070 0%, #e8dcc0 4%, #e8dcc0 96%, #8a8070 100%)", labelBg: "#e8d070", labelBorder: "#c0a840", text: "#2a2008", sub: "#585020" },
                { bg: "linear-gradient(90deg, #7a7570 0%, #d0ccc8 4%, #d0ccc8 96%, #7a7570 100%)", labelBg: "#90b8d8", labelBorder: "#6898b8", text: "#0a1828", sub: "#284868" },
                { bg: "linear-gradient(90deg, #887868 0%, #e0c8a8 4%, #e0c8a8 96%, #887868 100%)", labelBg: "#e8b878", labelBorder: "#c89048", text: "#2a1800", sub: "#584818" },
                { bg: "linear-gradient(90deg, #8a7a78 0%, #e0c8c8 4%, #e0c8c8 96%, #8a7a78 100%)", labelBg: "#e88898", labelBorder: "#c06070", text: "#2a0810", sub: "#5a2838" },
                { bg: "linear-gradient(90deg, #787870 0%, #c8c8c0 4%, #c8c8c0 96%, #787870 100%)", labelBg: "#c0a8d8", labelBorder: "#9878b0", text: "#180828", sub: "#483868" },
                { bg: "linear-gradient(90deg, #888068 0%, #e0d8b8 4%, #e0d8b8 96%, #888068 100%)", labelBg: "#b8d888", labelBorder: "#90b058", text: "#182808", sub: "#385818" },
                { bg: "linear-gradient(90deg, #807870 0%, #d0c8c0 4%, #d0c8c0 96%, #807870 100%)", labelBg: "#d8c098", labelBorder: "#b89868", text: "#281808", sub: "#584020" },
                { bg: "linear-gradient(90deg, #787068 0%, #c8c0b8 4%, #c8c0b8 96%, #787068 100%)", labelBg: "#80c8b8", labelBorder: "#58a090", text: "#082820", sub: "#285848" },
              ];
              const tape = tapeStyles[i % tapeStyles.length];
              const desktopHeights = [52, 48, 55, 46, 50, 53, 47, 51, 49, 54];
              const mobileHeights = [44, 40, 46, 42, 44, 45, 41, 43, 42, 45];
              const isSmall = typeof window !== 'undefined' && window.innerWidth < 640;
              const h = (isSmall ? mobileHeights : desktopHeights)[i % desktopHeights.length];

              return (
                <motion.button
                  key={s.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => navigate(`/builder/${s.id}`)}
                  className="w-full text-left flex items-stretch group hover:brightness-[1.12] transition-all duration-100 relative z-10"
                  style={{ height: `${h}px` }}
                >
                  {/* Shadow line between tapes — the dark gap */}
                  <div className="absolute inset-x-0 top-0 h-[3px] z-20" style={{
                    background: "linear-gradient(90deg, rgba(0,0,0,0.7), rgba(0,0,0,0.4) 8%, rgba(0,0,0,0.25) 50%, rgba(0,0,0,0.4) 92%, rgba(0,0,0,0.7))",
                  }} />
                  
                  {/* Left plastic case edge — translucent dark */}
                  <div className="w-[14px] shrink-0 relative overflow-hidden" style={{
                    background: "linear-gradient(90deg, #1a1512, #2a2520 30%, #353028 60%, #2a2520 80%, #1a1512)",
                  }}>
                    {/* Plastic sheen */}
                    <div className="absolute inset-0" style={{
                      background: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.1) 100%)",
                    }} />
                  </div>
                  
                  {/* Main paper/card label */}
                  <div className="flex-1 relative overflow-hidden" style={{ background: tape.bg }}>
                    {/* Paper grain texture */}
                    <div className="absolute inset-0 opacity-[0.15]" style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.2' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
                    }} />
                    
                    {/* Colored label band — the characteristic stripe */}
                    <div className="absolute top-[15%] bottom-[15%] left-[2%] right-[2%]" style={{
                      backgroundColor: tape.labelBg,
                      border: `1px solid ${tape.labelBorder}`,
                      borderRadius: "1px",
                      opacity: 0.55,
                    }} />
                    
                    {/* Aging/yellowing spots */}
                    <div className="absolute inset-0 opacity-[0.06]" style={{
                      background: "radial-gradient(circle at 30% 50%, rgba(120,90,40,0.5), transparent 40%), radial-gradient(circle at 80% 30%, rgba(100,80,30,0.3), transparent 30%)",
                    }} />
                    
                    {/* Content */}
                    <div className="flex items-center px-3 sm:px-5 h-full relative z-10">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                        <span className="font-body text-sm sm:text-lg truncate" style={{ color: tape.text, letterSpacing: "0.03em" }}>
                          {s.title}
                        </span>
                        {s.slot_count > 0 && (
                          <span className="font-body text-xs sm:text-sm shrink-0" style={{ color: tape.sub }}>
                            {s.slot_count} songs
                          </span>
                        )}
                        {s.description && (
                          <span className="font-body text-xs sm:text-sm truncate max-w-[140px] sm:max-w-[260px] italic font-semibold" style={{ color: tape.text, opacity: 0.75 }}>
                            — {s.description.length > 50 ? s.description.slice(0, 50).trim() + "…" : s.description}
                          </span>
                        )}
                        {/* Hand-drawn SVG marker doodles inline between title & date */}
                        {(() => {
                          const ink = tape.text;
                          const doodleOptions: Array<Array<{ svg: React.ReactNode; rot: number; w: number; h: number }>> = [
                            [{ svg: (<svg viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:"100%",height:"100%"}}><path d="M12 21s-1-3-1-6 2-5 2-5c-2 0-3.5 1-4 3-1-2 0-4 1-5-2.5 1-3.5 3.5-3 6-1.5-1.5-1-4 0-5.5-2 2-2.5 5-1 7.5"/><path d="M12 21s1-3 1-6-2-5-2-5c2 0 3.5 1 4 3 1-2 0-4-1-5 2.5 1 3.5 3.5 3 6 1.5-1.5 1-4 0-5.5 2 2 2.5 5 1 7.5"/><circle cx="12" cy="8" r="2.5" strokeWidth="1.5" opacity=".6"/></svg>), rot: -12, w: 18, h: 18 }],
                            [{ svg: (<svg viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{width:"100%",height:"100%"}}><path d="M13 2L4.5 13.5h6L9 22l9.5-12h-6L13 2z"/></svg>), rot: 8, w: 16, h: 16 }],
                            [{ svg: (<svg viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{width:"100%",height:"100%"}}><path d="M12 4C8 4 5 7 5 11c0 2.5 1.2 4 3 5v2.5c0 .5.5 1 1 1h6c.5 0 1-.5 1-1V16c1.8-1 3-2.5 3-5 0-4-3-7-7-7z"/><circle cx="9.5" cy="10.5" r="1.5" strokeWidth="1.4"/><circle cx="14.5" cy="10.5" r="1.5" strokeWidth="1.4"/><path d="M10 15.5v2M12 15.5v2M14 15.5v2" strokeWidth="1.2" opacity=".6"/></svg>), rot: -5, w: 17, h: 17 }],
                            [],
                            [{ svg: (<svg viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{width:"100%",height:"100%"}}><circle cx="7" cy="6" r="2.5" opacity=".7"/><circle cx="17" cy="6" r="2.5" opacity=".7"/><ellipse cx="12" cy="13" rx="7" ry="8" opacity=".75"/><circle cx="9.5" cy="11" r="1" strokeWidth="1.8"/><circle cx="14.5" cy="11" r="1" strokeWidth="1.8"/><ellipse cx="12" cy="14" rx="2.5" ry="1.8" strokeWidth="1.4" opacity=".6"/></svg>), rot: 6, w: 20, h: 20 }],
                            [{ svg: (<svg viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:"100%",height:"100%"}}><circle cx="12" cy="12" r="9" opacity=".7"/><path d="M12 3v18M12 12l-6.4 6.4M12 12l6.4 6.4"/></svg>), rot: -10, w: 16, h: 16 }],
                            [{ svg: (<svg viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{width:"100%",height:"100%"}}><path d="M13 2L4.5 13.5h6L9 22l9.5-12h-6L13 2z"/></svg>), rot: 15, w: 14, h: 14 }, { svg: (<svg viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:"100%",height:"100%"}}><path d="M12 21s-1-3-1-6 2-5 2-5c-2 0-3.5 1-4 3-1-2 0-4 1-5-2.5 1-3.5 3.5-3 6"/><path d="M12 21s1-3 1-6-2-5-2-5c2 0 3.5 1 4 3 1-2 0-4-1-5 2.5 1 3.5 3.5 3 6"/><circle cx="12" cy="8" r="2" strokeWidth="1.5" opacity=".5"/></svg>), rot: -20, w: 15, h: 15 }],
                            [],
                            [{ svg: (<svg viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{width:"100%",height:"100%"}}><path d="M20 4l-3.5 3.5M16.5 7.5l-2 2" strokeWidth="2"/><ellipse cx="10" cy="16" rx="5" ry="4" opacity=".7" transform="rotate(-15 10 16)"/><circle cx="10" cy="16" r="1.2" strokeWidth="1.4" opacity=".5"/><path d="M14 12.5l2.5-5" strokeWidth="1.8"/></svg>), rot: 10, w: 19, h: 19 }],
                            [{ svg: (<svg viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{width:"100%",height:"100%"}}><path d="M12 14c-5 0-8-3-8-6.5C4 4.5 7.5 2 12 2s8 2.5 8 5.5c0 3.5-3 6.5-8 6.5z"/><path d="M10 14v6c0 1 .8 2 2 2s2-1 2-2v-6"/><circle cx="9" cy="7" r="1.5" strokeWidth="1.2" opacity=".4"/><circle cx="14" cy="5.5" r="1" strokeWidth="1.2" opacity=".4"/></svg>), rot: -8, w: 17, h: 17 }],
                          ];
                          const doodles = doodleOptions[i % doodleOptions.length];
                          if (doodles.length === 0) return null;
                          return (
                            <span className="inline-flex items-center gap-1 shrink-0 mx-1">
                              {doodles.map((d, di) => (
                                <span key={di} className="inline-block pointer-events-none select-none opacity-50" style={{ width: d.w, height: d.h, transform: `rotate(${d.rot}deg)`, filter: "saturate(0.4)" }}>
                                  {d.svg}
                                </span>
                              ))}
                            </span>
                          );
                        })()}
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        <span className="font-body text-[10px] sm:text-sm hidden sm:inline" style={{ color: tape.sub }}>
                          {new Date(s.updated_at).toLocaleDateString()}
                        </span>
                        {s.is_public ? (
                          <Globe className="w-4 h-4" style={{ color: tape.sub }} />
                        ) : (
                          <Lock className="w-4 h-4 opacity-50" style={{ color: tape.sub }} />
                        )}
                        <button
                          onClick={(e) => handleDelete(s.id, e)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1"
                          style={{ color: tape.sub }}
                          title="Delete setlist"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right plastic case edge */}
                  <div className="w-[10px] shrink-0" style={{
                    background: "linear-gradient(90deg, #2a2520, #353028 40%, #2a2520 70%, #1a1512)",
                  }} />
                  
                  {/* Bottom gap shadow */}
                  <div className="absolute inset-x-0 bottom-0 h-[2px] z-20" style={{
                    background: "linear-gradient(90deg, rgba(0,0,0,0.6), rgba(0,0,0,0.2) 15%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.2) 85%, rgba(0,0,0,0.6))",
                  }} />
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
