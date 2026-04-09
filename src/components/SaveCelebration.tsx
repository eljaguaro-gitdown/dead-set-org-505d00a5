import { motion } from "framer-motion";
import { Share2, ExternalLink, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import ShareDropdown from "@/components/ShareDropdown";

interface SaveCelebrationProps {
  setlistId: string;
  setlistTitle: string;
  onDismiss: () => void;
}

const SaveCelebration = ({ setlistId, setlistTitle, onDismiss }: SaveCelebrationProps) => {
  const posterUrl = `${window.location.origin}/setlist/${setlistId}`;
  const ogUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/og-image?id=${setlistId}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/60 backdrop-blur-sm"
      onClick={onDismiss}
    >
      <motion.div
        className="bg-card border border-border rounded-xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 16 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.15, duration: 0.4, ease: "easeOut" }}
          className="text-4xl mb-3"
        >
          🎉
        </motion.div>

        <h3 className="font-display text-xl text-foreground mb-1">Your setlist is saved!</h3>
        <p className="font-body text-sm text-muted-foreground mb-5">Share it with the world:</p>

        <div className="flex justify-center mb-4">
          <ShareDropdown
            url={posterUrl}
            ogUrl={ogUrl}
            title={`${setlistTitle} — Dead-Set.Org`}
            description={`Check out my dream Dead show: ${setlistTitle}`}
          />
        </div>

        <a
          href={`/setlist/${setlistId}`}
          className="inline-flex items-center gap-1.5 text-sm font-body text-primary hover:text-primary/80 transition-colors"
        >
          View your poster <ExternalLink className="w-3 h-3" />
        </a>

        <div className="mt-5">
          <button
            onClick={onDismiss}
            className="text-xs font-body text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            Dismiss
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default SaveCelebration;
