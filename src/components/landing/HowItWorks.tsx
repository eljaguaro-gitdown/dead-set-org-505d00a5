import { motion } from "framer-motion";
import { Headphones, Music } from "lucide-react";
import CosmicCharlieAvatar from "@/components/CosmicCharlieAvatar";

type Step = {
  icon?: typeof Music;
  useCharlie?: boolean;
  title: string;
  desc: string;
};

const steps: Step[] = [
  {
    useCharlie: true,
    title: "Tell Charlie your vibe",
    desc: "Pick a mood, an era, or just say \"Surprise me.\"",
  },
  {
    icon: Music,
    title: "Get your dream setlist",
    desc: "Charlie pulls from every show the Dead ever played.",
  },
  {
    icon: Headphones,
    title: "Listen to every note",
    desc: "Every song links to real recordings from the Archive.",
  },
];

const HowItWorks = () => (
  <section className="py-16 sm:py-24 px-6 sm:px-12">
    <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-8">
      {steps.map((step, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 + i * 0.08, duration: 0.5, ease: "easeOut" }}
          className="flex flex-col items-center text-center gap-4"
        >
          {step.useCharlie ? (
            <CosmicCharlieAvatar size={48} animate glow />
          ) : (
            <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              {step.icon && <step.icon className="w-5 h-5 text-primary" />}
            </div>
          )}
          <h3 className="font-body text-lg sm:text-xl font-bold text-foreground">
            {step.title}
          </h3>
          <p className="font-body text-base sm:text-lg text-muted-foreground leading-relaxed max-w-[280px]">
            {step.desc}
          </p>
        </motion.div>
      ))}
    </div>
  </section>
);

export default HowItWorks;
