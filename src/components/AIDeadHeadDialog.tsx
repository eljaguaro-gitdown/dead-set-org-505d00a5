import { useState } from "react";
import { Sparkles, Zap, Wand2, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

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

interface AIDeadHeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eraId: string | null;
  currentSlots: { songTitle: string; setNumber: number; segue: boolean }[];
  onApplySuggestion: (suggestion: AISuggestion) => void;
  onCreateNewSetlist: (suggestion: AISuggestion) => void;
}

const AIDeadHeadDialog = ({
  open,
  onOpenChange,
  eraId,
  currentSlots,
  onApplySuggestion,
  onCreateNewSetlist,
}: AIDeadHeadDialogProps) => {
  const [mode, setMode] = useState<"build" | "improve" | null>(null);
  const [preferences, setPreferences] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setSuggestion(null);

    try {
      const { data, error } = await supabase.functions.invoke("ai-deadhead", {
        body: {
          mode,
          eraId,
          currentSlots: mode === "improve" ? currentSlots : undefined,
          preferences: preferences.trim() || undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSuggestion(data);
    } catch (e: any) {
      console.error("AI error:", e);
      toast.error(e.message || "AI generation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!suggestion) return;
    onApplySuggestion(suggestion);
    handleReset();
    toast.success("AI setlist applied!");
  };

  const handleCreateNew = () => {
    if (!suggestion) return;
    onCreateNewSetlist(suggestion);
    handleReset();
    toast.success("Creating new setlist from AI suggestion...");
  };

  const handleReset = () => {
    onOpenChange(false);
    setMode(null);
    setSuggestion(null);
    setPreferences("");
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setMode(null);
      setSuggestion(null);
      setPreferences("");
      setLoading(false);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-foreground flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            AI Dead Head
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {!mode && !suggestion && (
            <motion.div
              key="mode-select"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-3"
            >
              <p className="text-sm text-muted-foreground font-body">
                Let the AI Dead Head help curate your setlist with encyclopedic knowledge of the catalog.
              </p>
              <button
                onClick={() => setMode("build")}
                className="w-full p-4 rounded-lg border border-border bg-background hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                    <Wand2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm text-foreground">Build Me a Set</h3>
                    <p className="text-xs text-muted-foreground font-body mt-0.5">
                      Generate a full setlist from scratch with authentic flow
                    </p>
                  </div>
                </div>
              </button>
              <button
                onClick={() => setMode("improve")}
                disabled={currentSlots.length === 0}
                className="w-full p-4 rounded-lg border border-border bg-background hover:border-primary/50 hover:bg-primary/5 transition-all text-left group disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm text-foreground">Improve My Set</h3>
                    <p className="text-xs text-muted-foreground font-body mt-0.5">
                      Optimize flow, suggest swaps &amp; segue opportunities
                    </p>
                  </div>
                </div>
              </button>
            </motion.div>
          )}

          {mode && !suggestion && !loading && (
            <motion.div
              key="preferences"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              <div>
                <label className="text-xs text-muted-foreground font-body block mb-1.5">
                  Any preferences? (optional)
                </label>
                <Textarea
                  value={preferences}
                  onChange={(e) => setPreferences(e.target.value)}
                  placeholder={
                    mode === "build"
                      ? "e.g. Heavy on the jams, include Scarlet > Fire, open with Bertha..."
                      : "e.g. Need more energy in Set II, add a space segment..."
                  }
                  className="bg-background border-border text-foreground font-body text-sm resize-none h-20"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMode(null)}
                  className="border-border text-muted-foreground font-body"
                >
                  Back
                </Button>
                <Button
                  size="sm"
                  onClick={handleGenerate}
                  className="bg-primary text-primary-foreground font-body gap-1.5 flex-1"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {mode === "build" ? "Build My Set" : "Improve My Set"}
                </Button>
              </div>
            </motion.div>
          )}

          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center py-8 gap-3"
            >
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground font-body">
                The Dead Head is studying the catalog...
              </p>
            </motion.div>
          )}

          {suggestion && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm text-foreground font-body leading-relaxed">
                  {suggestion.explanation}
                </p>
              </div>

              {suggestion.sets.map((set) => (
                <div key={set.setNumber}>
                  <h4 className="font-display text-xs text-muted-foreground uppercase tracking-wider mb-2">
                    {set.setNumber === 3 ? "Encore" : `Set ${set.setNumber}`}
                  </h4>
                  <div className="space-y-1">
                    {set.songs.map((song, i) => (
                      <div
                        key={`${song.songId}-${i}`}
                        className="flex items-center gap-2 text-sm font-body"
                      >
                        <span className="text-muted-foreground w-5 text-right text-xs">{i + 1}.</span>
                        <span className="text-foreground">{song.title}</span>
                        {song.segueToNext && (
                          <span className="text-primary font-bold text-xs">&gt;</span>
                        )}
                        {song.notes && (
                          <span className="text-muted-foreground text-xs italic ml-auto truncate max-w-[140px]">
                            {song.notes}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="flex flex-col gap-2 pt-2">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerate}
                    className="border-border text-muted-foreground font-body gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Regenerate
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleApply}
                    className="bg-primary text-primary-foreground font-body gap-1.5 flex-1"
                  >
                    <Zap className="w-3.5 h-3.5" /> Apply to Current
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCreateNew}
                  className="border-primary/30 text-primary font-body gap-1.5 w-full hover:bg-primary/10"
                >
                  <Wand2 className="w-3.5 h-3.5" /> Create as New Setlist
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

export default AIDeadHeadDialog;
