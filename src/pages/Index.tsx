import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import StealYourFace from "@/components/StealYourFace";
import DancingBear from "@/components/DancingBear";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import PageLayout from "@/components/PageLayout";
import SiteHeader from "@/components/SiteHeader";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      navigate("/my-setlists", { replace: true });
    }
  }, [user, loading, navigate]);

  return (
    <PageLayout>
      {/* Top nav */}
      <SiteHeader large>
        <button
          onClick={() => navigate("/browse")}
          className="font-display text-sm tracking-[0.15em] text-muted-foreground hover:text-primary transition-colors uppercase"
        >
          Archive
        </button>
        <button
          onClick={() => navigate("/auth")}
          className="font-display text-sm tracking-[0.15em] text-muted-foreground hover:text-primary transition-colors uppercase"
        >
          Sign In
        </button>
      </SiteHeader>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 relative overflow-hidden">
        {/* Warm ambient glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] rounded-full bg-[radial-gradient(circle,hsl(var(--dead-gold)/0.08),transparent_70%)]" />
          <div className="absolute top-1/3 left-1/4 w-[250px] sm:w-[400px] h-[250px] sm:h-[400px] rounded-full bg-[radial-gradient(circle,hsl(var(--dead-red)/0.05),transparent_70%)]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="flex flex-col items-center gap-5 sm:gap-8 relative z-10 text-center"
        >
          <div className="sm:hidden"><StealYourFace size={100} /></div>
          <div className="hidden sm:block"><StealYourFace size={150} /></div>

          <div className="space-y-3 sm:space-y-4">
            <h1 className="font-display text-4xl sm:text-6xl md:text-8xl lg:text-9xl tracking-tight text-foreground leading-none">
              Dead Set
            </h1>
            <div className="w-16 sm:w-24 h-px bg-primary mx-auto" />
            <p className="font-marker text-base sm:text-lg md:text-xl text-muted-foreground max-w-md mx-auto tracking-wide uppercase">
              Build Your Dream Setlists
            </p>
          </div>

          {/* Tape label callout */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="border border-primary/30 bg-primary/5 backdrop-blur-sm rounded-sm px-5 sm:px-8 py-3 sm:py-4 max-w-lg"
          >
            <p className="font-hand text-lg sm:text-xl md:text-2xl text-dead-cream/70 italic leading-relaxed">
              "The music never stopped — now curate your own."
            </p>
          </motion.div>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-2 sm:mt-4 w-full sm:w-auto px-4 sm:px-0">
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="font-display text-sm sm:text-base px-8 sm:px-10 py-5 sm:py-6 bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_30px_hsl(var(--glow-gold))] tracking-widest uppercase w-full sm:w-auto"
            >
              Start Building
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate("/auth")}
              className="font-body text-sm sm:text-base px-8 sm:px-10 py-5 sm:py-6 border-border text-foreground hover:bg-muted hover:border-primary/40 tracking-wide w-full sm:w-auto"
            >
              I Have an Account
            </Button>
          </div>
        </motion.div>

        {/* Eras */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.8 }}
          className="mt-12 sm:mt-20 mb-6 sm:mb-8 relative z-10 w-full max-w-2xl"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="h-px flex-1 bg-border" />
            <span className="font-display text-xs tracking-[0.2em] text-muted-foreground uppercase">Explore the Eras</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 px-2">
            {[
              { era: "Primal Dead", years: "'65–'69", color: "border-dead-red/40 hover:border-dead-red hover:text-dead-red" },
              { era: "Europe '72", years: "'70–'74", color: "border-dead-gold/40 hover:border-dead-gold hover:text-dead-gold" },
              { era: "Wall of Sound", years: "'73–'74", color: "border-dead-orange/40 hover:border-dead-orange hover:text-dead-orange" },
              { era: "Hiatus", years: "'75–'76", color: "border-dead-blue/40 hover:border-dead-blue hover:text-dead-blue" },
              { era: "Terrapin", years: "'77–'79", color: "border-dead-green/40 hover:border-dead-green hover:text-dead-green" },
              { era: "Brent Years", years: "'79–'90", color: "border-dead-purple/40 hover:border-dead-purple hover:text-dead-purple" },
              { era: "Final Run", years: "'90–'95", color: "border-dead-pink/40 hover:border-dead-pink hover:text-dead-pink" },
            ].map(({ era, years, color }) => (
              <button
                key={era}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-hand text-muted-foreground border rounded-sm transition-all duration-300 cursor-default ${color}`}
              >
                <span className="font-marker text-[10px] sm:text-xs tracking-wide">{era}</span>
                <span className="text-[10px] sm:text-xs text-muted-foreground/60 ml-1 sm:ml-2">{years}</span>
              </button>
            ))}
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="py-4 sm:py-6 text-center border-t border-border/50">
        <div className="flex items-center justify-center gap-2 text-muted-foreground text-xs sm:text-sm font-body">
          <span>Built by Deadheads, for Deadheads</span>
          <span className="mx-1">·</span>
          <DancingBear color="primary" />
          <DancingBear color="gold" />
          <DancingBear color="blue" />
        </div>
      </footer>
    </PageLayout>
  );
};

export default Index;
