import { motion } from "framer-motion";

const StealYourFace = ({ size = 120 }: { size?: number }) => {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      initial={{ rotate: 0 }}
      animate={{ rotate: 360 }}
      transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
      className="drop-shadow-[0_0_20px_hsl(var(--dead-red)/0.3)]"
    >
      {/* Outer circle */}
      <circle cx="100" cy="100" r="95" fill="none" stroke="hsl(var(--dead-red))" strokeWidth="4" />
      
      {/* Inner circle — warm fill */}
      <circle cx="100" cy="100" r="85" fill="hsl(var(--dead-dark))" stroke="hsl(var(--dead-red))" strokeWidth="2" />
      
      {/* Lightning bolt */}
      <motion.path
        d="M100 15 L85 85 L105 80 L90 185 L115 95 L95 100 Z"
        fill="hsl(var(--dead-cream))"
        initial={{ opacity: 0.8 }}
        animate={{ opacity: [0.8, 1, 0.8] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
      
      {/* Left half - blue */}
      <path
        d="M100 15 A85 85 0 0 0 100 185 L90 185 L105 80 L85 85 Z"
        fill="hsl(var(--dead-blue))"
        opacity="0.4"
      />
      
      {/* Right half - red */}
      <path
        d="M100 15 A85 85 0 0 1 100 185 L115 95 L95 100 Z"
        fill="hsl(var(--dead-red))"
        opacity="0.3"
      />
      
      {/* Skull outline */}
      <ellipse cx="100" cy="90" rx="45" ry="50" fill="none" stroke="hsl(var(--dead-cream))" strokeWidth="2" opacity="0.8" />
      
      {/* Eyes */}
      <motion.circle
        cx="82" cy="80" r="10"
        fill="hsl(var(--dead-dark))"
        stroke="hsl(var(--dead-cream))"
        strokeWidth="1.5"
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 3, repeat: Infinity }}
      />
      <motion.circle
        cx="118" cy="80" r="10"
        fill="hsl(var(--dead-dark))"
        stroke="hsl(var(--dead-cream))"
        strokeWidth="1.5"
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
      />
      
      {/* Nose */}
      <path d="M95 95 L100 105 L105 95" fill="none" stroke="hsl(var(--dead-cream))" strokeWidth="1.5" opacity="0.7" />
      
      {/* Jaw */}
      <path d="M75 110 Q100 135 125 110" fill="none" stroke="hsl(var(--dead-cream))" strokeWidth="1.5" opacity="0.6" />
    </motion.svg>
  );
};

export default StealYourFace;
