import { forwardRef } from "react";
import { charlieArtFor } from "@/lib/charlieArt";

/**
 * The house mark.
 *
 * This replaced a rendering of Steal Your Face. That mark belongs to Grateful
 * Dead Productions and is actively enforced by Rhino; App Store guideline
 * 4.1(c) bars another party's brand from an app's icon or name, and
 * store-visible use is what review actually catches. Cosmic Charlie is Matt
 * Leunig's original art, commissioned for this project, so it carries no such
 * exposure — and he is the app's guide, which makes him the better mark anyway.
 *
 * No spin: the old disc rotated once a minute, which reads as a turning record.
 * A portrait doing the same thing reads as a mistake.
 *
 * The art itself is picked by size — see charlieArtFor. In the site header this
 * renders at 28-48px, where the full illustration's mandala border swallows
 * the face entirely.
 */
const CharlieMark = forwardRef<HTMLImageElement, { size?: number }>(
  ({ size = 120 }, ref) => {
    return (
      <img
        ref={ref}
        src={charlieArtFor(size)}
        alt="Cosmic Charlie"
        width={size}
        height={size}
        className="rounded-full object-cover drop-shadow-[0_0_25px_hsl(var(--glow-gold))]"
        style={{ width: size, height: size }}
        loading="lazy"
      />
    );
  }
);

CharlieMark.displayName = "CharlieMark";

export default CharlieMark;
