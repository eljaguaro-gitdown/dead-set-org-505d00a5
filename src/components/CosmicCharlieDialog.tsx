import { useState, useRef, useEffect, useMemo } from "react";
import { Star, Wand2, Search, Disc3, Play } from "lucide-react";
import { useAudioPlayer, type PlayableSlot } from "@/contexts/AudioPlayerContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import CosmicCharlieAvatar from "@/components/CosmicCharlieAvatar";
import type { Database } from "@/integrations/supabase/types";
import {
  getVisitorId,
  loadRecentSongs,
  appendRecentSongs,
} from "@/lib/cosmicCharlieHistory";
import { extractTasteMatches, type LengthHint } from "@/lib/charlie/tasteLexicon";

type Song = Database["public"]["Tables"]["songs"]["Row"];
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

interface ExploreVersion {
  songTitle: string;
  showDate: string;
  venue: string | null;
  city: string | null;
  description: string | null;
  archiveUrl: string | null;
  rating: number | null;
  eraName: string | null;
  whyThisVersion: string;
}

interface ExploreResult {
  songTitle: string;
  linerNotes: string;
  versions: ExploreVersion[];
}

interface AISuggestion {
  setlist_name?: string;
  explanation: string;
  sets: AISuggestionSet[];
}

interface CosmicCharlieDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eraId: string | null;
  currentSlots: { songTitle: string; setNumber: number; segue: boolean }[];
  onApplySuggestion: (suggestion: AISuggestion) => void;
  onCreateNewSetlist: (suggestion: AISuggestion, customTitle?: string) => void;
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
  { id: "indica", emoji: "🌙", label: "Indica" },
  { id: "sativa", emoji: "☀️", label: "Sativa" },
  { id: "hybrid", emoji: "🌿", label: "Hybrid" },
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
  enter: (direction: number) => ({ x: direction > 0 ? 200 : -200, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? -200 : 200, opacity: 0 }),
};

const CosmicCharlieDialog = ({
  open,
  onOpenChange,
  eraId,
  currentSlots,
  onApplySuggestion,
  onCreateNewSetlist,
}: CosmicCharlieDialogProps) => {
  const { playSingle } = useAudioPlayer();
  const [mode, setMode] = useState<"build" | "improve" | "explore" | null>(null);
  const [preferences, setPreferences] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null);
  const [namingNew, setNamingNew] = useState(false);
  const [newSetlistName, setNewSetlistName] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const recentSongsRef = useRef<string[]>(loadRecentSongs());

  // Guided build flow state
  const [buildStep, setBuildStep] = useState(0);
  const [buildDirection, setBuildDirection] = useState(1);
  const [selectedVibes, setSelectedVibes] = useState<typeof VIBES>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<typeof PRIORITIES>([]);
  const [moodText, setMoodText] = useState("");
  const [mustInclude, setMustInclude] = useState("");
  const [pleaseAvoid, setPleaseAvoid] = useState("");
  const [itsFor, setItsFor] = useState("");

  // Version Explorer state
  const [exploreStep, setExploreStep] = useState(0);
  const [songSearch, setSongSearch] = useState("");
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [allEras, setAllEras] = useState<Era[]>([]);
  const [selectedEraIds, setSelectedEraIds] = useState<string[]>([]);
  const [surpriseMe, setSurpriseMe] = useState(false);
  const [exploreResult, setExploreResult] = useState<ExploreResult | null>(null);

  // Load songs & eras when explore mode is entered
  useEffect(() => {
    if (mode !== "explore") return;
    const load = async () => {
      const [songsRes, erasRes] = await Promise.all([
        supabase.from("songs").select("*").order("title"),
        supabase.from("eras").select("*").order("year_start"),
      ]);
      if (songsRes.data) setAllSongs(songsRes.data);
      if (erasRes.data) setAllEras(erasRes.data);
    };
    load();
  }, [mode]);

  const filteredSongs = useMemo(() => {
    if (!songSearch.trim()) return [];
    const q = songSearch.toLowerCase();
    return allSongs.filter((s) => s.title.toLowerCase().includes(q)).slice(0, 8);
  }, [songSearch, allSongs]);

  const toggleEra = (eraId: string) => {
    setSelectedEraIds((prev) =>
      prev.includes(eraId) ? prev.filter((id) => id !== eraId) : [...prev, eraId]
    );
    setSurpriseMe(false);
  };

  useEffect(() => {
    if (namingNew) nameInputRef.current?.focus();
  }, [namingNew]);

  const toggleVibe = (vibe: (typeof VIBES)[number]) => {
    setSelectedVibes((prev) => {
      const exists = prev.find((v) => v.id === vibe.id);
      if (exists) return prev.filter((v) => v.id !== vibe.id);
      if (prev.length >= 4) return prev;
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

  const moodMatches = useMemo(
    () => extractTasteMatches(moodText),
    [moodText]
  );

  const composePreferences = (): string | undefined => {
    const parts: string[] = [];
    if (selectedVibes.length > 0) {
      parts.push(`User wants a ${selectedVibes.map((v) => v.label).join(" and ")} vibe.`);
    }
    if (selectedPriorities.length > 0) {
      parts.push(`${selectedPriorities.map((p) => p.label).join(". ")}.`);
    }
    if (mustInclude.trim()) parts.push(`Must include: ${mustInclude.trim()}.`);
    if (pleaseAvoid.trim()) parts.push(`Please avoid: ${pleaseAvoid.trim()}.`);
    if (itsFor.trim()) parts.push(`This setlist is for: ${itsFor.trim()}.`);
    if (moodText.trim()) {
      parts.push(`Mood: ${moodText.trim()}.`);
    }
    if (moodMatches.length) {
      const lengthCopy: Record<LengthHint, string> = {
        tight: "Keep songs tight — minimize extended jams.",
        stretched: "Let the jam vehicles stretch out.",
        marathon: "At least one Set II song should be a true marathon (30+ minutes if the era supports it).",
      };
      parts.push(lengthCopy[moodMatches.length]);
    }
    return parts.length > 0 ? parts.join(" ") : undefined;
  };

  const goNextBuild = () => {
    setBuildDirection(1);
    setBuildStep((s) => s + 1);
  };

  const goBackBuild = () => {
    setBuildDirection(-1);
    setBuildStep((s) => s - 1);
  };

  const handleGenerate = async (overridePrefs?: string) => {
    setLoading(true);
    setSuggestion(null);

    const finalPrefs = mode === "build"
      ? (overridePrefs !== undefined ? overridePrefs : composePreferences())
      : (preferences.trim() || undefined);

    try {
      const { data, error } = await supabase.functions.invoke("ai-deadhead", {
        body: {
          mode,
          eraId,
          currentSlots: mode === "improve" ? currentSlots : undefined,
          preferences: finalPrefs,
          recentSongs: recentSongsRef.current.length > 0 ? recentSongsRef.current : undefined,
          visitorId: getVisitorId(),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const generatedSongs = (data.sets || []).flatMap((s: any) => s.songs.map((song: any) => song.title));
      recentSongsRef.current = appendRecentSongs(generatedSongs);

      setSuggestion(data);
    } catch (e: any) {
      console.error("AI error:", e);
      toast.error(e.message || "Cosmic Charlie hit a wrong note. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleExplore = async () => {
    if (!selectedSong) return;
    setLoading(true);
    setExploreResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("ai-deadhead", {
        body: {
          mode: "explore",
          songTitle: selectedSong.title,
          songId: selectedSong.id,
          eraIds: surpriseMe ? null : selectedEraIds.length > 0 ? selectedEraIds : null,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setExploreResult(data);
    } catch (e: any) {
      console.error("AI error:", e);
      toast.error(e.message || "Cosmic Charlie hit a wrong note. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!suggestion) return;
    onApplySuggestion(suggestion);
    handleReset();
    toast.success("Charlie's setlist is locked in! 🎶");
  };

  const handleCreateNew = () => {
    if (!suggestion) return;
    const title = newSetlistName.trim() || suggestion.setlist_name?.trim() || undefined;
    onCreateNewSetlist(suggestion, title);
    handleReset();
    toast.success("Charlie's cooking up a new setlist...");
  };

  const resetExploreState = () => {
    setExploreStep(0);
    setSongSearch("");
    setSelectedSong(null);
    setSelectedEraIds([]);
    setSurpriseMe(false);
    setExploreResult(null);
  };

  const handleReset = () => {
    onOpenChange(false);
    setMode(null);
    setSuggestion(null);
    setPreferences("");
    setNamingNew(false);
    setNewSetlistName("");
    setBuildStep(0);
    setSelectedVibes([]);
    setSelectedPriorities([]);
    setMustInclude("");
    setPleaseAvoid("");
    setItsFor("");
    setMoodText("");
    resetExploreState();
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setMode(null);
      setSuggestion(null);
      setPreferences("");
      setLoading(false);
      setNamingNew(false);
      setNewSetlistName("");
      setBuildStep(0);
      setSelectedVibes([]);
      setSelectedPriorities([]);
      setMustInclude("");
      setPleaseAvoid("");
      setItsFor("");
      setMoodText("");
      resetExploreState();
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <CosmicCharlieAvatar size={48} animate />
            <div>
              <DialogTitle className="font-display text-xl text-foreground">
                Cosmic Charlie
              </DialogTitle>
              <p className="text-xs text-muted-foreground font-body">Your Deadhead Guide</p>
            </div>
          </div>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {/* Mode selection */}
          {!mode && !suggestion && !loading && (
            <motion.div
              key="mode-select"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-3"
            >
              <p className="text-sm text-muted-foreground font-body">
                Charlie's been to every show and remembers every setlist. What do you need?
              </p>
              <button
                onClick={() => setMode("build")}
                className="w-full p-4 rounded-lg border border-border bg-background hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                    <Star className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm text-foreground">Need a Miracle?</h3>
                    <p className="text-xs text-muted-foreground font-body mt-0.5">
                      Let Charlie build you a full dream setlist from scratch
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
                    <Wand2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm text-foreground">Ask Charlie to Improve This</h3>
                    <p className="text-xs text-muted-foreground font-body mt-0.5">
                      Charlie'll optimize flow, suggest swaps &amp; find segue opportunities
                    </p>
                  </div>
                </div>
              </button>
              <button
                onClick={() => setMode("explore")}
                className="w-full p-4 rounded-lg border border-border bg-background hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                    <Disc3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm text-foreground">Version Explorer</h3>
                    <p className="text-xs text-muted-foreground font-body mt-0.5">
                      Discover the best versions of your favorite song across eras
                    </p>
                  </div>
                </div>
              </button>
            </motion.div>
          )}

          {/* BUILD MODE: Guided 3-step flow */}
          {mode === "build" && !suggestion && !loading && (
            <motion.div
              key="build-guided"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              {/* Step indicator */}
              <div className="flex items-center justify-center gap-2">
                {[0, 1, 2, 3].map((s) => (
                  <div
                    key={s}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      s === buildStep ? "bg-primary scale-125" : s < buildStep ? "bg-primary/50" : "bg-muted"
                    }`}
                  />
                ))}
              </div>

              <AnimatePresence mode="wait" custom={buildDirection}>
                {buildStep === 0 && (
                  <motion.div
                    key="mood"
                    custom={buildDirection}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    <div className="text-center space-y-1">
                      <h3 className="font-display text-lg text-primary">What kind of night?</h3>
                      <p className="font-body text-xs text-muted-foreground">
                        Tell Charlie in your own words — a long fiery Dark Star, a silky smooth Eyes, a brain-melt Set II. Or skip it.
                      </p>
                    </div>
                    <div className="relative">
                      <textarea
                        value={moodText}
                        onChange={(e) => setMoodText(e.target.value)}
                        placeholder='e.g. "a long stretched-out exploratory ’77 night with a sick segue"'
                        className="w-full min-h-[88px] p-3 pr-9 rounded-md border border-border bg-background text-sm font-body focus:border-primary focus:ring-1 focus:ring-primary/40 outline-none resize-none"
                        maxLength={500}
                      />
                      {moodText.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setMoodText("")}
                          aria-label="Clear description"
                          className="absolute top-2 right-2 h-6 w-6 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {moodMatches.matchedPhrases.length > 0 && (
                      <div className="space-y-2 text-xs font-body text-muted-foreground">
                        <div>
                          Charlie heard:{" "}
                          {moodMatches.matchedPhrases.slice(0, 6).map((p, i) => (
                            <span key={p} className="inline-block">
                              <span className="text-primary">{p}</span>
                              {i < Math.min(moodMatches.matchedPhrases.length, 6) - 1 ? ", " : ""}
                            </span>
                          ))}
                          {moodMatches.matchedPhrases.length > 6 && "..."}
                        </div>
                        <div className="text-muted-foreground/70">
                          He'll bias toward{" "}
                          {moodMatches.vibes.length > 0 && (
                            <>{moodMatches.vibes.length} vibe{moodMatches.vibes.length > 1 ? "s" : ""}</>
                          )}
                          {moodMatches.vibes.length > 0 && moodMatches.priorities.length > 0 && " · "}
                          {moodMatches.priorities.length > 0 && (
                            <>{moodMatches.priorities.length} priorit{moodMatches.priorities.length > 1 ? "ies" : "y"}</>
                          )}
                          {moodMatches.length && ` · ${moodMatches.length} pacing`}
                          . You'll see the chips light up on the next screens.
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setMode(null)}
                        className="font-body text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        ← Back
                      </button>
                      <Button
                        size="sm"
                        onClick={goNextBuild}
                        className="flex-1 bg-primary text-primary-foreground font-body"
                      >
                        {moodText.trim() ? "Continue" : "Skip"} →
                      </Button>
                    </div>
                  </motion.div>
                )}

                {buildStep === 1 && (
                  <motion.div
                    key="vibe"
                    custom={buildDirection}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    <div className="text-center space-y-1">
                      <h3 className="font-display text-lg text-primary">What's the vibe tonight?</h3>
                      <p className="font-body text-xs text-muted-foreground">Pick up to four</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {VIBES.map((vibe) => {
                        const selected = selectedVibes.some((v) => v.id === vibe.id);
                        const suggested = !selected && (moodMatches.vibes as string[]).includes(vibe.id);
                        return (
                          <motion.button
                            key={vibe.id}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => toggleVibe(vibe)}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left transition-all duration-200 text-sm ${
                              selected
                                ? "border-primary bg-primary/15 shadow-[0_0_10px_hsl(var(--glow-gold))]"
                                : suggested
                                ? "border-primary/60 bg-primary/5 ring-1 ring-primary/30"
                                : "border-border bg-background hover:border-primary/40"
                            }`}
                          >
                            <span className="text-base">{vibe.emoji}</span>
                            <span className={`font-body text-xs ${selected ? "text-primary" : "text-foreground"}`}>
                              {vibe.label}
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={goBackBuild}
                        className="font-body text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        ← Back
                      </button>
                      <Button
                        size="sm"
                        onClick={goNextBuild}
                        disabled={selectedVibes.length === 0}
                        className="flex-1 bg-primary text-primary-foreground font-body"
                      >
                        Next
                      </Button>
                    </div>
                    <button
                      onClick={() => handleGenerate(undefined)}
                      className="w-full font-body text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors text-center"
                    >
                      🎲 Surprise me — skip all this
                    </button>
                  </motion.div>
                )}

                {buildStep === 2 && (
                  <motion.div
                    key="priorities"
                    custom={buildDirection}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    <div className="text-center space-y-1">
                      <h3 className="font-display text-lg text-primary">What matters most?</h3>
                      <p className="font-body text-xs text-muted-foreground">Pick one or two</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      {PRIORITIES.map((priority) => {
                        const selected = selectedPriorities.some((p) => p.id === priority.id);
                        const suggested = !selected && (moodMatches.priorities as string[]).includes(priority.id);
                        return (
                          <motion.button
                            key={priority.id}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => togglePriority(priority)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all duration-200 ${
                              selected
                                ? "border-primary bg-primary/15 shadow-[0_0_10px_hsl(var(--glow-gold))]"
                                : suggested
                                ? "border-primary/60 bg-primary/5 ring-1 ring-primary/30"
                                : "border-border bg-background hover:border-primary/40"
                            }`}
                          >
                            <span className="text-base">{priority.emoji}</span>
                            <span className={`font-body text-xs ${selected ? "text-primary" : "text-foreground"}`}>
                              {priority.label}
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={goBackBuild}
                        className="font-body text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        ← Back
                      </button>
                      <Button
                        size="sm"
                        onClick={goNextBuild}
                        disabled={selectedPriorities.length === 0}
                        className="flex-1 bg-primary text-primary-foreground font-body"
                      >
                        Next
                      </Button>
                    </div>
                  </motion.div>
                )}

                {buildStep === 3 && (
                  <motion.div
                    key="specifics"
                    custom={buildDirection}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    <div className="text-center space-y-1">
                      <h3 className="font-display text-lg text-primary">Anything specific?</h3>
                      <p className="font-body text-xs text-muted-foreground">Totally optional — skip if you want</p>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="font-body text-[10px] text-muted-foreground uppercase tracking-wider">Must include</label>
                        <Input
                          value={mustInclude}
                          onChange={(e) => setMustInclude(e.target.value)}
                          placeholder="e.g. Scarlet > Fire, Dark Star"
                          className="bg-background border-border text-foreground font-body text-xs h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-body text-[10px] text-muted-foreground uppercase tracking-wider">Please avoid</label>
                        <Input
                          value={pleaseAvoid}
                          onChange={(e) => setPleaseAvoid(e.target.value)}
                          placeholder="e.g. Touch of Grey, Drums/Space"
                          className="bg-background border-border text-foreground font-body text-xs h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-body text-[10px] text-muted-foreground uppercase tracking-wider">It's for…</label>
                        <Input
                          value={itsFor}
                          onChange={(e) => setItsFor(e.target.value)}
                          placeholder="e.g. a road trip, converting a friend"
                          className="bg-background border-border text-foreground font-body text-xs h-8"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={goBackBuild}
                        className="font-body text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        ← Back
                      </button>
                      <Button
                        size="sm"
                        onClick={() => handleGenerate()}
                        className="flex-1 bg-primary text-primary-foreground font-body gap-1.5"
                      >
                        <Star className="w-3.5 h-3.5" />
                        ✨ Let Charlie Cook
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* IMPROVE MODE: Keep the free-text textarea */}
          {mode === "improve" && !suggestion && !loading && (
            <motion.div
              key="preferences"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              <div>
                <label className="text-xs text-muted-foreground font-body block mb-1.5">
                  What should Charlie fix?
                </label>
                <Textarea
                  value={preferences}
                  onChange={(e) => setPreferences(e.target.value)}
                  placeholder="e.g. Set 2 needs more energy, add a space segment before drums..."
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
                  onClick={() => handleGenerate()}
                  className="bg-primary text-primary-foreground font-body gap-1.5 flex-1"
                >
                  <Star className="w-3.5 h-3.5" />
                  Charlie, Fix This
                </Button>
              </div>
            </motion.div>
          )}

          {/* EXPLORE MODE: Version Explorer wizard */}
          {mode === "explore" && !exploreResult && !loading && (
            <motion.div key="explore-wizard" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
              <div className="flex items-center justify-center gap-2">
                {[0, 1].map((s) => (
                  <div key={s} className={`w-2 h-2 rounded-full transition-all duration-300 ${s === exploreStep ? "bg-primary scale-125" : s < exploreStep ? "bg-primary/50" : "bg-muted"}`} />
                ))}
              </div>
              <AnimatePresence mode="wait" custom={1}>
                {exploreStep === 0 && (
                  <motion.div key="explore-song" custom={1} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }} className="space-y-4">
                    <div className="text-center space-y-1">
                      <h3 className="font-display text-lg text-primary">Which song?</h3>
                      <p className="font-body text-xs text-muted-foreground">Pick the song you want to explore</p>
                    </div>
                    {selectedSong ? (
                      <div className="flex items-center gap-2 p-3 rounded-lg border border-primary bg-primary/10">
                        <Disc3 className="w-4 h-4 text-primary" />
                        <span className="font-body text-sm text-foreground flex-1">{selectedSong.title}</span>
                        <button onClick={() => { setSelectedSong(null); setSongSearch(""); }} className="text-xs text-muted-foreground hover:text-foreground">Change</button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                          <Input value={songSearch} onChange={(e) => setSongSearch(e.target.value)} placeholder="Search for a song..." className="bg-background border-border text-foreground font-body text-xs h-8 pl-8" autoFocus />
                        </div>
                        {filteredSongs.length > 0 && (
                          <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-background">
                            {filteredSongs.map((song) => (
                              <button key={song.id} onClick={() => { setSelectedSong(song); setSongSearch(""); }} className="w-full text-left px-3 py-2 hover:bg-primary/5 transition-colors border-b border-border last:border-b-0">
                                <span className="font-body text-xs text-foreground">{song.title}</span>
                                {song.times_played != null && <span className="text-[10px] text-muted-foreground ml-2">{song.times_played}x played</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <button onClick={() => setMode(null)} className="font-body text-xs text-muted-foreground hover:text-foreground transition-colors">← Back</button>
                      <Button size="sm" onClick={() => setExploreStep(1)} disabled={!selectedSong} className="flex-1 bg-primary text-primary-foreground font-body">Next</Button>
                    </div>
                  </motion.div>
                )}
                {exploreStep === 1 && (
                  <motion.div key="explore-eras" custom={1} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }} className="space-y-4">
                    <div className="text-center space-y-1">
                      <h3 className="font-display text-lg text-primary">Which eras?</h3>
                      <p className="font-body text-xs text-muted-foreground">Pick one or more, or let Charlie surprise you</p>
                    </div>
                    <motion.button whileTap={{ scale: 0.97 }} onClick={() => { setSurpriseMe(true); setSelectedEraIds([]); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all duration-200 ${surpriseMe ? "border-primary bg-primary/15 shadow-[0_0_10px_hsl(var(--glow-gold))]" : "border-border bg-background hover:border-primary/40"}`}>
                      <span className="text-base">🎲</span>
                      <span className={`font-body text-xs ${surpriseMe ? "text-primary" : "text-foreground"}`}>Surprise me — all eras</span>
                    </motion.button>
                    <div className="grid grid-cols-2 gap-2">
                      {allEras.map((era) => {
                        const selected = selectedEraIds.includes(era.id);
                        return (
                          <motion.button key={era.id} whileTap={{ scale: 0.95 }} onClick={() => toggleEra(era.id)} className={`flex flex-col px-3 py-2 rounded-lg border text-left transition-all duration-200 text-xs ${selected ? "border-primary bg-primary/15 shadow-[0_0_10px_hsl(var(--glow-gold))]" : "border-border bg-background hover:border-primary/40"}`}>
                            <span className={`font-body ${selected ? "text-primary" : "text-foreground"}`}>{era.name}</span>
                            <span className="text-[10px] text-muted-foreground">{era.year_start}–{era.year_end}</span>
                          </motion.button>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setExploreStep(0)} className="font-body text-xs text-muted-foreground hover:text-foreground transition-colors">← Back</button>
                      <Button size="sm" onClick={handleExplore} disabled={!surpriseMe && selectedEraIds.length === 0} className="flex-1 bg-primary text-primary-foreground font-body gap-1.5">
                        <Disc3 className="w-3.5 h-3.5" /> 🔍 Explore Versions
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* EXPLORE RESULTS */}
          {exploreResult && (
            <motion.div key="explore-result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
              <div className="text-center">
                <h3 className="font-display text-lg text-primary">"{exploreResult.songTitle}"</h3>
                <p className="text-xs text-muted-foreground font-body mt-1">Version Explorer</p>
              </div>
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-xs text-primary font-body mb-1">Charlie's Liner Notes:</p>
                <p className="text-sm text-foreground font-body leading-relaxed whitespace-pre-line">{exploreResult.linerNotes}</p>
              </div>
              <div className="space-y-3">
                {exploreResult.versions.map((v, i) => (
                  <div key={i} className="p-3 rounded-lg border border-border bg-background space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-display text-sm text-foreground">{v.showDate}</p>
                        <p className="text-xs text-muted-foreground font-body">{[v.venue, v.city].filter(Boolean).join(", ")}</p>
                      </div>
                      {v.rating && (
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: v.rating }).map((_, j) => (
                            <Star key={j} className="w-3 h-3 text-primary fill-primary" />
                          ))}
                        </div>
                      )}
                    </div>
                    {v.eraName && <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-body">{v.eraName}</span>}
                    <p className="text-xs text-foreground/80 font-body leading-relaxed">{v.whyThisVersion}</p>
                    {v.archiveUrl && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs font-body gap-1 border-primary/30 text-primary hover:bg-primary/10"
                          onClick={() => {
                            const slot: PlayableSlot = {
                              id: `explore-${i}-${v.showDate}`,
                              song: { id: "", title: exploreResult.songTitle },
                              version: {
                                id: "", song_id: "", show_date: v.showDate,
                                archive_org_url: v.archiveUrl!, venue: v.venue,
                                city: v.city, era_id: null, rating: v.rating, description: v.description,
                              },
                              setNumber: 1,
                              position: i,
                              segueToNext: false,
                            };
                            playSingle(slot);
                          }}
                        >
                          <Play className="w-3 h-3 fill-current" /> Play this version
                        </Button>
                        <a href={v.archiveUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-muted-foreground hover:text-primary hover:underline font-body">Archive.org ↗</a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={() => {
                    if (!exploreResult || !selectedSong) return;
                    const fakeSuggestion: AISuggestion = {
                      setlist_name: `${exploreResult.songTitle} — Listening Guide`,
                      explanation: exploreResult.linerNotes,
                      sets: [{
                        setNumber: 1,
                        songs: exploreResult.versions.map((v, i) => ({
                          songId: selectedSong.id,
                          title: exploreResult.songTitle,
                          matched: true,
                          segueToNext: false,
                          notes: `${v.showDate} — ${v.venue || "Unknown Venue"}${v.whyThisVersion ? ` • ${v.whyThisVersion}` : ""}`,
                          position: i + 1,
                        })),
                      }],
                    };
                    onCreateNewSetlist(fakeSuggestion, fakeSuggestion.setlist_name);
                    handleReset();
                    toast.success("Listening guide saved as a new setlist! 🎧");
                  }}
                  className="bg-primary text-primary-foreground font-body gap-1.5 w-full"
                >
                  <Star className="w-3.5 h-3.5" /> Save as Listening Guide
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setExploreResult(null); setExploreStep(1); }} className="border-border text-muted-foreground font-body gap-1.5">
                    <Disc3 className="w-3.5 h-3.5" /> Try Again
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setExploreResult(null); resetExploreState(); setMode(null); }} className="border-border text-muted-foreground font-body flex-1">Done</Button>
                </div>
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
              <motion.div
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              >
                <CosmicCharlieAvatar size={48} animate={false} glow={true} />
              </motion.div>
              <p className="text-sm text-muted-foreground font-body">
                Cosmic Charlie is digging through the tapes...
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
              {suggestion.setlist_name && (
                <p className="font-display text-sm text-primary text-center">"{suggestion.setlist_name}"</p>
              )}
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-xs text-primary font-body mb-1">Charlie says:</p>
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
                    onClick={() => handleGenerate()}
                    className="border-border text-muted-foreground font-body gap-1.5"
                  >
                    <Star className="w-3.5 h-3.5" /> Ask Again
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleApply}
                    className="bg-primary text-primary-foreground font-body gap-1.5 flex-1"
                  >
                    Charlie's got it — Apply
                  </Button>
                </div>
                {!namingNew ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setNewSetlistName(suggestion?.setlist_name?.trim() || "Cosmic Charlie's Pick");
                      setNamingNew(true);
                    }}
                    className="border-primary/30 text-primary font-body gap-1.5 w-full hover:bg-primary/10"
                  >
                    <Wand2 className="w-3.5 h-3.5" /> Create as New Setlist
                  </Button>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="space-y-2"
                  >
                    <label className="text-xs text-muted-foreground font-body block">
                      Name your setlist
                    </label>
                    <Input
                      ref={nameInputRef}
                      value={newSetlistName}
                      onChange={(e) => setNewSetlistName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCreateNew()}
                      placeholder="e.g. Cornell '77 Dream Set"
                      className="bg-background border-border text-foreground font-body text-sm h-8"
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setNamingNew(false)}
                        className="text-muted-foreground font-body"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleCreateNew}
                        className="bg-primary text-primary-foreground font-body gap-1.5 flex-1"
                      >
                        <Wand2 className="w-3.5 h-3.5" /> Create Setlist
                      </Button>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

export default CosmicCharlieDialog;
