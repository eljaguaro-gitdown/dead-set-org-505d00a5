import { motion } from "framer-motion";
import { Instagram } from "lucide-react";
import BrowseCommunityLink from "./BrowseCommunityLink";

const PersonalNote = () => (
  <motion.section
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ delay: 0.5, duration: 0.6, ease: "easeOut" }}
    className="py-16 sm:py-24 px-6 sm:px-12"
  >
    <div className="max-w-2xl mx-auto flex flex-col items-center text-center gap-6">
      {/* Gold ornament separator */}
      <span className="text-primary/40 text-xl select-none">✦</span>

      <blockquote className="font-hand text-xl sm:text-2xl text-muted-foreground leading-relaxed">
        "The band may be gone, but the music will never stop. Thanks to an incredible community — and the Internet
        Archive preserving 50 years of live recordings — there are still endless gems waiting to be found. I built
        Dead-Set.Org to help us find them, share them, and keep the flame alive."
      </blockquote>

      <span className="font-body text-sm sm:text-base text-primary/60 tracking-wider">
        — Kinda feels like we are on to something fun - curated setlists, parking lot vibes, endless surprise and
        delight moments. See ya backstage!
      </span>

      <a
        href="https://instagram.com/grateful_jaguaro"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-primary/30 text-primary/80 hover:text-primary hover:border-primary/60 hover:bg-primary/5 transition-all font-body text-sm"
      >
        <Instagram className="w-4 h-4" />
        <span>Follow @grateful_jaguaro on Instagram</span>
      </a>
    </div>
  </motion.section>
);

export default PersonalNote;
