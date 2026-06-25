import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp, LayoutList, X } from "lucide-react";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "deadset:lastActiveSetlist";
const DISMISS_KEY = "deadset:lastActiveSetlistDismissed";

interface PersistedSetlist {
  id: string;
  title: string;
  current?: number;
  total?: number;
  songTitle?: string;
}

/**
 * Persistent floating mini setlist card. Shows whenever a setlist is the
 * "active" one — either currently playing OR the last one the user was
 * playing in this browser (persisted to localStorage so it survives full
 * page reloads). Dismissable via the X.
 */
const ReturnToSetlistPill = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    activeSetlistId,
    playingSlot,
    playlistMode,
    playlistIndex,
    playlistSlots,
  } = useAudioPlayer();

  const [setlistTitle, setSetlistTitle] = useState<string | null>(null);
  const [persisted, setPersisted] = useState<PersistedSetlist | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as PersistedSetlist) : null;
    } catch {
      return null;
    }
  });
  const [dismissedId, setDismissedId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(DISMISS_KEY);
    } catch {
      return null;
    }
  });

  // The setlist we should surface: live one if playing, else last persisted one.
  const effectiveSetlistId = activeSetlistId ?? persisted?.id ?? null;

  // Fetch / cache title whenever the surfaced setlist changes.
  useEffect(() => {
    let cancelled = false;
    if (!effectiveSetlistId) {
      setSetlistTitle(null);
      return;
    }
    // Use cached title immediately if we have it
    if (!activeSetlistId && persisted?.id === effectiveSetlistId) {
      setSetlistTitle(persisted.title);
    }
    supabase
      .from("setlists")
      .select("title")
      .eq("id", effectiveSetlistId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setSetlistTitle(data?.title ?? "Your setlist");
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveSetlistId, activeSetlistId, persisted]);

  // Persist the live playing setlist so it survives reloads.
  useEffect(() => {
    if (!activeSetlistId || !playingSlot) return;
    const total = playlistMode ? playlistSlots.length : 1;
    const current = playlistMode ? playlistIndex + 1 : 1;
    const payload: PersistedSetlist = {
      id: activeSetlistId,
      title: setlistTitle ?? "Your setlist",
      current,
      total,
      songTitle: playingSlot.song.title,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* noop */
    }
    setPersisted(payload);
    // A new active setlist clears any prior dismissal.
    if (dismissedId && dismissedId !== activeSetlistId) {
      try {
        localStorage.removeItem(DISMISS_KEY);
      } catch {
        /* noop */
      }
      setDismissedId(null);
    }
  }, [activeSetlistId, playingSlot, playlistMode, playlistIndex, playlistSlots, setlistTitle, dismissedId]);

  if (!effectiveSetlistId) return null;
  if (dismissedId === effectiveSetlistId) return null;
  // Hide when already on the setlist's own pages
  if (location.pathname.includes(`/setlist/${effectiveSetlistId}`)) return null;
  if (location.pathname.includes(`/builder/${effectiveSetlistId}`)) return null;
  // When audio is actively playing, the GlobalAudioPlayer already exposes
  // "tap to return to setlist" — don't double up with this card.
  if (activeSetlistId && playingSlot) return null;

  // Source progress info from live state if playing, else from persisted snapshot.
  const isLive = !!activeSetlistId && !!playingSlot;
  const total = isLive ? (playlistMode ? playlistSlots.length : 1) : persisted?.total ?? 0;
  const current = isLive ? (playlistMode ? playlistIndex + 1 : 1) : persisted?.current ?? 0;
  const progressPct = total > 0 ? (current / total) * 100 : 0;
  const showProgress = total > 1;
  const songLine = isLive ? playingSlot!.song.title : persisted?.songTitle ?? "";

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      localStorage.setItem(DISMISS_KEY, effectiveSetlistId);
    } catch {
      /* noop */
    }
    setDismissedId(effectiveSetlistId);
  };

  // When audio is playing, dock above the player; otherwise dock at bottom.
  const bottomClass = isLive ? "bottom-[96px]" : "bottom-4";

  return (
    <AnimatePresence>
      <motion.div
        key="return-to-setlist-card"
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className={`fixed ${bottomClass} left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-30
                   sm:w-[min(92vw,420px)] max-w-[420px] mx-auto rounded-[14px]
                   bg-card/95 backdrop-blur-md border border-primary/40
                   shadow-[0_12px_32px_-8px_hsl(var(--primary)/0.45)]
                   hover:border-primary/70 transition-all overflow-hidden`}
        style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <button
          onClick={() => navigate(`/setlist/${effectiveSetlistId}`)}
          className="w-full text-left group"
          title="Return to your setlist"
          aria-label={`Back to setlist ${setlistTitle ?? ""}`}
        >
          <div className="flex items-center gap-3 px-3.5 py-2.5">
            <div className="w-9 h-9 shrink-0 rounded-[10px] bg-primary/15 border border-primary/30 flex items-center justify-center">
              <LayoutList className="w-4 h-4 text-primary" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="font-mono uppercase tracking-[0.18em] text-[10px] text-primary/80">
                {isLive ? "Now playing · Back to setlist" : "Pick up where you left off"}
              </div>
              <div className="font-body text-sm text-card-foreground truncate">
                {setlistTitle ?? "Your setlist"}
              </div>
              {showProgress && songLine && (
                <div className="font-mono text-[11px] text-muted-foreground mt-0.5 truncate">
                  Track {current} of {total} · {songLine}
                </div>
              )}
            </div>

            <ChevronUp className="w-4 h-4 text-primary/80 group-hover:text-primary shrink-0" />

            <button
              onClick={handleDismiss}
              className="w-7 h-7 -mr-1 rounded-md flex items-center justify-center text-muted-foreground hover:text-card-foreground hover:bg-foreground/5 transition-colors shrink-0"
              title="Dismiss"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {showProgress && (
            <div className="h-[3px] w-full bg-primary/10">
              <motion.div
                className="h-full bg-primary"
                initial={false}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>
          )}
        </button>
      </motion.div>
    </AnimatePresence>
  );
};

export default ReturnToSetlistPill;
