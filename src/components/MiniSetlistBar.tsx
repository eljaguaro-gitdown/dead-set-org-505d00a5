import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp, LayoutList } from "lucide-react";

interface MiniSetlistBarProps {
  title: string;
  songCount: number;
  onExpand: () => void;
  pulse: boolean;
}

const MiniSetlistBar = ({ title, songCount, onExpand, pulse }: MiniSetlistBarProps) => {
  return (
    <motion.button
      onClick={onExpand}
      className="fixed bottom-0 left-0 right-0 z-40 h-12 bg-card/95 backdrop-blur-sm border-t border-border/60 flex items-center justify-between px-4 md:hidden"
      animate={pulse ? { scale: [1, 1.02, 1] } : {}}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <LayoutList className="w-4 h-4 text-primary shrink-0" />
        <span className="font-body text-sm text-foreground truncate">{title}</span>
        <span className="text-xs text-muted-foreground font-body shrink-0">
          · {songCount} {songCount === 1 ? "song" : "songs"}
        </span>
      </div>
      <div className="flex items-center gap-1 text-muted-foreground shrink-0">
        <span className="text-xs font-body">View Setlist</span>
        <ChevronUp className="w-4 h-4" />
      </div>
    </motion.button>
  );
};

export default MiniSetlistBar;
