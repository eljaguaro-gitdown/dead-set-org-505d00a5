import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import CosmicCharlieAvatar from "@/components/CosmicCharlieAvatar";

const DancingBearButton = () => {
  const navigate = useNavigate();

  return (
    <motion.button
      onClick={() => navigate("/builder?wizard=true")}
      className="group flex items-center gap-2.5 pl-1 pr-3.5 py-1 rounded-full border border-primary/30 bg-primary/5 hover:bg-primary/15 hover:border-primary/60 transition-all duration-300"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      title="Cosmic Charlie — Your Deadhead Guide"
    >
      {/* Cosmic Charlie portrait */}
      <CosmicCharlieAvatar size={28} glow={false} className="ring-1 ring-primary/40" />

      {/* Blinking label */}
      <motion.span
        className="font-display text-xs tracking-[0.12em] text-primary uppercase whitespace-nowrap"
        animate={{ opacity: [1, 1, 0.4, 1, 1] }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
          times: [0, 0.45, 0.5, 0.55, 1],
        }}
      >
        Cosmic Charlie
      </motion.span>

      {/* Sparkle dot */}
      <motion.span
        className="w-1.5 h-1.5 rounded-full bg-primary"
        animate={{ scale: [1, 1.6, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
    </motion.button>
  );
};

export default DancingBearButton;
