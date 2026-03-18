import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import StealYourFace from "@/components/StealYourFace";
import DancingBear from "@/components/DancingBear";
import { Button } from "@/components/ui/button";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="grain-overlay min-h-screen bg-background flex flex-col">
      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="flex flex-col items-center gap-8"
        >
          <StealYourFace size={140} />

          <div className="space-y-4">
            <h1 className="font-display text-5xl sm:text-7xl md:text-8xl tracking-tight text-foreground">
              Dead Set
            </h1>
            <p className="font-body text-lg sm:text-xl text-muted-foreground max-w-md mx-auto">
              Build your dream setlists. Share the music.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <Button
              size="lg"
              onClick={() => navigate("/builder")}
              className="font-body text-base px-8 py-6 bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_hsl(var(--dead-red)/0.3)]"
            >
              Start Building
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate("/browse")}
              className="font-body text-base px-8 py-6 border-border text-foreground hover:bg-muted"
            >
              Browse Setlists
            </Button>
          </div>
        </motion.div>

        {/* Floating era tags */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 1 }}
          className="mt-16 flex flex-wrap justify-center gap-2 max-w-lg"
        >
          {["1965–69", "1970–74", "1975–77", "1978–79", "1980–83", "1984–89", "1990–95"].map((era) => (
            <span
              key={era}
              className="px-3 py-1 text-xs font-body text-muted-foreground border border-border rounded-full"
            >
              {era}
            </span>
          ))}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-muted-foreground text-sm font-body border-t border-border">
        <span>Built by Deadheads, for Deadheads</span>
        <span className="mx-2">
          <DancingBear color="primary" />
          <DancingBear color="gold" />
          <DancingBear color="blue" />
        </span>
      </footer>
    </div>
  );
};

export default Index;
