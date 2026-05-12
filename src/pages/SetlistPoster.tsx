import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Share2, Zap, Play, Heart, RefreshCw, Loader2 } from "lucide-react";
import SetlistComments from "@/components/SetlistComments";
import { useFavorites } from "@/hooks/useFavorites";
import EraTooltip from "@/components/EraTooltip";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import StealYourFace from "@/components/StealYourFace";
import DancingBear from "@/components/DancingBear";
import ShareDropdown from "@/components/ShareDropdown";
import ShareFlow from "@/components/ShareFlow";
import ShowPlate from "@/components/ShowPlate";
import { toast } from "sonner";
import { findArchiveRecordings, matchScore, type ArchiveResult } from "@/lib/archiveOrg";
import { useFavoriteSongs } from "@/hooks/useFavoriteSongs";
import type { Database } from "@/integrations/supabase/types";

type Setlist = Omit<Database["public"]["Tables"]["setlists"]["Row"], "share_token">;
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
  const location = useLocation();
  const { user } = useAuth();
  const { playSingle, playSetlist: globalPlaySetlist, playingSlot } = useAudioPlayer();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { isFavoriteVersion, toggleFavoriteSong } = useFavoriteSongs();
  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [slots, setSlots] = useState<EnrichedSlot[]>([]);
  const [creatorName, setCreatorName] = useState("Unknown Head");
  const [eraName, setEraName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasUpvoted, setHasUpvoted] = useState(false);
  const [upvoteCount, setUpvoteCount] = useState(0);
  const [upvoting, setUpvoting] = useState(false);
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);
  const [shareFlowOpen, setShareFlowOpen] = useState(false);
  const [resolvedArchives, setResolvedArchives] = useState<Record<string, ArchiveResult | null>>({});
  const [rebuilding, setRebuilding] = useState(false);

  const eraTheme = useMemo(() => getEraTheme(eraName), [eraName]);

  const isOwner = !!user && !!setlist && setlist.creator_id === user.id;

  // Derive the source show date from slot notes ("From YYYY-MM-DD · Venue").
  // If most slots came from the same archive.org show, surface a one-click rebuild.
  const sourceShow = useMemo(() => {
    const counts = new Map<string, { count: number; venue: string | null }>();
    for (const s of slots) {
      const m = s.notes?.match(/^From\s+(\d{4}-\d{2}-\d{2})(?:\s*·\s*(.+))?/);
      if (!m) continue;
      const key = m[1];
      const prev = counts.get(key);
      counts.set(key, { count: (prev?.count || 0) + 1, venue: prev?.venue ?? (m[2]?.trim() || null) });
    }
    let best: { date: string; count: number; venue: string | null } | null = null;
    for (const [date, v] of counts) {
      if (!best || v.count > best.count) best = { date, count: v.count, venue: v.venue };
    }
    // Require at least 3 slots to share a source date — avoids false positives from
    // a stray manually-added archive note on an otherwise hand-built setlist.
    if (!best || best.count < 3) return null;
    return best;
  }, [slots]);

  const handleRebuildFromShow = useCallback(async () => {
    if (!sourceShow || !id || !user) return;
    const niceDate = new Date(sourceShow.date + "T12:00:00").toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });
    const ok = window.confirm(
      `Rebuild this setlist exactly as the Grateful Dead played it on ${niceDate}${sourceShow.venue ? ` at ${sourceShow.venue}` : ""}?\n\nThis will overwrite the current songs.`
    );
    if (!ok) return;

    setRebuilding(true);
    try {
      const { data: show, error: fnErr } = await supabase.functions.invoke("fetch-show-setlist", {
        body: { date: sourceShow.date },
      });
      if (fnErr || !show || show.error) {
        toast.error(show?.error || fnErr?.message || "Couldn't load that show from archive.org");
        return;
      }

      const trackSongIds = Array.from(
        new Set(
          ((show.tracks || []) as Array<{ songId?: string | null }>)
            .map((track) => track.songId)
            .filter((songId): songId is string => !!songId),
        ),
      );
      const { data: songs, error: sErr } = await supabase.from("songs").select("*");
      if (sErr || !songs) { toast.error("Couldn't load song catalog"); return; }
      const missingSongIds = trackSongIds.filter((songId) => !songs.some((song) => song.id === songId));
      const { data: resolvedInsertedSongs, error: insertedErr } = missingSongIds.length
        ? await supabase.from("songs").select("*").in("id", missingSongIds)
        : { data: [], error: null };
      if (insertedErr) { toast.error("Couldn't refresh the song catalog"); return; }
      const songCatalog = [...songs, ...(resolvedInsertedSongs || [])];
      const songsById = new Map(songCatalog.map((s) => [s.id, s]));

      const positions = new Map<number, number>();
      const rows: Database["public"]["Tables"]["setlist_slots"]["Insert"][] = [];
      let unmatched = 0;
      for (const t of show.tracks as Array<{ rawTitle: string; setNumber: number; segueToNext: boolean; songId?: string | null; sourceDate?: string; sourceVenue?: string | null }>) {
        let chosen: Song | null = (t.songId && songsById.get(t.songId)) || null;
        if (!chosen) {
          let best: { song: Song; score: number } | null = null;
          for (const song of songCatalog) {
            const score = matchScore(t.rawTitle, song.title);
            if (score >= 60 && (!best || score > best.score)) best = { song, score };
          }
          chosen = best?.song ?? null;
        }
        if (!chosen) { unmatched++; continue; }
        const pos = positions.get(t.setNumber) || 0;
        positions.set(t.setNumber, pos + 1);
        rows.push({
          id: crypto.randomUUID(),
          setlist_id: id,
          set_number: t.setNumber,
          position: pos,
          song_id: chosen.id,
          notable_version_id: null,
          added_by_user_id: user.id,
          notes: t.sourceDate
            ? `${JSON.stringify({
                __archive: true,
                show_date: t.sourceDate,
                venue: t.sourceVenue || null,
                archive_org_url: show.archiveUrl,
                rating: null,
              })}\nFrom ${t.sourceDate}${t.sourceVenue ? ` · ${t.sourceVenue}` : ""}`
            : "",
          segue_to_next: t.segueToNext,
        });
      }

      if (rows.length === 0) {
        toast.error("Found the show, but no songs matched our catalog");
        return;
      }

      const { error: delErr } = await supabase.from("setlist_slots").delete().eq("setlist_id", id);
      if (delErr) { toast.error("Couldn't clear the existing setlist"); return; }

      const { error: insErr } = await supabase.from("setlist_slots").insert(rows);
      if (insErr) { toast.error("Couldn't write the rebuilt show"); return; }

      toast.success(`Rebuilt from ${niceDate}`, {
        description: unmatched > 0
          ? `${unmatched} track${unmatched === 1 ? "" : "s"} skipped (jams, tunings, or songs not in our catalog).`
          : "Set order and segues match the show exactly.",
      });

      // Reload to re-fetch enriched slots cleanly.
      window.location.reload();
    } catch (e) {
      console.error("Rebuild from show failed:", e);
      toast.error("Couldn't rebuild — try again");
    } finally {
      setRebuilding(false);
    }
  }, [sourceShow, id, user]);

  useEffect(() => {
    if (!id) return;
    const fetchSetlist = async () => {
      setLoading(true);

      const { data: setlistData } = await supabase
        .from("setlists")
        .select("id, title, creator_id, description, era_id, is_public, is_collaborative, play_count, upvote_count, created_at, updated_at")
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

            let version = versionRes.data;
            let notes = slot.notes || "";

            // Reconstruct synthetic archive version from stored metadata in notes
            if (!version && notes.startsWith("{\"__archive\":true")) {
              try {
                const nlIndex = notes.indexOf("\n");
                const metaStr = nlIndex > -1 ? notes.substring(0, nlIndex) : notes;
                const meta = JSON.parse(metaStr);
                if (meta.__archive) {
                  version = {
                    id: `archive-reconstructed-${slot.id}`,
                    song_id: slot.song_id,
                    show_date: meta.show_date || "",
                    archive_org_url: meta.archive_org_url || null,
                    venue: meta.venue || null,
                    city: null,
                    era_id: null,
                    rating: meta.rating || null,
                    description: null,
                  };
                  notes = nlIndex > -1 ? notes.substring(nlIndex + 1) : "";
                }
              } catch { /* not valid JSON */ }
            }

            return { ...slot, notes, song: songRes.data!, version } as EnrichedSlot;
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
    const ogTitle = `${setlist.title} — Dead-Set.Org`;
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

  useEffect(() => {
    let cancelled = false;

    const resolveArchives = async () => {
      const unresolvedSongs = Array.from(
        new Set(
          slots
            .filter((slot) => !slot.version?.archive_org_url)
            .map((slot) => slot.song.title)
        )
      );

      if (unresolvedSongs.length === 0) return;

      const results = await findArchiveRecordings(unresolvedSongs);
      if (cancelled) return;

      const nextResolved: Record<string, ArchiveResult | null> = {};
      unresolvedSongs.forEach((title) => {
        nextResolved[title] = results.get(title) ?? null;
      });

      setResolvedArchives((prev) => ({ ...prev, ...nextResolved }));
    };

    resolveArchives();

    return () => {
      cancelled = true;
    };
  }, [slots]);

  // PostHog tracking — fire once per setlist load.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ph = (typeof window !== "undefined" ? (window as any).posthog : null);
  const trackedLoadRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (!setlist || !id) return;
    if (trackedLoadRef.current === id) return;
    trackedLoadRef.current = id;
    ph?.capture?.("setlist_viewer_loaded", {
      auth_state: user ? "authenticated" : "anonymous",
      setlist_id: id,
      referrer: typeof document !== "undefined" ? document.referrer || null : null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setlist, id, user]);

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
  const shareTitle = `${setlist?.title || "Dream Setlist"} — Dead-Set.Org`;
  const shareDescription = setlist && slots.length > 0
    ? `Check out this${eraName ? ` ${eraName}` : ""} dream Dead show by ${creatorName}. ${slots.length} songs!`
    : undefined;

  const buildPlayableSlot = useCallback((slot: EnrichedSlot) => {
    const resolvedArchive = resolvedArchives[slot.song.title] ?? null;
    const resolvedVersion = slot.version || (resolvedArchive ? {
      id: "",
      song_id: slot.song.id,
      show_date: resolvedArchive.date || "",
      archive_org_url: resolvedArchive.url,
      venue: resolvedArchive.venue,
      city: null,
      era_id: null,
      rating: null,
      description: null,
    } : null);

    return {
      id: slot.id,
      song: { id: slot.song.id, title: slot.song.title },
      version: resolvedVersion,
      setNumber: slot.set_number,
      position: slot.position,
      segueToNext: slot.segue_to_next || false,
      directTrackUrl: resolvedArchive?.directTrackUrl || null,
    };
  }, [resolvedArchives]);

  const handlePlaySong = (slot: EnrichedSlot) => {
    // Pass surrounding setlist as context so the player auto-advances to the
    // next song when this one ends — no need to press "Play All" first.
    const allPlayable = slots.map(buildPlayableSlot);
    playSingle(buildPlayableSlot(slot), { slots: allPlayable, setlistId: id ?? null });
  };

  const handlePlayAll = async () => {
    const playable = slots.map(buildPlayableSlot);
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
      <div className="grain-overlay min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
        <StealYourFace size={60} />
        <p className="font-display text-2xl text-foreground">Charlie can't find that tape.</p>
        <p className="font-body text-sm text-muted-foreground max-w-sm">
          The link may be broken, or the setlist was taken down. Build your own — every night gets a fresh chance.
        </p>
        <button
          onClick={() => navigate("/builder")}
          className="mt-2 inline-flex items-center gap-2 px-5 h-11 rounded-[10px] font-display"
          style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
        >
          Open the Builder ↗
        </button>
      </div>
    );
  }

  // Private setlist guard — only the owner (or collaborator, who hits a different code path) can view.
  if (setlist.is_public === false && !isOwner) {
    return (
      <div className="grain-overlay min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6 text-center">
        <StealYourFace size={60} />
        <p className="font-display text-2xl text-foreground">This tape is private.</p>
        <p className="font-body text-sm text-muted-foreground max-w-sm">
          The taper kept this one for themselves. Build your own setlist — Cosmic Charlie's got plenty more reels in the vault.
        </p>
        <button
          onClick={() => navigate("/builder")}
          className="mt-2 inline-flex items-center gap-2 px-5 h-11 rounded-[10px] font-display"
          style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
        >
          Open the Builder ↗
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
        <button
          onClick={() => {
            // If user landed here cold (shared link, new tab), location.key is "default".
            // Otherwise they have real in-app history we can pop.
            if (location.key && location.key !== "default") {
              navigate(-1);
            } else {
              navigate("/");
            }
          }}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground font-body text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> {location.key && location.key !== "default" ? "Back" : "Home"}
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePlayAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-body bg-card/80 border border-border text-foreground hover:border-primary/40 transition-colors"
          >
            <Play className="w-3 h-3 fill-current" /> Play All
          </button>
          {isOwner && sourceShow && (
            <button
              onClick={handleRebuildFromShow}
              disabled={rebuilding}
              title={`Overwrite with the exact ${sourceShow.date}${sourceShow.venue ? ` · ${sourceShow.venue}` : ""} setlist from archive.org`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-body bg-card/80 border border-border text-foreground hover:border-primary/40 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {rebuilding
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <RefreshCw className="w-3 h-3" />}
              <span className="hidden sm:inline">{rebuilding ? "Rebuilding…" : `Rebuild from ${sourceShow.date}`}</span>
              <span className="sm:hidden">{rebuilding ? "…" : "Rebuild"}</span>
            </button>
          )}
          <ShareDropdown url={shareUrl} ogUrl={ogShareUrl} title={shareTitle} description={shareDescription} />
        </div>
      </header>

      {/* === Public viewer hero — primary CTAs above the poster === */}
      {(() => {
        // Pick the best Internet Archive show URL we can find: prefer source-show, then any slot version, then resolved.
        const archiveShowUrl =
          (slots.find((s) => s.version?.archive_org_url)?.version?.archive_org_url) ||
          (Object.values(resolvedArchives).find((r) => r?.url)?.url) ||
          null;
        const aboutBlurb =
          (setlist.description && setlist.description.trim().length > 0)
            ? setlist.description
            : "One night, one tape, one set of choices that won't happen the same way twice.";
        const venueLine = sourceShow?.venue || null;
        const dateLine = sourceShow?.date
          ? new Date(sourceShow.date + "T12:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
          : null;

        const fireCta = (event: string, props?: Record<string, unknown>) => ph?.capture?.(event, props);

        const handleBuilderCta = () => {
          fireCta("setlist_viewer_cta_builder_clicked", { setlist_id: id, auth_state: user ? "authenticated" : "anonymous" });
          navigate(user ? "/builder" : "/hello");
        };
        const handleArchiveCta = () => {
          if (!archiveShowUrl) return;
          fireCta("setlist_viewer_cta_archive_clicked", { setlist_id: id, url: archiveShowUrl });
          window.open(archiveShowUrl, "_blank", "noopener,noreferrer");
        };
        const handleSaveCta = async () => {
          if (!user) { toast.error("Sign in to save this tape"); navigate("/auth"); return; }
          fireCta("setlist_viewer_save_clicked", { setlist_id: id });
          if (id) await toggleFavorite(id);
        };
        const handleRecreateCta = async () => {
          if (!user || !id) { navigate("/auth"); return; }
          fireCta("setlist_viewer_cta_builder_clicked", { setlist_id: id, action: "recreate", auth_state: "authenticated" });
          try {
            const { data: newSetlist, error: insErr } = await supabase
              .from("setlists")
              .insert({
                creator_id: user.id,
                title: `${setlist.title} (recreated)`,
                era_id: setlist.era_id,
                is_public: true,
              })
              .select("id")
              .single();
            if (insErr || !newSetlist) throw insErr || new Error("no setlist");
            if (slots.length > 0) {
              const { error: slotErr } = await supabase.from("setlist_slots").insert(
                slots.map((s) => ({
                  setlist_id: newSetlist.id,
                  song_id: s.song_id,
                  notable_version_id: s.notable_version_id,
                  set_number: s.set_number,
                  position: s.position,
                  segue_to_next: s.segue_to_next,
                  notes: s.notes || "",
                  added_by_user_id: user.id,
                }))
              );
              if (slotErr) throw slotErr;
            }
            toast.success("Pulled into your Builder");
            navigate(`/builder/${newSetlist.id}`);
          } catch (e) {
            console.error("Recreate failed:", e);
            toast.error("Couldn't recreate this tape — try again");
          }
        };
        const handleShareInit = (channel: string) => {
          fireCta("setlist_viewer_share_initiated", { channel, setlist_id: id });
        };

        return (
          <section className="max-w-[640px] mx-auto px-4 sm:px-6 pt-20 pb-2">
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[#0F0E0C] p-5 sm:p-7 shadow-[0_10px_40px_rgba(0,0,0,0.3)]">
              {/* Metadata strip */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-3">
                {dateLine && (
                  <span className="font-mono text-sm tracking-wide text-foreground">{dateLine}</span>
                )}
                {venueLine && (
                  <span className="font-body text-sm text-muted-foreground">· {venueLine}</span>
                )}
                {eraName && (
                  <span
                    className="px-2 py-0.5 rounded-[6px] border font-marker text-[11px] tracking-[0.15em] uppercase"
                    style={{
                      borderColor: `hsl(${eraTheme.accent} / 0.5)`,
                      color: `hsl(${eraTheme.accent})`,
                      backgroundColor: `hsl(${eraTheme.accent} / 0.08)`,
                    }}
                  >
                    {eraName}
                  </span>
                )}
              </div>

              {/* About this show */}
              <div className="mb-5">
                <p className="font-marker text-[11px] tracking-[0.2em] uppercase text-muted-foreground/70 mb-1.5">
                  About this show
                </p>
                <p className="font-body text-base sm:text-lg leading-relaxed text-foreground/90">
                  {aboutBlurb}
                </p>
                <p className="font-body text-xs text-muted-foreground mt-2">
                  Cosmic Charlie's pick, curated by{" "}
                  <Link to={`/user/${setlist.creator_id}`} className="text-primary hover:underline">{creatorName}</Link>.
                </p>
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-2.5">
                {!user ? (
                  <button
                    onClick={handleBuilderCta}
                    className="flex-1 h-12 rounded-[10px] font-display text-base inline-flex items-center justify-center gap-2 transition-transform hover:scale-[1.01]"
                    style={{ background: "#c9a84c", color: "#15130F" }}
                  >
                    Build Your Own Setlist
                    <span aria-hidden>↗</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleSaveCta}
                      className="flex-1 h-12 rounded-[10px] font-display text-base inline-flex items-center justify-center gap-2 transition-transform hover:scale-[1.01]"
                      style={{ background: "#c9a84c", color: "#15130F" }}
                    >
                      <Heart className={`w-5 h-5 ${isFavorite(id || "") ? "fill-current" : ""}`} />
                      {isFavorite(id || "") ? "Saved to My Setlists" : "Add to My Setlists"}
                    </button>
                    <button
                      onClick={handleRecreateCta}
                      className="flex-1 h-12 rounded-[10px] font-display text-base inline-flex items-center justify-center gap-2 border border-[#c9a84c]/60 text-[#c9a84c] hover:bg-[#c9a84c]/10 transition-colors"
                    >
                      <RefreshCw className="w-5 h-5" />
                      Recreate This Show
                    </button>
                  </>
                )}
                <button
                  onClick={handleArchiveCta}
                  disabled={!archiveShowUrl}
                  title={archiveShowUrl ? "Open this show on archive.org" : "No archive.org show link available"}
                  className="sm:flex-none h-12 px-5 rounded-[10px] font-body text-sm inline-flex items-center justify-center gap-2 border border-border text-foreground hover:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Listen on Internet Archive
                  <span aria-hidden>↗</span>
                </button>
              </div>

              {/* Share row */}
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/60">
                <span className="font-body text-xs text-muted-foreground mr-1">Share:</span>
                <button
                  onClick={async () => {
                    handleShareInit("copy_link");
                    try {
                      await navigator.clipboard.writeText(shareUrl);
                      toast.success("Link copied — paste it anywhere");
                    } catch { toast.error("Couldn't copy — try again"); }
                  }}
                  className="px-3 h-9 rounded-[10px] border border-border text-foreground/90 hover:border-primary/50 font-body text-xs transition-colors"
                >
                  Copy link
                </button>
                <button
                  onClick={() => {
                    handleShareInit("twitter");
                    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareTitle)}&url=${encodeURIComponent(shareUrl)}`;
                    window.open(url, "_blank", "noopener,noreferrer");
                  }}
                  className="px-3 h-9 rounded-[10px] border border-border text-foreground/90 hover:border-primary/50 font-body text-xs transition-colors"
                >
                  Open in X
                </button>
                <button
                  onClick={() => {
                    handleShareInit("email");
                    const body = `${shareDescription || "A dream Dead show on Dead-Set.Org"}\n\n${shareUrl}`;
                    window.location.href = `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(body)}`;
                  }}
                  className="px-3 h-9 rounded-[10px] border border-border text-foreground/90 hover:border-primary/50 font-body text-xs transition-colors"
                >
                  Email
                </button>
                <div className="ml-auto">
                  <ShareDropdown url={shareUrl} ogUrl={ogShareUrl} title={shareTitle} description={shareDescription} />
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      {/* J-Card Canvas */}
      <div className="max-w-[640px] mx-auto px-3 sm:px-6 pt-6 pb-16">
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
                  curated by <Link to={`/user/${setlist.creator_id}`} className="underline decoration-wavy decoration-1 underline-offset-2 hover:opacity-70 transition-opacity">{creatorName}</Link>
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
                          const isHovered = hoveredSlot === slot.id;
                          const isNowPlaying = playingSlot?.id === slot.id;
                          const charSum = slot.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
                          const rotation = isNowPlaying ? 0 : ((charSum % 7) - 3) * 0.3;
                          const xShift = isNowPlaying ? 0 : ((charSum % 5) - 2) * 0.5;
                          const favoritePayload = slot.version?.id?.startsWith("archive-")
                            ? {
                                songId: slot.song.id,
                                versionShowDate: slot.version.show_date,
                                versionVenue: slot.version.venue,
                                versionArchiveOrgUrl: slot.version.archive_org_url,
                                versionRating: slot.version.rating,
                              }
                            : slot.version
                              ? { songId: slot.song.id, notableVersionId: slot.version.id }
                              : { songId: slot.song.id };
                          const isSongFavorited = isFavoriteVersion(favoritePayload);

                          return (
                            <React.Fragment key={slot.id}>
                            <motion.div
                              
                              className={`group flex items-center gap-2 py-[5px] transition-colors cursor-pointer hover:bg-[hsl(38_50%_80%/0.3)] ${
                                isNowPlaying ? "now-playing-row" : ""
                              }`}
                              style={{ minHeight: "28px", transform: `rotate(${rotation}deg) translateX(${xShift}px)` }}
                              onClick={() => handlePlaySong(slot)}
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
                                ) : isHovered ? (
                                  <Play className="w-3 h-3 inline fill-current" style={{ color: `hsl(${eraTheme.accent})` }} />
                                ) : (
                                  <span
                                    className="text-base tabular-nums font-mono"
                                    style={{ color: "hsl(28 15% 40%)" }}
                                  >
                                    {idx + 1}.
                                  </span>
                                )}
                              </span>

                              {/* Song title — handwritten */}
                              <div className="flex flex-col flex-1 min-w-0">
                                <div className="flex items-baseline gap-1 min-w-0">
                                  <span
                                    className={`font-hand text-xl sm:text-2xl leading-relaxed transition-colors ${isNowPlaying ? "font-semibold" : ""}`}
                                    style={{ color: isNowPlaying ? `hsl(${eraTheme.accent})` : "hsl(220 40% 12%)" }}
                                  >
                                    {slot.song.title}
                                  </span>
                                  {slot.segue_to_next && (
                                    <span
                                      className="text-xl font-bold shrink-0"
                                      style={{ color: `hsl(${eraTheme.accent})` }}
                                    >
                                      →
                                    </span>
                                  )}
                                </div>
                                {(() => {
                                  const sourceFromNotes = slot.notes?.startsWith("From ")
                                    ? slot.notes.replace(/^From\s+/, "")
                                    : null;
                                  const versionLine = slot.version?.show_date || slot.version?.venue
                                    ? [slot.version?.show_date, slot.version?.venue].filter(Boolean).join(" · ")
                                    : null;
                                  const line = versionLine || sourceFromNotes;
                                  if (!line) return null;
                                  return (
                                    <span
                                      className="font-hand text-xs sm:text-sm leading-tight mt-0.5"
                                      style={{ color: "hsl(28 25% 38%)" }}
                                    >
                                      {line}
                                    </span>
                                  );
                                })()}
                              </div>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const result = await toggleFavoriteSong(favoritePayload);
                                  if (result.requiresAuth) {
                                    toast.error("Sign in to save favorite songs");
                                    return;
                                  }
                                  if (!result.ok) {
                                    toast.error("Could not update favorite songs");
                                    return;
                                  }
                                  toast.success(
                                    result.favorited
                                      ? `${slot.song.title} added to favorite songs`
                                      : `${slot.song.title} removed from favorite songs`
                                  );
                                }}
                                className="shrink-0 p-1 rounded-sm hover:bg-[hsl(38_50%_80%/0.35)] transition-colors"
                                title={isSongFavorited ? "Remove from favorite songs" : "Add to favorite songs"}
                              >
                                <Heart className={`w-3.5 h-3.5 ${isSongFavorited ? "fill-current" : ""}`} style={{ color: isSongFavorited ? `hsl(${eraTheme.accent})` : "hsl(28 15% 45%)" }} />
                              </button>

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
                                    {/* Show date/venue from slot version OR from the resolved playingSlot version */}
                                    {(() => {
                                      const showDate = slot.version?.show_date || playingSlot?.version?.show_date;
                                      const venue = slot.version?.venue || playingSlot?.version?.venue;
                                      if (showDate || venue) {
                                        return (
                                          <p
                                            className="font-mono text-xs tracking-wider mb-1"
                                            style={{ color: "hsl(28 30% 25%)" }}
                                          >
                                            🎧 {showDate}{venue ? ` · ${venue}` : ""}
                                          </p>
                                        );
                                      }
                                      return null;
                                    })()}
                                    {slot.notes && (
                                      <p
                                        className="font-hand text-base sm:text-lg leading-relaxed italic"
                                        style={{ color: "hsl(28 20% 35%)" }}
                                      >
                                        "{slot.notes}"
                                      </p>
                                    )}
                                    {!slot.notes && !(slot.version?.show_date || playingSlot?.version?.show_date) && (
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
                            </React.Fragment>
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
                      className="font-hand text-lg sm:text-xl leading-relaxed italic"
                      style={{ color: "hsl(28 15% 18%)" }}
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
                  {/* Action buttons — larger for mobile */}
                  <div className="flex items-center gap-4">
                    {/* Upvote button — prominent */}
                    <motion.button
                      onClick={handleUpvote}
                      disabled={hasUpvoted || upvoting}
                      className={`flex items-center gap-2.5 px-6 py-3 rounded-xl font-body text-base transition-all ${
                        hasUpvoted
                          ? "text-[hsl(4_60%_45%)]"
                          : "text-[hsl(28_20%_35%)] hover:text-[hsl(4_60%_45%)]"
                      }`}
                      style={{
                        border: `2px solid ${hasUpvoted ? "hsl(4 60% 50% / 0.4)" : "hsl(28 20% 55% / 0.3)"}`,
                        backgroundColor: hasUpvoted ? "hsl(4 60% 50% / 0.08)" : "transparent",
                      }}
                      whileTap={!hasUpvoted ? { scale: 0.95 } : {}}
                    >
                      <Zap className={`w-5 h-5 ${hasUpvoted ? "fill-current" : ""}`} />
                      <span className="font-bold tabular-nums text-lg">{upvoteCount}</span>
                      <span className="text-sm opacity-70">{hasUpvoted ? "⚡ Upvoted" : "Upvote"}</span>
                    </motion.button>

                    {/* Favorite button — prominent */}
                    <motion.button
                      onClick={() => {
                        if (!user) { toast.error("Sign in to save favorites"); navigate("/auth"); return; }
                        if (id) toggleFavorite(id);
                      }}
                      className={`flex items-center gap-2 px-5 py-3 rounded-xl font-body text-base transition-all ${
                        isFavorite(id || "")
                          ? "text-[hsl(340_70%_45%)]"
                          : "text-[hsl(28_20%_35%)] hover:text-[hsl(340_70%_45%)]"
                      }`}
                      style={{
                        border: `2px solid ${isFavorite(id || "") ? "hsl(340 70% 50% / 0.4)" : "hsl(28 20% 55% / 0.3)"}`,
                        backgroundColor: isFavorite(id || "") ? "hsl(340 70% 50% / 0.08)" : "transparent",
                      }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Heart className={`w-5 h-5 ${isFavorite(id || "") ? "fill-current" : ""}`} />
                      <span className="text-sm opacity-70">{isFavorite(id || "") ? "Saved" : "Save"}</span>
                    </motion.button>
                  </div>

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
                      Built with Dead-Set.Org
                    </button>
                    <DancingBear color="primary" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* === Community Comments === */}
          <SetlistComments
            setlistId={id || ""}
            isPublic={!!setlist?.is_public}
          />

          {/* === Show Plate === */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="mt-8 p-6 bg-[#0F0E0C] rounded-xl"
          >
            <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground/40 text-center mb-4">
              your show plate
            </p>
            <ShowPlate
              setlistName={setlist.title}
              size="full"
            />
            <div className="flex justify-center mt-4">
              <button
                onClick={() => setShareFlowOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-body bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-colors"
              >
                <Share2 className="w-4 h-4" /> Share Plate
              </button>
            </div>
          </motion.div>

          {/* === Cassette spine strip below the card === */}
          <div className="cassette-spine mx-4 sm:mx-8 h-8 flex items-center justify-center border-x border-b border-border/40 rounded-b-sm mt-8">
            <span className="font-marker text-[9px] tracking-[0.3em] uppercase text-muted-foreground/50">
              {setlist.title} · {eraName || "Dead-Set.Org"} · {slots.length} songs
            </span>
          </div>

          {/* Stewardship line — credit the source */}
          <p className="font-body text-xs text-muted-foreground/70 text-center mt-6 px-4 leading-relaxed">
            Built on the shoulders of the tapers, traders, and the{" "}
            <a
              href="https://archive.org/details/GratefulDead"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Internet Archive
            </a>
            .
          </p>
        </motion.article>
      </div>

      {/* Share Flow with Show Plate */}
      <ShareFlow
        open={shareFlowOpen}
        onClose={() => setShareFlowOpen(false)}
        setlistId={id || ""}
        setlistName={setlist?.title || "Dream Setlist"}
        eraName={eraName}
        creatorName={creatorName}
        songCount={slots.length}
        description={setlist?.description}
      />
    </div>
  );
};

export default SetlistPoster;
