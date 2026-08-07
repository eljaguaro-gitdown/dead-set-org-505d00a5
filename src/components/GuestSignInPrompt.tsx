import { motion, AnimatePresence } from "framer-motion";
import { Save, FileImage, Share2, ThumbsUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GuestSignInPromptProps {
  open: boolean;
  onSignIn: () => void;
  onDismiss: () => void;
}

const perks = [
  { icon: Save, label: "Save your setlist so you never lose it" },
  { icon: FileImage, label: "Turn your setlist into a shareable show poster" },
  { icon: Share2, label: "Share with friends & the community" },
  { icon: ThumbsUp, label: "Upvote and discover other setlists" },
];

const GuestSignInPrompt = ({ open, onSignIn, onDismiss }: GuestSignInPromptProps) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-background/60 backdrop-blur-sm"
        onClick={onDismiss}
      >
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="bg-card border border-border rounded-xl p-6 sm:p-8 max-w-sm w-full shadow-2xl relative"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onDismiss}
            className="absolute top-3 right-3 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="text-center mb-5">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, duration: 0.35 }}
              className="text-3xl mb-2"
            >
              ⚡
            </motion.div>
            <h3 className="font-display text-xl text-accent-foreground mb-1">
              Nice setlist! Ready to keep it?
            </h3>
            <p className="font-body text-sm text-muted-foreground">
              Create a free account to unlock the full experience:
            </p>
          </div>

          <ul className="space-y-3 mb-6">
            {perks.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <span className="font-body text-sm text-card-foreground">{label}</span>
              </li>
            ))}
          </ul>

          <Button onClick={onSignIn} className="w-full mb-2" size="lg">
            🎟️ Create a free account
          </Button>

          <p className="text-center text-xs font-body text-muted-foreground mb-3">
            Already have one?{" "}
            <button onClick={onSignIn} className="text-accent-foreground hover:underline">
              Sign in
            </button>
          </p>

          <button
            onClick={onDismiss}
            className="w-full text-center text-xs font-body text-muted-foreground hover:text-muted-foreground transition-colors"
          >
            I'll keep building first
          </button>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default GuestSignInPrompt;
