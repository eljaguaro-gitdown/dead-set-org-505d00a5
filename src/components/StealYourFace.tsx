import { forwardRef } from "react";
import stealYourFace from "@/assets/steal-your-face.png";

const StealYourFace = forwardRef<HTMLImageElement, { size?: number }>(
  ({ size = 120 }, ref) => {
    return (
      <img
        ref={ref}
        src={stealYourFace}
        alt="Steal Your Face"
        width={size}
        height={size}
        className="animate-spin-slow drop-shadow-[0_0_25px_hsl(var(--glow-gold))] rounded-full will-change-transform"
        loading="lazy"
      />
    );
  }
);

StealYourFace.displayName = "StealYourFace";

export default StealYourFace;
