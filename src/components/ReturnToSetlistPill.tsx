import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp, LayoutList } from "lucide-react";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Persistent floating mini setlist card: when audio is playing from a setlist
 * and the user has navigated away from that setlist's page, show a one-tap
 * return CTA enriched with the setlist title and track progress
 * (e.g. "3 of 17"). Sits just above the AudioPlayer bar so it never collides
 * with playback controls.
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

  // Fetch the active setlist's title whenever the active setlist changes.
  useEffect(() => {
    let cancelled = false;
    if (!activeSetlistId) {
      setSetlistTitle(null);
      return;
    }
    supabase
      .from("setlists")
      .select("title")
      .eq("id", activeSetlistId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setSetlistTitle(data?.title ?? "Your setlist");
      });
    return () => {
      cancelled = true;
    };
  }, [activeSetlistId]);

  if (!activeSetlistId || !playingSlot) return null;
  // Hide if already on the setlist page (poster or builder)
  if (location.pathname.includes(`/setlist/${activeSetlistId}`)) return null;
  if (location.pathname.includes(`/builder/${activeSetlistId}`)) return null;

  const total = playlistMode ? playlistSlots.length : 1;
  const current = playlistMode ? playlistIndex + 1 : 1;
  const progressPct = total > 0 ? (current / total) * 100 : 0;

  return (
    <AnimatePresence>
      <motion.button
        key="return-to-setlist-card"
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        onClick={() => navigate(`/setlist/${activeSetlistId}`)}
        className="fixed bottom-[96px] left-1/2 -translate-x-1/2 z-30
                   w-[min(92vw,420px)] rounded-[14px]
                   bg-card/95 backdrop-blur-md border border-primary/40
                   shadow-[0_12px_32px_-8px_hsl(var(--primary)/0.45)]
                   hover:border-primary/70 transition-all
                   text-left overflow-hidden group"
        style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
        title="Return to the setlist you're playing"
        aria-label={`Back to setlist ${setlistTitle ?? ""}`}
      >
        <div className="flex items-center gap-3 px-3.5 py-2.5">
          <div className="w-9 h-9 shrink-0 rounded-[10px] bg-primary/15 border border-primary/30 flex items-center justify-center">
            <LayoutList className="w-4 h-4 text-primary" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="font-mono uppercase tracking-[0.18em] text-[10px] text-primary/80">
              Now playing · Back to setlist
            </div>
            <div className="font-body text-sm text-foreground truncate">
              {setlistTitle ?? "Your setlist"}
            </div>
            {playlistMode && total > 1 && (
              <div className="font-mono text-[11px] text-muted-foreground mt-0.5 truncate">
                Track {current} of {total} · {playingSlot.song.title}
              </div>
            )}
          </div>

          <ChevronUp className="w-4 h-4 text-primary/80 group-hover:text-primary shrink-0" />
        </div>

        {/* Progress strip */}
        {playlistMode && total > 1 && (
          <div className="h-[3px] w-full bg-primary/10">
            <motion.div
              className="h-full bg-primary"
              initial={false}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
        )}
      </motion.button>
    </AnimatePresence>
  );
};

export default ReturnToSetlistPill;
