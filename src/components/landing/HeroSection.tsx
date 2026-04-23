import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { trackCtaClick } from "@/lib/trackCtaClick";
import StealYourFace from "@/components/StealYourFace";
import AmbientPlayer from "@/components/AmbientPlayer";
import SocialProof from "@/components/landing/SocialProof";
import FeaturedCards from "@/components/landing/FeaturedCards";
import { Button } from "@/components/ui/button";

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: "easeOut" as const },
});

const isMobile = () => typeof window !== "undefined" && window.innerWidth < 640;

interface FeaturedSetlist {
  id: string;
  title: string;
  creator_id: string;
  era_id: string | null;
  upvote_count: number;
  play_count: number;
  creator_name?: string;
  era_name?: string;
  song_count?: number;
}

interface HeroSectionProps {
  showReturningSignIn?: boolean;
  featured?: FeaturedSetlist[];
}

const HeroSection = ({ showReturningSignIn = true, featured = [] }: HeroSectionProps) => {
  const navigate = useNavigate();

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-5 sm:px-12 relative overflow-hidden">
      {/* Gold radial glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-[radial-gradient(circle,hsl(var(--dead-gold)/0.08),transparent_70%)]" />
      </div>

      <div
        className="flex flex-col items-center gap-5 sm:gap-8 relative z-10 text-center max-w-2xl w-full py-10 sm:py-16"
      >
        {/* 1. SYF Logo */}
        <div>
          <StealYourFace size={isMobile() ? 72 : 140} />
        </div>

        {/* 2. Headline — tighter for mobile */}
        <h1
          className="font-display text-2xl sm:text-4xl md:text-5xl text-primary leading-none tracking-tight"
        >
          Your dream Dead show,
          <br />
          built from real recordings.
        </h1>

        {/* 3. Subhead — one punchy sentence */}
        <p
          className="font-body text-sm sm:text-base text-muted-foreground leading-relaxed max-w-[480px] px-2"
        >
          Tell Cosmic Charlie your vibe and he'll craft a full concert
          from 2,300+ shows in the Archive — every note is real.
        </p>

        {/* 3b. Social proof */}
        <SocialProof />

        {/* 4. Audio Preview Strip */}
        <motion.div {...fade(0.16)} className="flex flex-col items-center gap-2">
          <span className="font-mono text-[25px] tracking-[0.2em] text-muted-foreground/50 uppercase">
            🎧 Now playing from the Archive
          </span>
          <AmbientPlayer />
        </motion.div>

        {/* 5. Primary CTA */}
        <motion.div {...fade(0.2)} className="w-full sm:w-auto flex flex-col items-center gap-3">
          <Button
            size="lg"
            onClick={() => {
              trackCtaClick("hero_primary_builder", "/builder?wizard=true");
              navigate("/builder?wizard=true");
            }}
            className="w-full sm:w-auto gap-2 text-base px-8 sm:px-12 py-5 shadow-[0_4px_40px_hsl(var(--glow-gold))] hover:shadow-[0_4px_60px_hsl(var(--glow-gold))]"
          >
            Let Cosmic Charlie Build Your Show
            <ChevronRight className="w-4 h-4" />
          </Button>
          {showReturningSignIn && (
            <span className="font-body text-sm text-muted-foreground/80">
              No account needed — sign in when you're ready to save
            </span>
          )}
          {showReturningSignIn && (
            <button
              onClick={() => {
                trackCtaClick("hero_returning_signin", "/auth");
                navigate("/auth");
              }}
              className="font-mono text-sm tracking-[0.15em] text-primary/70 hover:text-primary transition-colors underline underline-offset-4 decoration-primary/30 hover:decoration-primary/60"
            >
              Returning user? Sign in here
            </button>
          )}
        </motion.div>

        {/* 6. Browse CTA with visual preview cards */}
        <motion.div {...fade(0.24)} className="w-full flex flex-col items-center gap-3">
          {featured.length > 0 && <FeaturedCards setlists={featured} />}
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              trackCtaClick("hero_browse", "/browse");
              navigate("/browse");
            }}
            className="w-full sm:w-auto gap-2 border-primary/40 text-primary hover:bg-primary/10 hover:border-primary/60"
          >
            🔍 Browse Community Setlists
            <ChevronRight className="w-4 h-4" />
          </Button>
        </motion.div>
      </div>
    </main>
  );
};

export default HeroSection;
