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
      className="drop-shadow-[0_0_25px_hsl(var(--glow-gold))]"
    >
      {/* Outer ring */}
      <circle cx="100" cy="100" r="97" fill="none" stroke="hsl(var(--dead-gold))" strokeWidth="4" />
      <circle cx="100" cy="100" r="93" fill="hsl(var(--dead-dark))" stroke="hsl(var(--dead-gold))" strokeWidth="2" />

      {/* Left half - blue */}
      <clipPath id="leftHalf">
        <rect x="0" y="0" width="100" height="200" />
      </clipPath>
      <clipPath id="rightHalf">
        <rect x="100" y="0" width="100" height="200" />
      </clipPath>
      <clipPath id="innerCircle">
        <circle cx="100" cy="100" r="91" />
      </clipPath>

      {/* Blue left half */}
      <circle cx="100" cy="100" r="91" fill="hsl(var(--dead-blue))" clipPath="url(#leftHalf)" />
      {/* Red right half */}
      <circle cx="100" cy="100" r="91" fill="hsl(var(--dead-red))" clipPath="url(#rightHalf)" />

      {/* Lightning bolt divider */}
      <motion.polygon
        points="100,9 88,72 100,68 82,100 96,96 78,140 100,130 84,191 100,191 116,140 100,148 122,100 104,104 118,68 100,72 112,9"
        fill="hsl(var(--dead-gold))"
        stroke="hsl(var(--dead-dark))"
        strokeWidth="1"
        initial={{ opacity: 0.9 }}
        animate={{ opacity: [0.9, 1, 0.9] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        clipPath="url(#innerCircle)"
      />

      {/* Skull */}
      <g clipPath="url(#innerCircle)">
        {/* Cranium */}
        <ellipse cx="100" cy="88" rx="42" ry="46" fill="hsl(var(--dead-cream))" stroke="hsl(var(--dead-dark))" strokeWidth="1.5" />
        
        {/* Forehead ridge */}
        <path d="M62 78 Q100 60 138 78" fill="none" stroke="hsl(var(--dead-dark))" strokeWidth="1" opacity="0.3" />
        
        {/* Left eye socket */}
        <motion.ellipse
          cx="82" cy="85" rx="13" ry="14"
          fill="hsl(var(--dead-dark))"
          stroke="hsl(var(--dead-dark))"
          strokeWidth="1"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
        {/* Right eye socket */}
        <motion.ellipse
          cx="118" cy="85" rx="13" ry="14"
          fill="hsl(var(--dead-dark))"
          stroke="hsl(var(--dead-dark))"
          strokeWidth="1"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
        />

        {/* Nose cavity */}
        <path d="M95 102 L100 112 L105 102" fill="hsl(var(--dead-dark))" stroke="hsl(var(--dead-dark))" strokeWidth="1" />
        
        {/* Upper jaw / teeth area */}
        <path d="M72 115 Q100 125 128 115" fill="none" stroke="hsl(var(--dead-dark))" strokeWidth="1.5" />
        
        {/* Jaw bone */}
        <path 
          d="M68 110 Q65 130 80 142 Q100 152 120 142 Q135 130 132 110" 
          fill="hsl(var(--dead-cream))" 
          stroke="hsl(var(--dead-dark))" 
          strokeWidth="1.5" 
        />
        
        {/* Teeth */}
        <line x1="85" y1="115" x2="85" y2="125" stroke="hsl(var(--dead-dark))" strokeWidth="1" opacity="0.5" />
        <line x1="92" y1="116" x2="92" y2="127" stroke="hsl(var(--dead-dark))" strokeWidth="1" opacity="0.5" />
        <line x1="100" y1="117" x2="100" y2="128" stroke="hsl(var(--dead-dark))" strokeWidth="1" opacity="0.5" />
        <line x1="108" y1="116" x2="108" y2="127" stroke="hsl(var(--dead-dark))" strokeWidth="1" opacity="0.5" />
        <line x1="115" y1="115" x2="115" y2="125" stroke="hsl(var(--dead-dark))" strokeWidth="1" opacity="0.5" />
      </g>

      {/* Outer gold ring highlight */}
      <circle cx="100" cy="100" r="95" fill="none" stroke="hsl(var(--dead-gold))" strokeWidth="1" opacity="0.5" />
    </motion.svg>
  );
};

export default StealYourFace;
