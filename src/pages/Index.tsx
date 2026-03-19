import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import StealYourFace from "@/components/StealYourFace";
import DancingBear from "@/components/DancingBear";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

const tapeLabels = [
  { date: "05·08·77", venue: "Barton Hall, Cornell", color: "bg-dead-orange/20 border-dead-orange/40" },
  { date: "08·27·72", venue: "Veneta, OR", color: "bg-dead-gold/20 border-dead-gold/40" },
  { date: "02·13·70", venue: "Fillmore East", color: "bg-dead-red/20 border-dead-red/40" },
  { date: "08·13·75", venue: "Great American Music Hall", color: "bg-dead-blue/20 border-dead-blue/40" },
  { date: "05·02·70", venue: "Harpur College", color: "bg-dead-cream/20 border-dead-cream/40" },
];

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      navigate("/my-setlists", { replace: true });
    }
  }, [user, loading, navigate]);

  return (
    <div className="grain-overlay min-h-screen bg-background flex flex-col">
      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 text-center relative overflow-hidden">
        {/* Floating tape labels — decorative background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {tapeLabels.map((tape, i) => (
            <motion.div
              key={tape.date}
              initial={{ opacity: 0, x: i % 2 === 0 ? -100 : 100, rotate: (i - 2) * 8 }}
              animate={{ opacity: 0.12, x: 0 }}
              transition={{ delay: 0.8 + i * 0.15, duration: 1.2 }}
              className={`absolute border rounded-sm px-4 py-2 font-hand text-foreground ${tape.color}`}
              style={{
                top: `${15 + i * 16}%`,
                left: i % 2 === 0 ? '5%' : undefined,
                right: i % 2 !== 0 ? '5%' : undefined,
                fontSize: `${1.1 + Math.random() * 0.4}rem`,
              }}
            >
              <span className="font-display text-sm tracking-wide">{tape.date}</span>
              <br />
              <span>{tape.venue}</span>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="flex flex-col items-center gap-6 relative z-10"
        >
          <StealYourFace size={120} />

          <div className="space-y-3">
            <h1 className="font-display text-5xl sm:text-7xl md:text-8xl tracking-tight text-foreground">
              Dead Set
            </h1>
            <p className="font-hand text-2xl sm:text-3xl text-dead-cream/80 max-w-lg mx-auto leading-relaxed">
              Build your dream setlists. Trade the music.
            </p>
          </div>

          {/* Cassette-label styled tagline */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mt-2 border border-dead-orange/30 bg-dead-orange/5 rounded-sm px-6 py-3 max-w-md"
          >
            <p className="font-hand text-lg text-dead-cream/70 italic">
              "Every show is different — that's the whole point."
            </p>
          </motion.div>

          <div className="flex flex-col sm:flex-row gap-4 mt-6">
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="font-display text-base px-8 py-6 bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_hsl(var(--dead-red)/0.3)] tracking-wide"
            >
              Start Building
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate("/auth")}
              className="font-hand text-xl px-8 py-6 border-border text-foreground hover:bg-muted"
            >
              I have an account
            </Button>
          </div>
        </motion.div>

        {/* Era pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 1 }}
          className="mt-14 flex flex-wrap justify-center gap-2 max-w-lg relative z-10"
        >
          {["Pigpen Era", "Europe '72", "Wall of Sound", "Hiatus", "Brent Years", "Spring '90", "Final Tours"].map((era) => (
            <span
              key={era}
              className="px-3 py-1 text-sm font-hand text-muted-foreground border border-border rounded-sm hover:border-dead-gold/40 hover:text-dead-gold transition-colors cursor-default"
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
