import { motion } from "framer-motion";
import stealYourFace from "@/assets/steal-your-face.png";

const StealYourFace = ({ size = 120 }: { size?: number }) => {
  return (
    <motion.img
      src={stealYourFace}
      alt="Steal Your Face"
      width={size}
      height={size}
      initial={{ rotate: 0 }}
      animate={{ rotate: 360 }}
      transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
      className="drop-shadow-[0_0_25px_hsl(var(--glow-gold))] rounded-full"
    />
  );
};

export default StealYourFace;
