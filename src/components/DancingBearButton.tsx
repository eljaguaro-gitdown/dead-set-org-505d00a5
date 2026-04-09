import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import dancingBear from "@/assets/dancing-bear.gif";

const DancingBearButton = () => {
  const navigate = useNavigate();

  return (
    <motion.button
      onClick={() => navigate("/builder")}
      className="group flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 hover:bg-primary/15 hover:border-primary/60 transition-all duration-300"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      title="Cosmic Charlie — Your Deadhead Guide"
    >
      {/* Dancing bear image */}
      <motion.img
        src={dancingBear}
        alt="Dancing Bear"
        className="w-7 h-7 object-contain select-none"
        animate={{
          y: [0, -2, 0],
        }}
        transition={{
          duration: 2.4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

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
