import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ExternalLink, ChevronRight, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import StealYourFace from "@/components/StealYourFace";
import type { Database } from "@/integrations/supabase/types";

type Setlist = Database["public"]["Tables"]["setlists"]["Row"];
type SetlistSlot = Database["public"]["Tables"]["setlist_slots"]["Row"];
type Song = Database["public"]["Tables"]["songs"]["Row"];
type NotableVersion = Database["public"]["Tables"]["notable_versions"]["Row"];

interface EnrichedSlot extends SetlistSlot {
  song: Song;
  version: NotableVersion | null;
}

const SetlistPoster = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [slots, setSlots] = useState<EnrichedSlot[]>([]);
  const [creatorName, setCreatorName] = useState("Unknown Head");
  const [eraName, setEraName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchSetlist = async () => {
      setLoading(true);

      const { data: setlistData } = await supabase
        .from("setlists")
        .select("*")
        .eq("id", id)
        .single();

      if (!setlistData) {
        setLoading(false);
        return;
      }
      setSetlist(setlistData);

      // Fetch profile, era, and slots in parallel
      const [profileRes, eraRes, slotsRes] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("user_id", setlistData.creator_id).single(),
        setlistData.era_id
          ? supabase.from("eras").select("name").eq("id", setlistData.era_id).single()
          : Promise.resolve({ data: null }),
        supabase.from("setlist_slots").select("*").eq("setlist_id", id).order("set_number").order("position"),
      ]);

      setCreatorName(profileRes.data?.display_name || "Unknown Head");
      setEraName(eraRes.data?.name || null);

      if (slotsRes.data) {
        // Enrich slots with song and version data
        const enriched = await Promise.all(
          slotsRes.data.map(async (slot) => {
            const [songRes, versionRes] = await Promise.all([
              supabase.from("songs").select("*").eq("id", slot.song_id).single(),
              slot.notable_version_id
                ? supabase.from("notable_versions").select("*").eq("id", slot.notable_version_id).single()
                : Promise.resolve({ data: null }),
            ]);
            return {
              ...slot,
              song: songRes.data!,
              version: versionRes.data,
            } as EnrichedSlot;
          })
        );
        setSlots(enriched);
      }

      setLoading(false);
    };

    fetchSetlist();
  }, [id]);

  const handleShare = async () => {
    const url = window.location.href;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const setGroups = [
    { label: "Set I", number: 1 },
    { label: "Set II", number: 2 },
    { label: "Encore", number: 3 },
  ];

  if (loading) {
    return (
      <div className="grain-overlay min-h-screen bg-background flex items-center justify-center">
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 w-64 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!setlist) {
    return (
      <div className="grain-overlay min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="font-display text-xl text-muted-foreground">Setlist not found</p>
        <Button variant="outline" onClick={() => navigate("/browse")} className="font-body">
          Browse Setlists
        </Button>
      </div>
    );
  }

  return (
    <div className="grain-overlay min-h-screen bg-background">
      {/* Top nav */}
      <header className="border-b border-border px-4 py-3 flex items-center justify-between">
        <button onClick={() => navigate("/browse")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-body text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleShare}
          className="font-body border-border text-foreground gap-1.5"
        >
          <Share2 className="w-3.5 h-3.5" />
          {copied ? "Copied!" : "Share"}
        </Button>
      </header>

      {/* Concert Poster */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="border-2 border-border rounded-xl overflow-hidden bg-card"
        >
          {/* Poster header */}
          <div className="relative bg-gradient-to-b from-primary/10 via-card to-card px-6 pt-8 pb-6 text-center">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-secondary" />
            
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="flex justify-center mb-4"
            >
              <StealYourFace size={60} />
            </motion.div>

            <h1 className="font-display text-2xl sm:text-3xl text-foreground leading-tight">
              {setlist.title}
            </h1>
            <p className="font-body text-sm text-muted-foreground mt-2">
              Curated by <span className="text-foreground">{creatorName}</span>
            </p>
            {eraName && (
              <span className="inline-block mt-3 px-3 py-1 text-xs font-body text-accent border border-accent/30 rounded-full">
                {eraName}
              </span>
            )}
          </div>

          {/* Decorative divider */}
          <div className="flex items-center gap-2 px-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-muted-foreground text-xs">✦</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Sets */}
          <div className="px-6 py-6 space-y-6">
            {setGroups.map(({ label, number }) => {
              const setSlots = slots.filter((s) => s.set_number === number);
              if (setSlots.length === 0) return null;

              return (
                <motion.div
                  key={number}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + number * 0.15 }}
                >
                  <h2 className="font-display text-xs text-muted-foreground uppercase tracking-widest mb-3">
                    {label}
                  </h2>
                  <div className="space-y-0.5">
                    {setSlots.map((slot, idx) => (
                      <div key={slot.id} className="flex items-baseline gap-2">
                        <span className="text-[10px] text-muted-foreground font-body w-4 text-right shrink-0 tabular-nums">
                          {idx + 1}.
                        </span>
                        <div className="flex items-baseline gap-1.5 flex-1 min-w-0">
                          <span className="font-body text-sm text-foreground">
                            {slot.song.title}
                          </span>
                          {slot.segue_to_next && (
                            <ChevronRight className="w-3 h-3 text-primary shrink-0 inline" />
                          )}
                          {slot.version && (
                            <span className="text-[10px] text-muted-foreground font-body truncate">
                              ({slot.version.show_date}
                              {slot.version.venue ? `, ${slot.version.venue}` : ""})
                            </span>
                          )}
                          {slot.version?.archive_org_url && (
                            <a
                              href={slot.version.archive_org_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0"
                            >
                              <ExternalLink className="w-2.5 h-2.5 text-secondary inline" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Poster footer */}
          <div className="border-t border-border px-6 py-4 text-center">
            <p className="text-[10px] text-muted-foreground font-body uppercase tracking-widest">
              Dead Set · {new Date(setlist.created_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>

          {/* Bottom gradient band */}
          <div className="h-1 bg-gradient-to-r from-secondary via-accent to-primary" />
        </motion.div>
      </div>
    </div>
  );
};

export default SetlistPoster;
