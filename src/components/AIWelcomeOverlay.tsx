import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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

const VIBES = [
  { id: "high-energy", emoji: "🔥", label: "High Energy" },
  { id: "spacey", emoji: "🌊", label: "Spacey & Psychedelic" },
  { id: "mellow", emoji: "🌅", label: "Mellow & Groovy" },
  { id: "dark", emoji: "🌑", label: "Dark & Heavy" },
  { id: "party", emoji: "🎉", label: "Party Night" },
  { id: "emotional", emoji: "💔", label: "Emotional & Raw" },
  { id: "country", emoji: "🤠", label: "Country & Folk Roots" },
  { id: "blues", emoji: "🎸", label: "Blues & Grit" },
];

const PRIORITIES = [
  { id: "deep-jams", emoji: "🎵", label: "Deep jams — let them stretch out" },
  { id: "tight", emoji: "⚡", label: "Tight & punchy — no noodling" },
  { id: "rare", emoji: "💎", label: "Surprise me with rare songs" },
  { id: "classics", emoji: "⭐", label: "Stick to the classics" },
  { id: "segues", emoji: "🔗", label: "Lots of segues — keep it flowing" },
  { id: "journey", emoji: "🎢", label: "Mix of everything — a real journey" },
];

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 200 : -200,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? -200 : 200,
    opacity: 0,
  }),
};

const AIWelcomeOverlay = ({ eras, onGenerated, onSkip }: AIWelcomeOverlayProps) => {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [selectedVibes, setSelectedVibes] = useState<typeof VIBES>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<typeof PRIORITIES>([]);
  const [mustInclude, setMustInclude] = useState("");
  const [pleaseAvoid, setPleaseAvoid] = useState("");
  const [itsFor, setItsFor] = useState("");
  const [selectedEra, setSelectedEra] = useState<string | null>(null);
  const [eraOpen, setEraOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const recentSongsRef = useRef<string[]>([]);

  const toggleVibe = (vibe: (typeof VIBES)[number]) => {
    setSelectedVibes((prev) => {
      const exists = prev.find((v) => v.id === vibe.id);
      if (exists) return prev.filter((v) => v.id !== vibe.id);
      if (prev.length >= 2) return prev;
      return [...prev, vibe];
    });
  };

  const togglePriority = (priority: (typeof PRIORITIES)[number]) => {
    setSelectedPriorities((prev) => {
      const exists = prev.find((p) => p.id === priority.id);
      if (exists) return prev.filter((p) => p.id !== priority.id);
      if (prev.length >= 2) return prev;
      return [...prev, priority];
    });
  };

  const goNext = () => {
    setDirection(1);
    setStep((s) => s + 1);
  };

  const goBack = () => {
    setDirection(-1);
    setStep((s) => s - 1);
  };

  const composePreferences = (): string | undefined => {
    const parts: string[] = [];
    if (selectedVibes.length > 0) {
      const vibeLabels = selectedVibes.map((v) => v.label).join(" and ");
      parts.push(`User wants a ${vibeLabels} vibe.`);
    }
    if (selectedPriorities.length > 0) {
      const priorityLabels = selectedPriorities.map((p) => p.label).join(". ");
      parts.push(`${priorityLabels}.`);
    }
    if (mustInclude.trim()) parts.push(`Must include: ${mustInclude.trim()}.`);
    if (pleaseAvoid.trim()) parts.push(`Please avoid: ${pleaseAvoid.trim()}.`);
    if (itsFor.trim()) parts.push(`This setlist is for: ${itsFor.trim()}.`);
    return parts.length > 0 ? parts.join(" ") : undefined;
  };

  const handleGenerate = async (preferences?: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-deadhead", {
        body: {
          mode: "build",
          eraId: selectedEra || undefined,
          preferences: preferences !== undefined ? preferences : composePreferences(),
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
      toast.error(e.message || "Cosmic Charlie hit a wrong note. Try again.");
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

      <div className="relative z-10 w-full max-w-lg px-5 py-8 flex flex-col items-center gap-5">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center gap-5 py-12"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              >
                <Star className="w-16 h-16 text-primary fill-primary/20" />
              </motion.div>
              <div className="space-y-2 text-center">
                <p className="font-display text-lg text-foreground">
                  Cosmic Charlie is digging through the tapes...
                </p>
                <p className="font-body text-sm text-muted-foreground">
                  Every show, every setlist, every jam — Charlie remembers
                </p>
              </div>
              <div className="flex items-end gap-1 h-8">
                {[0.3, 0.7, 0.5, 1, 0.4, 0.8, 0.6].map((delay, i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 bg-primary rounded-full"
                    animate={{ height: ["8px", "32px", "12px", "24px", "8px"] }}
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
            <>
              {/* Charlie icon */}
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="relative"
              >
                <Star className="w-12 h-12 text-primary fill-primary/30" />
                <div className="absolute inset-0 blur-xl bg-primary/20 rounded-full" />
              </motion.div>

              {/* Step dots */}
              <div className="flex gap-2">
                {[0, 1, 2].map((s) => (
                  <div
                    key={s}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      s === step
                        ? "bg-primary scale-125"
                        : s < step
                        ? "bg-primary/50"
                        : "bg-muted-foreground/30"
                    }`}
                  />
                ))}
              </div>

              {/* Steps */}
              <AnimatePresence mode="wait" custom={direction}>
                {step === 0 && (
                  <motion.div
                    key="step0"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="w-full flex flex-col items-center gap-5"
                  >
                    <div className="text-center space-y-1">
                      <h1 className="font-display text-2xl sm:text-3xl text-primary">
                        What's the vibe tonight?
                      </h1>
                      <p className="font-body text-sm text-muted-foreground">Pick one or two</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 w-full">
                      {VIBES.map((vibe) => {
                        const selected = selectedVibes.some((v) => v.id === vibe.id);
                        return (
                          <motion.button
                            key={vibe.id}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => toggleVibe(vibe)}
                            className={`flex items-center gap-2.5 px-3.5 py-3 rounded-lg border text-left transition-all duration-200 ${
                              selected
                                ? "border-primary bg-primary/15 shadow-[0_0_12px_hsl(var(--glow-gold))]"
                                : "border-border bg-card hover:border-primary/40"
                            }`}
                          >
                            <span className="text-xl">{vibe.emoji}</span>
                            <span
                              className={`font-body text-sm ${
                                selected ? "text-primary" : "text-foreground"
                              }`}
                            >
                              {vibe.label}
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>

                    {/* Collapsible era picker */}
                    <div className="w-full">
                      <button
                        onClick={() => setEraOpen((o) => !o)}
                        className="flex items-center gap-2 w-full justify-center font-body text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <span>
                          {selectedEra
                            ? `Era: ${eras.find((e) => e.id === selectedEra)?.name || "Selected"}`
                            : "Pick an era (optional)"}
                        </span>
                        <motion.div
                          animate={{ rotate: eraOpen ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </motion.div>
                      </button>
                      <AnimatePresence>
                        {eraOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="flex flex-wrap gap-2 justify-center pt-3">
                              {eras.map((era) => (
                                <EraTooltip key={era.id} eraName={era.name} yearRange={`${era.year_start}–${era.year_end}`}>
                                  <button
                                    onClick={() =>
                                      setSelectedEra(selectedEra === era.id ? null : era.id)
                                    }
                                    className={`px-3 py-1.5 text-xs rounded-sm border transition-all duration-200 ${
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
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <Button
                      size="lg"
                      onClick={goNext}
                      disabled={selectedVibes.length === 0}
                      className="w-full font-display text-base px-8 py-6 bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_30px_hsl(var(--glow-gold))] tracking-widest uppercase gap-2"
                    >
                      Next
                    </Button>

                    <button
                      onClick={() => handleGenerate(undefined)}
                      className="font-body text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                    >
                      🎲 Surprise me — skip all this
                    </button>

                    <button
                      onClick={onSkip}
                      className="font-body text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors underline underline-offset-2"
                    >
                      or build from scratch →
                    </button>
                  </motion.div>
                )}

                {step === 1 && (
                  <motion.div
                    key="step1"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="w-full flex flex-col items-center gap-5"
                  >
                    <div className="text-center space-y-1">
                      <h1 className="font-display text-2xl sm:text-3xl text-primary">
                        What matters most?
                      </h1>
                      <p className="font-body text-sm text-muted-foreground">Pick one or two</p>
                    </div>

                    <div className="flex flex-col gap-2.5 w-full">
                      {PRIORITIES.map((priority) => {
                        const selected = selectedPriorities.some((p) => p.id === priority.id);
                        return (
                          <motion.button
                            key={priority.id}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => togglePriority(priority)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all duration-200 ${
                              selected
                                ? "border-primary bg-primary/15 shadow-[0_0_12px_hsl(var(--glow-gold))]"
                                : "border-border bg-card hover:border-primary/40"
                            }`}
                          >
                            <span className="text-lg">{priority.emoji}</span>
                            <span
                              className={`font-body text-sm ${
                                selected ? "text-primary" : "text-foreground"
                              }`}
                            >
                              {priority.label}
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-4 w-full">
                      <button
                        onClick={goBack}
                        className="font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        ← Back
                      </button>
                      <Button
                        size="lg"
                        onClick={goNext}
                        disabled={selectedPriorities.length === 0}
                        className="flex-1 font-display text-base px-8 py-6 bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_30px_hsl(var(--glow-gold))] tracking-widest uppercase gap-2"
                      >
                        Next
                      </Button>
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="step2"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="w-full flex flex-col items-center gap-5"
                  >
                    <div className="text-center space-y-1">
                      <h1 className="font-display text-2xl sm:text-3xl text-primary">
                        Anything specific?
                      </h1>
                      <p className="font-body text-sm text-muted-foreground">
                        Totally optional — skip if you want
                      </p>
                    </div>

                    <div className="w-full space-y-4">
                      <div className="space-y-1.5">
                        <label className="font-body text-xs text-muted-foreground uppercase tracking-wider">
                          Must include
                        </label>
                        <Input
                          value={mustInclude}
                          onChange={(e) => setMustInclude(e.target.value)}
                          placeholder="e.g. Scarlet > Fire, Dark Star"
                          className="bg-card border-border text-foreground font-body text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="font-body text-xs text-muted-foreground uppercase tracking-wider">
                          Please avoid
                        </label>
                        <Input
                          value={pleaseAvoid}
                          onChange={(e) => setPleaseAvoid(e.target.value)}
                          placeholder="e.g. Touch of Grey, Drums/Space"
                          className="bg-card border-border text-foreground font-body text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="font-body text-xs text-muted-foreground uppercase tracking-wider">
                          It's for…
                        </label>
                        <Input
                          value={itsFor}
                          onChange={(e) => setItsFor(e.target.value)}
                          placeholder="e.g. a road trip, converting a friend"
                          className="bg-card border-border text-foreground font-body text-sm"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-4 w-full">
                      <button
                        onClick={goBack}
                        className="font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        ← Back
                      </button>
                      <Button
                        size="lg"
                        onClick={() => handleGenerate()}
                        className="flex-1 font-display text-base px-8 py-6 bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_30px_hsl(var(--glow-gold))] tracking-widest uppercase gap-2"
                      >
                        <Star className="w-5 h-5" />
                        Let Charlie Cook
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default AIWelcomeOverlay;
