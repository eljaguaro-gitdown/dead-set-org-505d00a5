import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import StealYourFace from "@/components/StealYourFace";
import DancingBear from "@/components/DancingBear";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import PageLayout from "@/components/PageLayout";
import SiteHeader from "@/components/SiteHeader";
import { Music, Users, Zap, Archive, ListMusic, Share2 } from "lucide-react";

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
      <main className="flex-1 flex flex-col items-center px-4 relative overflow-hidden">
        {/* Warm ambient glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] rounded-full bg-[radial-gradient(circle,hsl(var(--dead-gold)/0.08),transparent_70%)]" />
          <div className="absolute top-1/3 left-1/4 w-[250px] sm:w-[400px] h-[250px] sm:h-[400px] rounded-full bg-[radial-gradient(circle,hsl(var(--dead-red)/0.05),transparent_70%)]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="flex flex-col items-center gap-5 sm:gap-8 relative z-10 text-center mt-12 sm:mt-20"
        >
          <div className="sm:hidden"><StealYourFace size={100} /></div>
          <div className="hidden sm:block"><StealYourFace size={150} /></div>

          <div className="space-y-3 sm:space-y-4">
            <h1 className="font-display text-4xl sm:text-6xl md:text-8xl lg:text-9xl tracking-tight text-foreground leading-none">
              Dead Set
            </h1>
            <div className="w-16 sm:w-24 h-px bg-primary mx-auto" />
            <p className="font-marker text-base sm:text-lg md:text-xl text-muted-foreground max-w-md mx-auto tracking-wide uppercase">
              Build Your Dream Grateful Dead Setlists
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
              onClick={() => navigate("/browse")}
              className="font-body text-sm sm:text-base px-8 sm:px-10 py-5 sm:py-6 border-border text-foreground hover:bg-muted hover:border-primary/40 tracking-wide w-full sm:w-auto"
            >
              Browse Setlists
            </Button>
          </div>
        </motion.div>

        {/* Features Section */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="relative z-10 w-full max-w-5xl mt-16 sm:mt-24 px-2"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="h-px flex-1 bg-border" />
            <span className="font-display text-xs tracking-[0.2em] text-muted-foreground uppercase">What You Can Do</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[
              { icon: ListMusic, title: "Craft Dream Setlists", desc: "Drag and drop from the complete Grateful Dead songbook. Organize by set — first set, second set, encore — just like a real show. Add segue markers (→) between songs to map out those legendary transitions." },
              { icon: Zap, title: "AI Dead Head Generator", desc: "Let our AI create unique setlists inspired by different eras and vibes. Whether you want a psychedelic '68 Primal Dead show or a spacey '74 Wall of Sound night, the AI crafts historically-informed dream shows you've never seen." },
              { icon: Archive, title: "Listen to Notable Versions", desc: "Every song links to real live recordings from the Internet Archive. Hear the legendary 5/8/77 Scarlet→Fire, the 2/13/70 Dark Star, or discover hidden gems from shows you've never explored." },
              { icon: Users, title: "Collaborate in Real-Time", desc: "Invite fellow Deadheads to build setlists together. Share a link, add collaborators, and debate whether Estimated Prophet or Eyes of the World should close the second set — with live chat built right in." },
              { icon: Share2, title: "Share & Discover", desc: "Publish your setlists for the community to explore. Browse what other Deadheads have curated, upvote your favorites, and find inspiration from creative combinations you'd never have thought of." },
              { icon: Music, title: "Explore Every Era", desc: "From the raw acid-drenched jams of the Primal Dead (1965-69) through the jazz-infused Europe '72 tour, the massive Wall of Sound era, the melodic Terrapin years, and the Brent Mydland era — every chapter of the Dead's 30-year journey is represented." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="border border-border/60 bg-card/50 backdrop-blur-sm rounded-lg p-5 sm:p-6 hover:border-primary/30 transition-colors">
                <Icon className="w-6 h-6 text-primary mb-3" />
                <h3 className="font-display text-sm text-foreground mb-2">{title}</h3>
                <p className="font-body text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* About Section */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.8 }}
          className="relative z-10 w-full max-w-3xl mt-16 sm:mt-20 px-2"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="h-px flex-1 bg-border" />
            <span className="font-display text-xs tracking-[0.2em] text-muted-foreground uppercase">About Dead Set</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <div className="space-y-4 font-body text-sm text-muted-foreground leading-relaxed">
            <p>
              Dead Set is a community-driven platform for Grateful Dead fans to build, share, and explore dream setlists. 
              The Grateful Dead performed over 2,300 concerts between 1965 and 1995, with a repertoire of hundreds of songs 
              that were constantly reimagined and extended through improvisation. No two shows were ever the same.
            </p>
            <p>
              Every Deadhead has imagined their perfect show — the ideal opener, the mind-bending second set sandwich, 
              the surprise encore deep cut. Dead Set makes it possible to bring those dream shows to life. Our complete 
              songbook includes every song the Dead performed, with historical data on when each song was first and last 
              played, how many times it appeared in concert, and which set position it typically occupied.
            </p>
            <p>
              What makes Dead Set unique is the connection to real performances. Through the Internet Archive's incredible 
              collection of live Grateful Dead recordings — made possible by the band's legendary taper-friendly policy — 
              you can listen to notable versions of every song. Hear the raw energy of a 1969 Fillmore West Dark Star, 
              the crystalline beauty of a 1977 Cornell Barton Hall Scarlet Begonias, or the funky groove of a 1989 
              Brent-era Estimated Prophet.
            </p>
            <p>
              Whether you're a seasoned tape trader who's been on the bus since the Acid Tests, or a new fan just 
              discovering the magic of live Dead music, Dead Set gives you the tools to curate, share, and celebrate 
              the greatest American band of all time.
            </p>
          </div>
        </motion.section>

        {/* Eras */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.8 }}
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
      <footer className="py-4 sm:py-6 text-center border-t border-border/50 space-y-2">
        <div className="flex items-center justify-center gap-2 text-muted-foreground text-xs sm:text-sm font-body">
          <span>Built by Deadheads, for Deadheads</span>
          <span className="mx-1">·</span>
          <DancingBear color="primary" />
          <DancingBear color="gold" />
          <DancingBear color="blue" />
        </div>
        <p className="font-hand text-xs text-muted-foreground/70 max-w-md mx-auto px-4">
          🎵 Powered by live recordings from the{" "}
          <a
            href="https://archive.org"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 text-primary/70 hover:text-primary transition-colors"
          >
            Internet Archive
          </a>
          {" "}— preserving our musical heritage for all. Deeply grateful for their mission.
        </p>
        <button
          onClick={() => navigate("/privacy")}
          className="font-hand text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors underline underline-offset-2"
        >
          Privacy Policy
        </button>
      </footer>
    </PageLayout>
  );
};

export default Index;
