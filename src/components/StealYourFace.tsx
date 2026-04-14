import stealYourFace from "@/assets/steal-your-face.png";

const StealYourFace = ({ size = 120 }: { size?: number }) => {
  return (
    <img
      src={stealYourFace}
      alt="Steal Your Face"
      width={size}
      height={size}
      className="animate-spin-slow drop-shadow-[0_0_25px_hsl(var(--glow-gold))] rounded-full will-change-transform"
      loading="lazy"
    />
  );
};

export default StealYourFace;
