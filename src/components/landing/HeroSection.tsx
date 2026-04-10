import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import StealYourFace from "@/components/StealYourFace";
import AmbientPlayer from "@/components/AmbientPlayer";
import { Button } from "@/components/ui/button";

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: "easeOut" as const },
});

const isMobile = () => typeof window !== "undefined" && window.innerWidth < 640;

const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-5 sm:px-12 relative overflow-hidden">
      {/* Gold radial glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-[radial-gradient(circle,hsl(var(--dead-gold)/0.08),transparent_70%)]" />
      </div>

      <motion.div
        {...fade(0)}
        className="flex flex-col items-center gap-6 sm:gap-8 relative z-10 text-center max-w-2xl w-full py-12 sm:py-16"
      >
        {/* 1. SYF Logo */}
        <motion.div {...fade(0)}>
          <StealYourFace size={isMobile() ? 80 : 140} />
        </motion.div>

        {/* 2. Headline */}
        <motion.h1
          {...fade(0.06)}
          className="font-display text-2xl sm:text-4xl md:text-5xl text-primary leading-none tracking-tight"
        >
          2,300 shows. 50 years of magic.
          <br />
          Yours to explore.
        </motion.h1>

        {/* 3. Subhead */}
        <motion.p
          {...fade(0.12)}
          className="font-body text-sm sm:text-base text-muted-foreground leading-relaxed max-w-[600px] px-2"
        >
          Dead-Set.Org pairs you with Cosmic Charlie — a guide who knows every show the Dead ever played. Tell him your
          mood, pick an era, and he'll build you a full concert from real live recordings in the Archive. Every note is
          real. Every show is yours to discover.
        </motion.p>

        {/* 4. Audio Preview Strip */}
        <motion.div {...fade(0.16)} className="flex flex-col items-center gap-2">
          <span className="font-mono text-[40px] tracking-[0.2em] text-muted-foreground/50 uppercase">
            🎧 Now playing from the Archive
          </span>
          <AmbientPlayer />
        </motion.div>

        {/* 5. Primary CTA */}
        <motion.div {...fade(0.2)} className="w-full sm:w-auto flex flex-col items-center gap-2">
          <Button
            size="lg"
            onClick={() => navigate("/builder?wizard=true")}
            className="w-full sm:w-auto gap-2 text-base px-8 sm:px-12 py-5 shadow-[0_4px_40px_hsl(var(--glow-gold))] hover:shadow-[0_4px_60px_hsl(var(--glow-gold))]"
          >
            Let Cosmic Charlie Build Your Show
            <ChevronRight className="w-4 h-4" />
          </Button>
          <span className="font-body text-sm sm:text-base text-muted-foreground/80">
            No account needed to start — sign in when you're ready to save
          </span>
        </motion.div>

        {/* 6. Secondary CTA */}
        <motion.div {...fade(0.24)} className="w-full sm:w-auto">
          <Button variant="outline" size="lg" onClick={() => navigate("/browse")} className="w-full sm:w-auto gap-2">
            Browse Community Setlists
            <ChevronRight className="w-4 h-4" />
          </Button>
        </motion.div>
      </motion.div>
    </main>
  );
};

export default HeroSection;
