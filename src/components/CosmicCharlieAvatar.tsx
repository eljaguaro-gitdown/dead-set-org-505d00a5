import { motion } from "framer-motion";
import { charlieArtFor } from "@/lib/charlieArt";

interface CosmicCharlieAvatarProps {
  size?: number;
  /** Add a slow breathing scale animation */
  animate?: boolean;
  /** Add the gold glow ring */
  glow?: boolean;
  className?: string;
}

/**
 * Brand portrait of Cosmic Charlie — the Deadhead Guide.
 * Use anywhere we surface Charlie (CTAs, dialog headers, welcome wizard).
 *
 * Renders from 28px (DancingBearButton) to 88px (the welcome wizard), so the
 * art is picked by size — see charlieArtFor. The welcome wizard and dialog
 * headers still get the full illustration; the small buttons get a crop that
 * is actually legible.
 */
const CosmicCharlieAvatar = ({
  size = 64,
  animate = false,
  glow = true,
  className = "",
}: CosmicCharlieAvatarProps) => {
  const img = (
    <img
      src={charlieArtFor(size)}
      alt="Cosmic Charlie"
      width={size}
      height={size}
      loading="lazy"
      className={`rounded-full object-cover select-none ${
        glow ? "ring-2 ring-primary/60 shadow-[0_0_30px_hsl(var(--glow-gold))]" : ""
      } ${className}`}
      style={{ width: size, height: size }}
    />
  );

  if (!animate) return img;

  return (
    <motion.div
      animate={{ scale: [1, 1.04, 1] }}
      transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      className="relative inline-block"
      style={{ width: size, height: size }}
    >
      {img}
    </motion.div>
  );
};

export default CosmicCharlieAvatar;
