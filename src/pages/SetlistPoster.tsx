import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Share2, Zap, Play, Headphones } from "lucide-react";
import EraTooltip from "@/components/EraTooltip";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import StealYourFace from "@/components/StealYourFace";
import DancingBear from "@/components/DancingBear";
import ShareDropdown from "@/components/ShareDropdown";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Setlist = Database["public"]["Tables"]["setlists"]["Row"];
type SetlistSlot = Database["public"]["Tables"]["setlist_slots"]["Row"];
type Song = Database["public"]["Tables"]["songs"]["Row"];
type NotableVersion = Database["public"]["Tables"]["notable_versions"]["Row"];
type Era = Database["public"]["Tables"]["eras"]["Row"];

interface EnrichedSlot extends SetlistSlot {
  song: Song;
  version: NotableVersion | null;
}

/** Era-specific accent colors (HSL values matching index.css tokens) */
const ERA_THEMES: Record<string, { accent: string; glow: string; label: string }> = {
  "Primal Dead": { accent: "var(--dead-red)", glow: "var(--glow-red)", label: "1965–1970" },
  "'72 Europe": { accent: "var(--dead-blue)", glow: "var(--dead-blue) / 0.3", label: "1972" },
  "Wall of Sound": { accent: "var(--dead-orange)", glow: "var(--dead-orange) / 0.3", label: "1973–1974" },
  "Terrapin Era": { accent: "var(--dead-gold)", glow: "var(--glow-gold)", label: "1977" },
  "'80s Dead": { accent: "var(--dead-pink)", glow: "var(--dead-pink) / 0.3", label: "1980–1989" },
  "Brent Era": { accent: "var(--dead-green)", glow: "var(--dead-green) / 0.3", label: "1979–1990" },
  "Vince Era": { accent: "var(--dead-purple)", glow: "var(--dead-purple) / 0.3", label: "1990–1995" },
};

const getEraTheme = (eraName: string | null) => {
  if (!eraName) return { accent: "var(--primary)", glow: "var(--glow-gold)", label: "" };
  for (const [key, theme] of Object.entries(ERA_THEMES)) {
    if (eraName.toLowerCase().includes(key.toLowerCase())) return theme;
  }
  return { accent: "var(--primary)", glow: "var(--glow-gold)", label: "" };
};

const SetlistPoster = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { playSingle, playSetlist: globalPlaySetlist, playingSlot } = useAudioPlayer();
  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [slots, setSlots] = useState<EnrichedSlot[]>([]);
  const [creatorName, setCreatorName] = useState("Unknown Head");
  const [eraName, setEraName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasUpvoted, setHasUpvoted] = useState(false);
  const [upvoteCount, setUpvoteCount] = useState(0);
  const [upvoting, setUpvoting] = useState(false);
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);

  const eraTheme = useMemo(() => getEraTheme(eraName), [eraName]);

  useEffect(() => {
    if (!id) return;
    const fetchSetlist = async () => {
      setLoading(true);

      const { data: setlistData } = await supabase
        .from("setlists")
        .select("*")
        .eq("id", id)
        .single();

      if (!setlistData) { setLoading(false); return; }
      setSetlist(setlistData);
      setUpvoteCount(setlistData.upvote_count || 0);

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
        const enriched = await Promise.all(
          slotsRes.data.map(async (slot) => {
            const [songRes, versionRes] = await Promise.all([
              supabase.from("songs").select("*").eq("id", slot.song_id).single(),
              slot.notable_version_id
                ? supabase.from("notable_versions").select("*").eq("id", slot.notable_version_id).single()
                : Promise.resolve({ data: null }),
            ]);
            return { ...slot, song: songRes.data!, version: versionRes.data } as EnrichedSlot;
          })
        );
        setSlots(enriched);
      }
      setLoading(false);
    };
    fetchSetlist();
  }, [id]);

  // Dynamic OG meta tags
  useEffect(() => {
    if (!setlist || slots.length === 0) return;
    const songNames = slots.slice(0, 3).map((s) => s.song.title).join(", ");
    const desc = `A${eraName ? ` ${eraName}` : ""} dream setlist by ${creatorName}. ${slots.length} songs including ${songNames}...`;
    const ogTitle = `${setlist.title} — Dead Set`;
    const canonicalUrl = `${window.location.origin}/setlist/${id}`;
    const ogImageUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/og-image?id=${id}`;

    document.title = ogTitle;

    const setMeta = (property: string, content: string) => {
      let el = document.querySelector(`meta[property="${property}"]`) || document.querySelector(`meta[name="${property}"]`);
      if (!el) {
        el = document.createElement("meta");
        if (property.startsWith("og:")) el.setAttribute("property", property);
        else el.setAttribute("name", property);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    setMeta("og:title", ogTitle);
    setMeta("og:description", desc);
    setMeta("og:image", ogImageUrl);
    setMeta("og:url", canonicalUrl);
    setMeta("og:type", "website");
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", ogTitle);
    setMeta("twitter:description", desc);
    setMeta("twitter:image", ogImageUrl);
  }, [setlist, slots, eraName, creatorName, id]);

  useEffect(() => {
    if (!id || !user) return;
    supabase.from("setlist_upvotes").select("id").eq("setlist_id", id).eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setHasUpvoted(!!data));
  }, [id, user]);

  const handleUpvote = async () => {
    if (!user) { toast.error("Sign in to upvote"); navigate("/auth"); return; }
    if (!id || hasUpvoted || upvoting) return;
    setUpvoting(true);
    const { error } = await supabase.from("setlist_upvotes").insert({ setlist_id: id, user_id: user.id });
    if (error) {
      if (error.code === "23505") setHasUpvoted(true);
      else toast.error("Couldn't upvote — try again");
    } else {
      setHasUpvoted(true);
      setUpvoteCount((c) => c + 1);
      await supabase.rpc("increment_upvote_count", { _setlist_id: id });
    }
    setUpvoting(false);
  };

  const shareUrl = `${window.location.origin}/setlist/${id}`;
  const ogShareUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/og-image?id=${id}`;
  const shareTitle = `${setlist?.title || "Dream Setlist"} — Dead Set`;
  const shareDescription = setlist && slots.length > 0
    ? `Check out this${eraName ? ` ${eraName}` : ""} dream Dead show by ${creatorName}. ${slots.length} songs!`
    : undefined;

  const handlePlaySong = (slot: EnrichedSlot) => {
    if (!slot.version?.archive_org_url) return;
    playSingle({
      id: slot.id,
      song: { id: slot.song.id, title: slot.song.title },
      version: slot.version,
      setNumber: slot.set_number,
      position: slot.position,
      segueToNext: slot.segue_to_next || false,
    });
  };

  const handlePlayAll = async () => {
    const playable = slots.map((s) => ({
      id: s.id,
      song: { id: s.song.id, title: s.song.title },
      version: s.version,
      setNumber: s.set_number,
      position: s.position,
      segueToNext: s.segue_to_next || false,
    }));
    await globalPlaySetlist(playable, id);
  };

  const setGroups = [
    { label: "SET I", number: 1 },
    { label: "SET II", number: 2 },
    { label: "ENCORE", number: 3 },
  ];

  if (loading) {
    return (
      <div className="grain-overlay min-h-screen bg-background flex items-center justify-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4">
          <StealYourFace size={80} />
          <p className="font-body text-muted-foreground animate-pulse">Loading setlist…</p>
        </motion.div>
      </div>
    );
  }

  if (!setlist) {
    return (
      <div className="grain-overlay min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <StealYourFace size={60} />
        <p className="font-display text-xl text-muted-foreground">Setlist not found</p>
        <button onClick={() => navigate("/browse")} className="font-body text-sm text-primary underline underline-offset-2">
          Browse Setlists
        </button>
      </div>
    );
  }

  const createdDate = new Date(setlist.created_at).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="grain-overlay min-h-screen bg-background">
      {/* Minimal transparent top bar */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-background/60 backdrop-blur-sm">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground font-body text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePlayAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-body bg-card/80 border border-border text-foreground hover:border-primary/40 transition-colors"
          >
            <Play className="w-3 h-3 fill-current" /> Play All
          </button>
          <ShareDropdown url={shareUrl} ogUrl={ogShareUrl} title={shareTitle} description={shareDescription} />
        </div>
      </header>

      {/* J-Card Canvas */}
      <div className="max-w-[640px] mx-auto px-3 sm:px-6 pt-20 pb-16">
        <motion.article
          initial={{ opacity: 0, y: 40, rotate: -0.5 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="relative"
        >
          {/* === CASSETTE J-CARD === */}
          <div className="jcard-paper jcard-lines relative border-2 border-[hsl(28_20%_55%/0.5)] shadow-[4px_6px_20px_rgba(0,0,0,0.4)] hand-drawn-border overflow-hidden">
            {/* Red margin line */}
            <div className="jcard-margin relative">

              {/* ===== TOP FLAP — Band + Title ===== */}
              <div className="relative px-12 sm:px-14 pt-8 pb-6">
                {/* Hand-drawn SYF in corner */}
                <motion.div
                  className="absolute top-3 right-3 sm:top-4 sm:right-4 opacity-70"
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.3, duration: 0.5, ease: "easeOut" }}
                >
                  <StealYourFace size={50} />
                </motion.div>

                {/* "GRATEFUL DEAD" — hand-lettered style */}
                <motion.h2
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="font-display text-lg sm:text-xl tracking-[0.15em] uppercase"
                  style={{ color: "hsl(28 30% 25%)" }}
                >
                  Grateful Dead
                </motion.h2>

                {/* Setlist title — big, handwritten */}
                <motion.h1
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="font-hand text-2xl sm:text-3xl leading-tight mt-1"
                  style={{ color: "hsl(220 60% 30%)" }}
                >
                  {setlist.title}
                </motion.h1>

                {/* Meta line — mimics scribbled info */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.45 }}
                  className="font-hand text-sm mt-2"
                  style={{ color: "hsl(28 20% 40%)" }}
                >
                  curated by <span className="underline decoration-wavy decoration-1 underline-offset-2">{creatorName}</span>
                  {eraName && (
                    <>
                      {" · "}
                      <span
                        className="px-1.5 py-0.5 text-xs rounded-sm border font-marker"
                        style={{
                          borderColor: `hsl(${eraTheme.accent} / 0.5)`,
                          color: `hsl(${eraTheme.accent})`,
                          backgroundColor: `hsl(${eraTheme.accent} / 0.08)`,
                        }}
                      >
                        {eraName}
                      </span>
                    </>
                  )}
                </motion.p>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="font-hand text-xs mt-1"
                  style={{ color: "hsl(28 15% 50%)" }}
                >
                  {createdDate}
                </motion.p>
              </div>

              {/* ===== Divider — torn tape effect ===== */}
              <div className="mx-6 sm:mx-10 h-[2px] relative">
                <div
                  className="absolute inset-0"
                  style={{
                    background: `repeating-linear-gradient(90deg, hsl(${eraTheme.accent} / 0.4) 0px, hsl(${eraTheme.accent} / 0.4) 8px, transparent 8px, transparent 12px)`,
                  }}
                />
              </div>

              {/* ===== SETLIST BODY — handwritten song list ===== */}
              <div className="px-12 sm:px-14 py-5 space-y-6">
                {setGroups.map(({ label, number }) => {
                  const setSlots = slots.filter((s) => s.set_number === number);
                  if (setSlots.length === 0) return null;

                  return (
                    <motion.section
                      key={number}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 + number * 0.12 }}
                    >
                      {/* Set label — underlined, like a section header on a card */}
                      <h3
                        className="font-marker text-xs tracking-[0.25em] uppercase mb-2 pb-1 border-b inline-block"
                        style={{
                          color: `hsl(${eraTheme.accent})`,
                          borderColor: `hsl(${eraTheme.accent} / 0.3)`,
                        }}
                      >
                        {label}
                      </h3>

                      {/* Songs — each on its own "ruled line" */}
                      <div className="space-y-0">
                        {setSlots.map((slot, idx) => {
                          const hasAudio = !!slot.version?.archive_org_url;
                          const isHovered = hoveredSlot === slot.id;
                          const isNowPlaying = playingSlot?.id === slot.id;
                          const charSum = slot.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
                          const rotation = isNowPlaying ? 0 : ((charSum % 7) - 3) * 0.3;
                          const xShift = isNowPlaying ? 0 : ((charSum % 5) - 2) * 0.5;

                          return (
                            <React.Fragment key={slot.id}>
                            <motion.div
                              
                              className={`group flex items-center gap-2 py-[5px] transition-colors ${
                                isNowPlaying ? "now-playing-row" : ""
                              } ${
                                hasAudio ? "cursor-pointer hover:bg-[hsl(38_50%_80%/0.3)]" : ""
                              }`}
                              style={{ minHeight: "28px", transform: `rotate(${rotation}deg) translateX(${xShift}px)` }}
                              onClick={() => hasAudio && handlePlaySong(slot)}
                              onMouseEnter={() => setHoveredSlot(slot.id)}
                              onMouseLeave={() => setHoveredSlot(null)}
                              initial={{ opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: xShift }}
                              transition={{ delay: 0.55 + number * 0.08 + idx * 0.03 }}
                            >
                              {/* Track number or equalizer */}
                              <span className="w-4 text-right shrink-0">
                                {isNowPlaying ? (
                                  <span className="now-playing-bars" style={{ color: `hsl(${eraTheme.accent})` }}>
                                    <span /><span /><span />
                                  </span>
                                ) : hasAudio && isHovered ? (
                                  <Headphones className="w-3 h-3 inline" style={{ color: `hsl(${eraTheme.accent})` }} />
                                ) : (
                                  <span
                                    className="text-[11px] tabular-nums font-mono"
                                    style={{ color: "hsl(28 15% 50%)" }}
                                  >
                                    {idx + 1}.
                                  </span>
                                )}
                              </span>

                              {/* Song title — handwritten */}
                              <div className="flex items-baseline gap-1 flex-1 min-w-0">
                                <span
                                  className={`font-hand text-[15px] sm:text-base leading-snug transition-colors ${isNowPlaying ? "font-semibold" : ""}`}
                                  style={{ color: isNowPlaying ? `hsl(${eraTheme.accent})` : "hsl(220 50% 20%)" }}
                                >
                                  {slot.song.title}
                                </span>
                                {slot.segue_to_next && (
                                  <span
                                    className="text-sm font-bold shrink-0"
                                    style={{ color: `hsl(${eraTheme.accent})` }}
                                  >
                                    →
                                  </span>
                                )}
                              </div>

                              {/* Version info on hover (desktop only, not playing) */}
                              <AnimatePresence>
                                {isHovered && !isNowPlaying && slot.version && (
                                  <motion.span
                                    initial={{ opacity: 0, x: 5 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 5 }}
                                    className="text-[10px] font-hand whitespace-nowrap hidden sm:inline"
                                    style={{ color: "hsl(28 15% 50%)" }}
                                  >
                                    {slot.version.venue}, {slot.version.show_date}
                                  </motion.span>
                                )}
                              </AnimatePresence>
                            </motion.div>

                            {/* Now Playing info card — shows venue/year + Charlie's notes */}
                            <AnimatePresence>
                              {isNowPlaying && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.35, ease: "easeOut" }}
                                  className="overflow-hidden ml-6"
                                >
                                  <div
                                    className="py-2 px-3 mb-1 rounded-sm border border-dashed"
                                    style={{
                                      borderColor: `hsl(${eraTheme.accent} / 0.25)`,
                                      backgroundColor: `hsl(${eraTheme.accent} / 0.06)`,
                                    }}
                                  >
                                    {slot.version && (slot.version.show_date || slot.version.venue) && (
                                      <p
                                        className="font-mono text-[10px] tracking-wider mb-1"
                                        style={{ color: `hsl(${eraTheme.accent})` }}
                                      >
                                        🎧 {slot.version.show_date}{slot.version.venue ? ` · ${slot.version.venue}` : ""}
                                      </p>
                                    )}
                                    {slot.notes && (
                                      <p
                                        className="font-hand text-xs leading-relaxed italic"
                                        style={{ color: "hsl(28 20% 35%)" }}
                                      >
                                        "{slot.notes}"
                                      </p>
                                    )}
                                    {!slot.notes && !slot.version?.show_date && (
                                      <p
                                        className="font-hand text-xs italic"
                                        style={{ color: "hsl(28 15% 50%)" }}
                                      >
                                        Now playing…
                                      </p>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          );
                        })}
                      </div>
                    </motion.section>
                  );
                })}
              </div>

              {/* ===== DESCRIPTION / Liner Notes ===== */}
              {setlist.description && (
                <div className="mx-6 sm:mx-10 mb-4">
                  <div
                    className="px-6 py-4 border border-dashed rounded-sm"
                    style={{
                      borderColor: "hsl(28 20% 55% / 0.3)",
                      backgroundColor: "hsl(42 35% 85% / 0.5)",
                    }}
                  >
                    <p
                      className="font-hand text-sm leading-relaxed italic"
                      style={{ color: "hsl(28 20% 35%)" }}
                    >
                      {setlist.description}
                    </p>
                  </div>
                </div>
              )}

              {/* ===== BOTTOM FLAP ===== */}
              <div className="px-12 sm:px-14 pb-6 pt-2">
                {/* Dashed cut line */}
                <div
                  className="h-px mb-5"
                  style={{
                    backgroundImage: "repeating-linear-gradient(90deg, hsl(28 20% 55% / 0.3) 0px, hsl(28 20% 55% / 0.3) 4px, transparent 4px, transparent 8px)",
                  }}
                />

                <div className="flex flex-col items-center gap-4">
                  {/* Upvote button */}
                  <motion.button
                    onClick={handleUpvote}
                    disabled={hasUpvoted || upvoting}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-[10px] font-body text-sm transition-all ${
                      hasUpvoted
                        ? "text-[hsl(4_60%_45%)]"
                        : "text-[hsl(28_20%_35%)] hover:text-[hsl(4_60%_45%)]"
                    }`}
                    style={{
                      border: `1.5px solid ${hasUpvoted ? "hsl(4 60% 50% / 0.4)" : "hsl(28 20% 55% / 0.3)"}`,
                      backgroundColor: hasUpvoted ? "hsl(4 60% 50% / 0.08)" : "transparent",
                    }}
                    whileTap={!hasUpvoted ? { scale: 0.97 } : {}}
                  >
                    <Zap className={`w-4 h-4 ${hasUpvoted ? "fill-current" : ""}`} />
                    <span className="font-bold tabular-nums">{upvoteCount}</span>
                    <span className="text-xs opacity-60">{hasUpvoted ? "⚡ Upvoted" : "Upvote this tape"}</span>
                  </motion.button>

                  {/* Play count */}
                  {setlist.play_count > 0 && (
                    <p className="text-[10px] font-mono tracking-wider" style={{ color: "hsl(28 15% 50%)" }}>
                      ▶ {setlist.play_count} play{setlist.play_count !== 1 ? "s" : ""}
                    </p>
                  )}

                  {/* Footer branding */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-dashed" style={{ borderColor: "hsl(28 20% 55% / 0.2)" }}>
                    <DancingBear color="gold" />
                    <button
                      onClick={() => navigate("/")}
                      className="text-[10px] font-mono tracking-widest uppercase transition-colors hover:underline"
                      style={{ color: "hsl(28 15% 50%)" }}
                    >
                      Built with Dead Set
                    </button>
                    <DancingBear color="primary" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* === Cassette spine strip below the card === */}
          <div className="cassette-spine mx-4 sm:mx-8 h-8 flex items-center justify-center border-x border-b border-border/40 rounded-b-sm">
            <span className="font-marker text-[9px] tracking-[0.3em] uppercase text-muted-foreground/50">
              {setlist.title} · {eraName || "Dead Set"} · {slots.length} songs
            </span>
          </div>
        </motion.article>
      </div>
    </div>
  );
};

export default SetlistPoster;
