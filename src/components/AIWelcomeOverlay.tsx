import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import StealYourFace from "@/components/StealYourFace";
import EraTooltip from "@/components/EraTooltip";
import type { Database } from "@/integrations/supabase/types";

type Era = Database["public"]["Tables"]["eras"]["Row"];

interface AISuggestionSet {
  setNumber: number;
  songs: {
    songId: string;
    title: string;
    matched: boolean;
    segueToNext: boolean;
    notes: string;
    position: number;
  }[];
}

interface AISuggestion {
  explanation: string;
  sets: AISuggestionSet[];
}

interface AIWelcomeOverlayProps {
  eras: Era[];
  onGenerated: (suggestion: AISuggestion, eraId: string | null) => void;
  onSkip: () => void;
}

const AIWelcomeOverlay = ({ eras, onGenerated, onSkip }: AIWelcomeOverlayProps) => {
  const [selectedEra, setSelectedEra] = useState<string | null>(null);
  const [vibeText, setVibeText] = useState("");
  const [loading, setLoading] = useState(false);
  const recentSongsRef = useRef<string[]>([]);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-deadhead", {
        body: {
          mode: "build",
          eraId: selectedEra || undefined,
          preferences: vibeText.trim() || undefined,
          recentSongs: recentSongsRef.current.length > 0 ? recentSongsRef.current : undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const generatedSongs = (data.sets || []).flatMap((s: any) =>
        s.songs.map((song: any) => song.title)
      );
      recentSongsRef.current = [
        ...new Set([...recentSongsRef.current, ...generatedSongs]),
      ].slice(-30);

      onGenerated(data, selectedEra);
    } catch (e: any) {
      console.error("AI error:", e);
      toast.error(e.message || "AI generation failed");
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 bg-background flex items-center justify-center overflow-y-auto"
    >
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,hsl(var(--dead-gold)/0.1),transparent_70%)]" />
      </div>

      <div className="relative z-10 w-full max-w-lg px-5 py-8 flex flex-col items-center gap-6">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center gap-5 py-12"
            >
              <div className="relative">
                <StealYourFace size={100} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-28 h-28 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              </div>
              <div className="space-y-2 text-center">
                <p className="font-display text-lg text-foreground">
                  Building your show...
                </p>
                <p className="font-body text-sm text-muted-foreground">
                  The Dead Head is studying the catalog
                </p>
              </div>
              {/* Equalizer bars */}
              <div className="flex items-end gap-1 h-8">
                {[0.3, 0.7, 0.5, 1, 0.4, 0.8, 0.6].map((delay, i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 bg-primary rounded-full"
                    animate={{
                      height: ["8px", "32px", "12px", "24px", "8px"],
                    }}
                    transition={{
                      duration: 1.2,
                      repeat: Infinity,
                      delay: delay * 0.3,
                      ease: "easeInOut",
                    }}
                  />
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full flex flex-col items-center gap-6"
            >
              <StealYourFace size={72} />

              <div className="text-center space-y-2">
                <h1 className="font-display text-2xl sm:text-3xl text-foreground leading-tight">
                  What kind of Dead show
                  <br />
                  are you dreaming of?
                </h1>
                <p className="font-body text-sm text-muted-foreground">
                  Pick an era, describe the vibe, and we'll build your dream
                  setlist.
                </p>
              </div>

              {/* Era chips */}
              <div className="w-full space-y-2">
                <label className="font-body text-xs text-muted-foreground uppercase tracking-wider">
                  Era (optional)
                </label>
                <div className="flex flex-wrap gap-2 justify-center">
                  {eras.map((era) => (
                    <EraTooltip key={era.id} eraName={era.name} yearRange={`${era.year_start}–${era.year_end}`}>
                      <button
                        onClick={() =>
                          setSelectedEra(
                            selectedEra === era.id ? null : era.id
                          )
                        }
                        className={`px-3 py-1.5 text-xs sm:text-sm font-hand rounded-sm border transition-all duration-200 ${
                          selectedEra === era.id
                            ? "border-primary bg-primary/15 text-primary shadow-[0_0_12px_hsl(var(--glow-gold))]"
                            : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        }`}
                      >
                        <span className="font-marker text-xs">{era.name}</span>
                        <span className="text-[10px] text-muted-foreground/60 ml-1.5">
                          {era.year_start}–{era.year_end}
                        </span>
                      </button>
                    </EraTooltip>
                  ))}
                </div>
              </div>

              {/* Vibe text */}
              <div className="w-full space-y-2">
                <label className="font-body text-xs text-muted-foreground uppercase tracking-wider">
                  Vibe (optional)
                </label>
                <Textarea
                  value={vibeText}
                  onChange={(e) => setVibeText(e.target.value)}
                  placeholder="Heavy on jams, Cornell '77 energy, late-night Space vibes..."
                  className="bg-card border-border text-foreground font-body text-sm resize-none h-20"
                />
              </div>

              {/* Build button */}
              <Button
                size="lg"
                onClick={handleGenerate}
                className="w-full font-display text-base px-8 py-6 bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_30px_hsl(var(--glow-gold))] tracking-widest uppercase gap-2"
              >
                <Sparkles className="w-5 h-5" />
                Build My Show
              </Button>

              {/* Skip link */}
              <button
                onClick={onSkip}
                className="font-body text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors underline underline-offset-2"
              >
                or start from scratch
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default AIWelcomeOverlay;
