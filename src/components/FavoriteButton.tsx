import { Heart } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  isFavorite: boolean;
  onToggle: (e: React.MouseEvent) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}

const FavoriteButton = ({ isFavorite, onToggle, disabled, size = "sm" }: FavoriteButtonProps) => {
  return (
    <motion.button
      onClick={(e) => {
        e.stopPropagation();
        onToggle(e);
      }}
      disabled={disabled}
      className={cn(
        "rounded-full flex items-center justify-center transition-colors",
        size === "sm" ? "w-7 h-7" : "w-9 h-9",
        isFavorite
          ? "text-primary bg-primary/15 hover:bg-primary/25"
          : "text-muted-foreground/40 hover:text-primary/60 hover:bg-primary/10",
        disabled && "opacity-50 cursor-not-allowed"
      )}
      whileTap={{ scale: 0.85 }}
      animate={isFavorite ? { scale: [1, 1.3, 1] } : {}}
      transition={{ duration: 0.3 }}
      title={isFavorite ? "Remove from favorites" : "Add to favorites"}
    >
      <Heart
        className={cn(
          size === "sm" ? "w-3.5 h-3.5" : "w-4.5 h-4.5",
          isFavorite && "fill-primary"
        )}
      />
    </motion.button>
  );
};

export default FavoriteButton;
