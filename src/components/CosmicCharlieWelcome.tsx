import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, ChevronRight } from "lucide-react";
import StealYourFace from "@/components/StealYourFace";
import CosmicCharlieAvatar from "@/components/CosmicCharlieAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import EraTooltip from "@/components/EraTooltip";
import type { Database } from "@/integrations/supabase/types";
import {
  getVisitorId,
  loadRecentSongs,
  appendRecentSongs,
} from "@/lib/cosmicCharlieHistory";

// Short-lived cache for the "Surprise Me" path so back-nav within 30s replays
// the same suggestion instead of regenerating a different (and surprising-in-
// the-wrong-way) show. Only applies to pure no-preference / no-era calls.
const SURPRISE_ME_CACHE_KEY = "ds_surprise_me_cache";
const SURPRISE_ME_CACHE_TTL_MS = 30_000;

const readSurpriseMeCache = (): unknown | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SURPRISE_ME_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { suggestion: unknown; ts: number };
    if (Date.now() - parsed.ts > SURPRISE_ME_CACHE_TTL_MS) {
      sessionStorage.removeItem(SURPRISE_ME_CACHE_KEY);
      return null;
    }
    return parsed.suggestion;
  } catch {
    return null;
  }
};

const writeSurpriseMeCache = (suggestion: unknown): void => {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      SURPRISE_ME_CACHE_KEY,
      JSON.stringify({ suggestion, ts: Date.now() }),
    );
  } catch {
    /* sessionStorage full or unavailable — ignore */
  }
};

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
  setlist_name?: string;
  explanation: string;
  sets: AISuggestionSet[];
}

interface CosmicCharlieWelcomeProps {
  eras: Era[];
  onGenerated: (suggestion: AISuggestion, eraId: string | null) => void;
  onSkip: () => void;
}

// ── Data ────────────────────────────────────────────────────────────────

const ENERGY = [
  { id: "exploratory", emoji: "🌀", label: "Exploratory & deep" },
  { id: "driving", emoji: "⚡", label: "Tight & driving" },
  { id: "mellow", emoji: "🌙", label: "Mellow & slow" },
] as const;

const TEXTURES = [
  { id: "joyful", emoji: "☀️", label: "Joyful" },
  { id: "dark", emoji: "🖤", label: "Dark & heavy" },
  { id: "raw", emoji: "🩸", label: "Raw & emotional" },
  { id: "psychedelic", emoji: "👁️", label: "Psychedelic" },
  { id: "roots", emoji: "🌾", label: "Roots & earthy" },
  { id: "party", emoji: "🔥", label: "Party" },
] as const;

const PRIORITIES = [
  {
    id: "jam",
    emoji: "🎆",
    title: "Let one song become the whole second set",
    desc: "A true jam vehicle that goes somewhere real — Dark Star, Playing, Eyes",
  },
  {
    id: "tight",
    emoji: "🎯",
    title: "Song after song — no wandering",
    desc: "Tight show, precision is the point",
  },
  {
    id: "rare",
    emoji: "💎",
    title: "Surprise me with songs I've never heard in a setlist",
    desc: "Rare songs, rare placements, deep cuts",
  },
  {
    id: "canonical",
    emoji: "👑",
    title: "Show me the greatest version of a great night",
    desc: "The canonical songs, in the right order, at the right level",
  },
  {
    id: "flow",
    emoji: "🌊",
    title: "Flow — one continuous piece of music",
    desc: "Segues everywhere, nothing stops, nothing restarts",
  },
] as const;

// ── Animation ───────────────────────────────────────────────────────────

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

// ── Component ───────────────────────────────────────────────────────────

const TOTAL_STEPS = 4; // welcome(0) + energy(1) + priority(2) + specifics(3)

const CosmicCharlieWelcome = ({ eras, onGenerated, onSkip }: CosmicCharlieWelcomeProps) => {
  const [step, setStep] = useState(0); // 0 = welcome intro
  const [direction, setDirection] = useState(1);

  // Step 0
  const [selectedEnergy, setSelectedEnergy] = useState<string | null>(null);
  const [selectedTextures, setSelectedTextures] = useState<string[]>([]);
  const [selectedEra, setSelectedEra] = useState<string | null>(null);
  // (era picker is now always-visible; no open/close state needed)

  // Step 1
  const [selectedPriority, setSelectedPriority] = useState<string | null>(null);

  // Step 2
  const [mustInclude, setMustInclude] = useState("");
  const [pleaseAvoid, setPleaseAvoid] = useState("");
  const [itsFor, setItsFor] = useState("");

  const [loading, setLoading] = useState(false);
  const recentSongsRef = useRef<string[]>(loadRecentSongs());

  // ── Helpers ─────────────────────────────────────────────────────────

  const toggleTexture = (id: string) => {
    setSelectedTextures((prev) => {
      if (prev.includes(id)) return prev.filter((t) => t !== id);
      if (prev.length >= 2) return prev;
      return [...prev, id];
    });
  };

  const goNext = () => { setDirection(1); setStep((s) => s + 1); };
  const goBack = () => { setDirection(-1); setStep((s) => s - 1); };

  // ── composePreferences ──────────────────────────────────────────────

  const composePreferences = (): string | undefined => {
    const parts: string[] = [];

    if (selectedEnergy) {
      const energyMap: Record<string, string> = {
        exploratory: "This setlist should be exploratory and unhurried. The second set is the point. Long vehicles, open space, jams that don't resolve when expected. Songs are launching pads, not destinations.",
        driving: "This setlist should be tight and driving — song after song with authority. No meandering. Every song earns its place through precision and momentum, not length.",
        mellow: "This setlist should breathe. Set I carries Americana weight. The second set grooves rather than surges. The closing song leaves space rather than filling it.",
      };
      parts.push(energyMap[selectedEnergy]);
    }

    if (selectedTextures.length > 0) {
      const textureMap: Record<string, string> = {
        joyful: "The emotional register is joyful — the band playing like they love being there.",
        dark: "The emotional register is dark and serious. No party songs, no throwaway covers. He's Gone, Wharf Rat, Morning Dew are the currency of this night.",
        raw: "The emotional register is raw. Songs that carry weight beyond their words. Jerry's voice doing more than singing.",
        psychedelic: "The psychedelic dimension is primary. Songs chosen for where they can go, not where they've been.",
        roots: "The Americana and folk roots of the Dead should surface — the Hunter/Garcia songs that sound like they were always folk songs.",
        party: "The band is playing to the room. Openers that announce themselves. Songs that know what they are and deliver it.",
      };
      const textureLines = selectedTextures.map((t) => textureMap[t]).filter(Boolean);
      parts.push(textureLines.join(" "));
    }

    if (selectedPriority) {
      const priorityMap: Record<string, string> = {
        jam: "The user's single priority is depth. One song — Dark Star, Playing in the Band, The Other One, Eyes of the World, or Estimated Prophet — must become the center of gravity for the entire second set. Everything before it builds toward it. Everything after emerges from it changed. Mark jam vehicle extensions with segue arrows.",
        tight: "The user's priority is precision. No extended jam vehicles. Set II runs like Set I — song to song, purposeful. The energy is in the tightness, not the exploration.",
        rare: "The user wants to be surprised. Include at least two songs with genuine rarity — songs played fewer than 50 times in the band's history, or songs placed in positions where they almost never appeared. Rare songs must be structurally earned, not dropped in randomly. Flag each one in the explanation.",
        canonical: "Build the strongest possible version of a transcendent night from the songs a Deadhead would recognize immediately. The test is not 'is this song famous' — it is 'does this song deserve its place in this night's arc.' Every song must justify its position.",
        flow: "Every Set II transition must be a segue, marked with →. Aim for at least one three-song segue chain. The setlist should feel like one continuous piece of music that happens to have song-shaped sections within it.",
      };
      parts.push(priorityMap[selectedPriority]);
    }

    if (mustInclude.trim()) {
      parts.push(`Required inclusions (treat as anchors — build around them): ${mustInclude.trim()}. If a segue pair is specified (e.g. Scarlet > Fire), honor the arrow and place the pair where it makes structural sense.`);
    }

    if (pleaseAvoid.trim()) {
      parts.push(`Do not include: ${pleaseAvoid.trim()}. Honor this absolutely.`);
    }

    if (itsFor.trim()) {
      parts.push(`Context that shapes everything: this setlist is for "${itsFor.trim()}". Read this seriously. A road trip means forward motion — openers that start engines, no songs that stop the car. Converting a friend means the first song must be undeniable. A late night alone means introspective, not social. Calibrate the entire setlist against this context.`);
    }

    parts.push(`REQUIRED: Include exactly one moment in this setlist that a sophisticated Deadhead would stop at and say 'wait — did they actually do that?' This is not a rare song for its own sake. It is a placement, a pairing, or a sequence that reframes something familiar as something unexpected. Examples: Morning Dew placed mid-Set II instead of as a closer; Attics of My Life appearing anywhere after 1972; a historically rare segue pair reconstructed intentionally. One per setlist. The rest of the setlist must be strong enough that this moment lands.`);

    return parts.length > 0 ? parts.join("\n\n") : undefined;
  };

  // ── Generate ────────────────────────────────────────────────────────

  const handleGenerate = async (preferences?: string) => {
    // Pure "Surprise Me" path: no explicit preferences AND no era picked.
    // If we generated one in the last 30s, replay it so back-nav doesn't
    // produce a different show.
    const isPureSurpriseMe = preferences === undefined && !selectedEra;

    if (isPureSurpriseMe) {
      const cached = readSurpriseMeCache();
      if (cached) {
        onGenerated(cached as AISuggestion, null);
        return;
      }
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-deadhead", {
        body: {
          mode: "build",
          eraId: selectedEra || undefined,
          preferences: preferences !== undefined ? preferences : composePreferences(),
          recentSongs: recentSongsRef.current.length > 0 ? recentSongsRef.current : undefined,
          visitorId: getVisitorId(),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const generatedSongs = (data.sets || []).flatMap((s: any) =>
        s.songs.map((song: any) => song.title)
      );
      recentSongsRef.current = appendRecentSongs(generatedSongs);

      if (isPureSurpriseMe) {
        writeSurpriseMeCache(data);
      }

      onGenerated(data, selectedEra);
    } catch (e: any) {
      console.error("AI error:", e);
      toast.error(e.message || "Cosmic Charlie hit a wrong note. Try again.");
      setLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────

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
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              >
                <CosmicCharlieAvatar size={72} animate={false} glow={true} />
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
              <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground/60 uppercase">
                Usually about 5 seconds
              </p>
            </motion.div>
          ) : (
            <>
              {/* Charlie portrait */}
              <CosmicCharlieAvatar size={88} animate />

              {/* Step dots — hidden on the welcome screen; only shown once the user enters the wizard */}
              {step > 0 && (
                <div className="flex gap-2">
                  {Array.from({ length: TOTAL_STEPS - 1 }).map((_, s) => (
                    <div
                      key={s}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        s === step - 1
                          ? "bg-primary scale-125"
                          : s < step - 1
                          ? "bg-primary/50"
                          : "bg-muted-foreground/30"
                      }`}
                    />
                  ))}
                </div>
              )}

              {/* Steps */}
              <AnimatePresence mode="wait" custom={direction}>
                {/* ── Step 0: Welcome Intro ─────────────────────── */}
                {step === 0 && (
                  <motion.div
                    key="welcome"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="w-full flex flex-col items-center gap-6"
                  >
                    <StealYourFace size={72} />

                    <div className="text-center space-y-2">
                      <h1 className="font-display text-2xl sm:text-3xl text-primary leading-tight">
                        Welcome to Dead-Set.Org
                      </h1>
                      <p className="font-mono text-[10px] tracking-[0.28em] text-muted-foreground/50 uppercase">
                        Wake. Now. Discover.
                      </p>
                    </div>

                    <p className="font-body text-base text-muted-foreground leading-relaxed text-center max-w-md px-2">
                      <span className="text-primary font-medium">Charlie</span> knows every show the Dead ever played. Tell him your vibe, or hit Surprise Me and let him cook.
                    </p>

                    <div className="w-full flex flex-col sm:flex-row gap-2.5">
                      <Button
                        size="lg"
                        onClick={() => handleGenerate(undefined)}
                        className="flex-1 gap-2 text-base px-6 py-5 shadow-[0_4px_40px_hsl(var(--glow-gold))]"
                      >
                        🎲 Surprise me — build now
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={goNext}
                        className="flex-1 gap-2 text-base px-6 py-5 border-primary/50 text-primary hover:bg-primary/10"
                      >
                        Customize my show
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>

                    <button
                      onClick={onSkip}
                      className="font-body text-sm text-muted-foreground/70 hover:text-muted-foreground transition-colors underline underline-offset-4 decoration-muted-foreground/30 hover:decoration-muted-foreground/60"
                    >
                      I'll build my own setlist instead
                    </button>
                  </motion.div>
                )}

                {/* ── Step 1: Energy + Textures ─────────────────────── */}
                {step === 1 && (
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
                        What kind of night is it?
                      </h1>
                      <p className="font-body text-sm text-muted-foreground">Pick one energy</p>
                    </div>

                    {/* Energy — single select, 3 columns */}
                    <div className="grid grid-cols-3 gap-2.5 w-full">
                      {ENERGY.map((e) => {
                        const active = selectedEnergy === e.id;
                        return (
                          <motion.button
                            key={e.id}
                            whileTap={{ scale: 0.93 }}
                            whileHover={{ y: -2 }}
                            onClick={() => setSelectedEnergy(active ? null : e.id)}
                            className={`flex flex-col items-center gap-1.5 px-3 py-4 rounded-xl border transition-all duration-200 ${
                              active
                                ? "border-primary bg-primary/15 shadow-[0_0_16px_hsl(var(--glow-gold))]"
                                : "border-border bg-card hover:border-primary/40 hover:bg-card/80"
                            }`}
                          >
                            <motion.span
                              className="text-2xl"
                              animate={active ? { scale: [1, 1.2, 1] } : {}}
                              transition={{ duration: 0.3 }}
                            >
                              {e.emoji}
                            </motion.span>
                            <span
                              className={`font-body text-xs ${
                                active ? "text-primary font-medium" : "text-card-foreground"
                              }`}
                            >
                              {e.label}
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>

                    {/* Section divider */}
                    <p className="font-body text-xs text-muted-foreground uppercase tracking-wider">
                      Texture — pick one or two
                    </p>

                    {/* Textures — multi select, 2 columns */}
                    <div className="grid grid-cols-3 gap-2 w-full">
                      {TEXTURES.map((t) => {
                        const active = selectedTextures.includes(t.id);
                        return (
                          <motion.button
                            key={t.id}
                            whileTap={{ scale: 0.93 }}
                            whileHover={{ y: -2 }}
                            onClick={() => toggleTexture(t.id)}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all duration-200 ${
                              active
                                ? "border-primary bg-primary/15 shadow-[0_0_12px_hsl(var(--glow-gold))]"
                                : "border-border bg-card hover:border-primary/40 hover:bg-card/80"
                            }`}
                          >
                            <motion.span
                              className="text-base"
                              animate={active ? { rotate: [0, -10, 10, 0] } : {}}
                              transition={{ duration: 0.4 }}
                            >
                              {t.emoji}
                            </motion.span>
                            <span
                              className={`font-body text-xs ${
                                active ? "text-primary font-medium" : "text-card-foreground"
                              }`}
                            >
                              {t.label}
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>

                    {/* Era — peer section to Texture, equal real estate */}
                    <p className="font-body text-xs text-muted-foreground uppercase tracking-wider">
                      Era — pick one (optional)
                    </p>

                    <div className="grid grid-cols-3 gap-2 w-full">
                      {eras.map((era) => {
                        const active = selectedEra === era.id;
                        return (
                          <EraTooltip
                            key={era.id}
                            eraName={era.name}
                            yearRange={`${era.year_start}–${era.year_end}`}
                          >
                            <motion.button
                              whileTap={{ scale: 0.93 }}
                              whileHover={{ y: -2 }}
                              onClick={() =>
                                setSelectedEra(active ? null : era.id)
                              }
                              className={`flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-xl border transition-all duration-200 w-full ${
                                active
                                  ? "border-primary bg-primary/15 shadow-[0_0_12px_hsl(var(--glow-gold))]"
                                  : "border-border bg-card hover:border-primary/40 hover:bg-card/80"
                              }`}
                            >
                              <span
                                className={`font-marker text-sm leading-tight text-center ${
                                  active ? "text-primary" : "text-card-foreground"
                                }`}
                              >
                                {era.name}
                              </span>
                              <span className="text-[10px] font-mono text-muted-foreground/70 tracking-wide">
                                {era.year_start}–{era.year_end}
                              </span>
                            </motion.button>
                          </EraTooltip>
                        );
                      })}
                    </div>

                    <Button
                      size="lg"
                      onClick={goNext}
                      disabled={!selectedEnergy}
                      className="w-full font-display text-base px-8 py-6 bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_30px_hsl(var(--glow-gold))] tracking-widest uppercase gap-2"
                    >
                      Next
                    </Button>

                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => handleGenerate(undefined)}
                      className="w-full gap-2 text-base border-primary/40 text-primary hover:bg-primary/10"
                    >
                      🎲 Surprise me — build now
                    </Button>
                  </motion.div>
                )}

                {/* ── Step 2: Priority (radio) ──────────────────────── */}
                {step === 2 && (
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
                        What's the one thing that matters most?
                      </h1>
                      <p className="font-body text-sm text-muted-foreground">
                        Pick one — this shapes the whole night
                      </p>
                    </div>

                    <div className="flex flex-col gap-2.5 w-full">
                      {PRIORITIES.map((p) => {
                        const active = selectedPriority === p.id;
                        return (
                          <motion.button
                            key={p.id}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => setSelectedPriority(active ? null : p.id)}
                            className={`flex items-start gap-3.5 px-4 py-3.5 rounded-lg border text-left transition-all duration-200 ${
                              active
                                ? "border-primary bg-primary/15 shadow-[0_0_12px_hsl(var(--glow-gold))]"
                                : "border-border bg-card hover:border-primary/40"
                            }`}
                          >
                            {/* Emoji + Radio */}
                            <div className="mt-0.5 flex-shrink-0 flex items-center gap-2">
                              <motion.span
                                className="text-lg"
                                animate={active ? { scale: [1, 1.3, 1] } : {}}
                                transition={{ duration: 0.3 }}
                              >
                                {p.emoji}
                              </motion.span>
                              <div
                                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors duration-200 ${
                                  active ? "border-primary" : "border-muted-foreground/40"
                                }`}
                              >
                                {active && (
                                  <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="w-2 h-2 rounded-full bg-primary"
                                  />
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span
                                className={`font-body text-sm font-semibold ${
                                  active ? "text-primary" : "text-card-foreground"
                                }`}
                              >
                                {p.title}
                              </span>
                              <span className="font-body text-xs text-muted-foreground">
                                {p.desc}
                              </span>
                            </div>
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
                        disabled={!selectedPriority}
                        className="flex-1 font-display text-base px-8 py-6 bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_30px_hsl(var(--glow-gold))] tracking-widest uppercase gap-2"
                      >
                        Next
                      </Button>
                    </div>

                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => handleGenerate(undefined)}
                      className="w-full gap-2 text-base border-primary/40 text-primary hover:bg-primary/10"
                    >
                      🎲 Surprise me — build now
                    </Button>
                  </motion.div>
                )}

                {/* ── Step 3: Specifics ─────────────────────────────── */}
                {step === 3 && (
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
                        All optional — skip straight to Charlie if you want
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
                          className="bg-card border-border text-card-foreground font-body text-sm"
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
                          className="bg-card border-border text-card-foreground font-body text-sm"
                        />
                      </div>
                      {/* Gold-bordered invitation field */}
                      <div className="space-y-1.5 border-l-2 border-[hsl(var(--dead-gold))] pl-3.5 bg-primary/5 rounded-r-lg py-2.5 pr-3">
                        <label className="font-body text-xs text-muted-foreground uppercase tracking-wider">
                          What does a perfect night feel like to you?
                        </label>
                        <Input
                          value={itsFor}
                          onChange={(e) => setItsFor(e.target.value)}
                          placeholder="e.g. a late night drive alone, converting a friend"
                          className="bg-card border-border text-card-foreground font-body text-sm"
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

                    <button
                      onClick={onSkip}
                      className="font-body text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors underline underline-offset-2"
                    >
                      or build from scratch →
                    </button>
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

export default CosmicCharlieWelcome;
