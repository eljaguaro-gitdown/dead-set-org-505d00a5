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
  const { playSingle, playSetlist: globalPlaySetlist } = useAudioPlayer();
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

      {/* Poster Canvas */}
      <div className="max-w-[680px] mx-auto px-4 sm:px-8 pt-20 pb-16">
        <motion.article
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="relative"
        >
          {/* ===== HEADER ZONE ===== */}
          <div className="relative text-center pt-8 sm:pt-12 pb-8">
            {/* Radial glow behind skull */}
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full pointer-events-none"
              style={{ background: `radial-gradient(circle, hsl(${eraTheme.glow}) 0%, transparent 70%)` }}
            />

            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.6, ease: "easeOut" }}
              className="relative z-10 flex justify-center mb-6"
            >
              <StealYourFace size={100} />
            </motion.div>

            {/* Band name */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="font-display text-xs sm:text-sm tracking-[0.35em] text-muted-foreground uppercase relative z-10"
            >
              GRATEFUL DEAD
            </motion.p>

            {/* Setlist title */}
            <motion.h1
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="font-marker text-2xl sm:text-4xl text-foreground leading-tight mt-4 relative z-10 px-4"
            >
              {setlist.title}
            </motion.h1>

            {/* Era badge & meta */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55 }}
              className="flex items-center justify-center gap-3 mt-4 relative z-10"
            >
              {eraName && (
                <EraTooltip eraName={eraName}>
                  <span
                    className="px-3 py-1 text-[10px] font-body tracking-widest uppercase rounded-full border cursor-help"
                    style={{
                      borderColor: `hsl(${eraTheme.accent} / 0.4)`,
                      color: `hsl(${eraTheme.accent})`,
                    }}
                  >
                    {eraName}
                  </span>
                </EraTooltip>
              )}
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.65 }}
              className="font-body text-xs text-muted-foreground/60 mt-3 tracking-wider relative z-10"
              style={{ fontFamily: "monospace" }}
            >
              curated by {creatorName} · {createdDate}
            </motion.p>
          </div>

          {/* ===== DECORATIVE RULE ===== */}
          <div className="flex items-center gap-4 px-4 my-2">
            <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, transparent, hsl(${eraTheme.accent} / 0.3), transparent)` }} />
            <span className="text-xs" style={{ color: `hsl(${eraTheme.accent} / 0.5)` }}>✦ ✦ ✦</span>
            <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, transparent, hsl(${eraTheme.accent} / 0.3), transparent)` }} />
          </div>

          {/* ===== SETLIST BODY ===== */}
          <div className="px-2 sm:px-4 py-6 space-y-8">
            {setGroups.map(({ label, number }) => {
              const setSlots = slots.filter((s) => s.set_number === number);
              if (setSlots.length === 0) return null;

              return (
                <motion.section
                  key={number}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + number * 0.15 }}
                >
                  {/* Set label */}
                  <div className="flex items-center gap-3 mb-4 px-2">
                    <div className="h-px flex-1" style={{ background: `hsl(${eraTheme.accent} / 0.2)` }} />
                    <h2
                      className="text-[11px] font-body tracking-[0.3em] uppercase"
                      style={{ color: `hsl(${eraTheme.accent} / 0.7)` }}
                    >
                      {label}
                    </h2>
                    <div className="h-px flex-1" style={{ background: `hsl(${eraTheme.accent} / 0.2)` }} />
                  </div>

                  {/* Songs */}
                  <div className="space-y-0">
                    {setSlots.map((slot, idx) => {
                      const hasAudio = !!slot.version?.archive_org_url;
                      const isHovered = hoveredSlot === slot.id;

                      return (
                        <motion.div
                          key={slot.id}
                          className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-default ${
                            hasAudio ? "cursor-pointer hover:bg-card/60" : ""
                          }`}
                          onClick={() => hasAudio && handlePlaySong(slot)}
                          onMouseEnter={() => setHoveredSlot(slot.id)}
                          onMouseLeave={() => setHoveredSlot(null)}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.6 + number * 0.1 + idx * 0.04 }}
                        >
                          {/* Track number or play icon */}
                          <span className="w-5 text-right shrink-0">
                            {hasAudio && isHovered ? (
                              <Headphones className="w-3.5 h-3.5 inline" style={{ color: `hsl(${eraTheme.accent})` }} />
                            ) : (
                              <span className="text-[11px] text-muted-foreground/40 tabular-nums font-body">
                                {idx + 1}
                              </span>
                            )}
                          </span>

                          {/* Song title + segue */}
                          <div className="flex items-baseline gap-1.5 flex-1 min-w-0">
                            <span className="font-body text-[15px] sm:text-base text-foreground leading-snug">
                              {slot.song.title}
                            </span>
                            {slot.segue_to_next && (
                              <motion.span
                                className="text-sm font-bold shrink-0"
                                style={{ color: `hsl(${eraTheme.accent})` }}
                                whileHover={{ x: 3 }}
                                transition={{ type: "spring", stiffness: 300 }}
                              >
                                →
                              </motion.span>
                            )}
                          </div>

                          {/* Version info on hover */}
                          <AnimatePresence>
                            {isHovered && slot.version && (
                              <motion.span
                                initial={{ opacity: 0, x: 5 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 5 }}
                                className="text-[10px] text-muted-foreground/50 font-body whitespace-nowrap hidden sm:inline"
                              >
                                {slot.version.venue}, {slot.version.show_date}
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.section>
              );
            })}
          </div>

          {/* ===== FOOTER ZONE ===== */}
          <div className="flex items-center gap-4 px-4 mt-2 mb-6">
            <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, transparent, hsl(${eraTheme.accent} / 0.3), transparent)` }} />
            <span className="text-xs" style={{ color: `hsl(${eraTheme.accent} / 0.5)` }}>✦</span>
            <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, transparent, hsl(${eraTheme.accent} / 0.3), transparent)` }} />
          </div>

          <div className="flex flex-col items-center gap-5 pb-8">
            {/* Upvote button */}
            <motion.button
              onClick={handleUpvote}
              disabled={hasUpvoted || upvoting}
              className={`flex items-center gap-2 px-6 py-3 rounded-full font-body text-sm transition-all ${
                hasUpvoted
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "bg-card border border-border hover:border-primary/50 text-foreground hover:text-primary"
              }`}
              whileTap={!hasUpvoted ? { scale: 0.95 } : {}}
            >
              <Zap className={`w-4 h-4 ${hasUpvoted ? "fill-primary text-primary" : ""}`} />
              <span className="tabular-nums font-bold">{upvoteCount}</span>
              <span className="text-muted-foreground text-xs">{hasUpvoted ? "Upvoted" : "Upvote"}</span>
            </motion.button>

            {/* Play count */}
            {setlist.play_count > 0 && (
              <p className="text-[10px] text-muted-foreground/40 font-body tracking-wider">
                ▶ {setlist.play_count} play{setlist.play_count !== 1 ? "s" : ""}
              </p>
            )}

            {/* Built with Dead Set */}
            <div className="flex items-center gap-2 mt-4">
              <DancingBear color="gold" />
              <button
                onClick={() => navigate("/")}
                className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground font-body tracking-widest uppercase transition-colors"
              >
                Built with Dead Set
              </button>
              <DancingBear color="primary" />
            </div>
          </div>
        </motion.article>
      </div>
    </div>
  );
};

export default SetlistPoster;
