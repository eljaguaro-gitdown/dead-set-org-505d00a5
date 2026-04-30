import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp, LayoutList } from "lucide-react";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";

/**
 * Persistent floating pill: when audio is playing from a setlist and the user
 * has navigated away from that setlist's page, show a one-tap return CTA.
 * Sits just above the AudioPlayer bar so it never collides with playback controls.
 */
const ReturnToSetlistPill = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeSetlistId, playingSlot } = useAudioPlayer();

  if (!activeSetlistId || !playingSlot) return null;
  // Hide if already on the setlist page (poster or builder)
  if (location.pathname.includes(`/setlist/${activeSetlistId}`)) return null;
  if (location.pathname.includes(`/builder/${activeSetlistId}`)) return null;

  return (
    <AnimatePresence>
      <motion.button
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        onClick={() => navigate(`/setlist/${activeSetlistId}`)}
        className="fixed bottom-[88px] left-1/2 -translate-x-1/2 z-30 h-10 px-4 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center gap-2 hover:brightness-110 transition-all border border-primary/40"
        style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
        title="Return to the setlist you're playing"
        aria-label="Return to setlist"
      >
        <LayoutList className="w-4 h-4" />
        <span className="font-body text-sm font-medium">Back to Setlist</span>
        <ChevronUp className="w-4 h-4" />
      </motion.button>
    </AnimatePresence>
  );
};

export default ReturnToSetlistPill;
