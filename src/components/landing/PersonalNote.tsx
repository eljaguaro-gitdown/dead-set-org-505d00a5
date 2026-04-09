import { motion } from "framer-motion";

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
        "The band may be gone, but the music never stopped. Thanks to an incredible
        community — and the Internet Archive preserving 50 years of live recordings —
        there are still endless gems waiting to be found. I built Dead-Set.Org to help you
        find them, share them, and keep the flame alive."
      </blockquote>

      <span className="font-body text-sm sm:text-base text-primary/60 tracking-wider">
        — Built by a Deadhead, for the community
      </span>
    </div>
  </motion.section>
);

export default PersonalNote;
