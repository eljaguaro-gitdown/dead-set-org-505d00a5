import { useEffect, useRef } from "react";
import { Radio, Mic, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import type { DjSpeaker } from "@/lib/djIntro";

/**
 * The "warming up the tape" → "on the air" overlay for the DJ Cosmic
 * Charlie & Cherise intro. Mounted globally; renders nothing when no
 * pre-roll is active. See docs/features/dj-cosmic-charlie.md §11.
 *
 * Content copy honors the community-steward playbook's no-mechanism-talk
 * rule — no words like "loading," "generating," "audio," or "AI" appear.
 * The user reads "Charlie's cueing up the show" and hears radio.
 */
const DjIntroOverlay = () => {
  const { preRoll, skipPreRoll } = useAudioPlayer();
  const skipButtonRef = useRef<HTMLButtonElement>(null);

  // Keyboard escape hatch: Esc key skips the intro (accessibility).
  useEffect(() => {
    if (!preRoll) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        skipPreRoll();
      }
    };
    window.addEventListener("keydown", onKey);
    // Autofocus skip so screen readers announce it and heads-down users can
    // hit Enter to escape without hunting for a target.
    skipButtonRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [preRoll, skipPreRoll]);

  if (!preRoll) return null;

  const { status, lines, currentLineIndex } = preRoll;
  // The active speaker for the current beat — during 'signoff', both mics
  // pulse together because the closing "Discover" is a duet.
  const currentSpeaker: DjSpeaker | null =
    status === "signoff"
      ? "both"
      : status === "playing"
        ? lines[currentLineIndex]?.speaker ?? null
        : null;

  const charlieActive = currentSpeaker === "charlie" || currentSpeaker === "both";
  const cheriseActive = currentSpeaker === "cherise" || currentSpeaker === "both";

  const eyebrow =
    status === "warming" ? "Warming Up" : status === "signoff" ? "Signoff" : "On The Mic";

  // Headline — never says "loading," never mentions mechanism.
  const headline =
    status === "warming"
      ? "Charlie's cueing up the show..."
      : status === "signoff"
        ? "Wake. Now. Discover."
        : "Charlie & Cherise on the mic";

  // Sub-text — during warming, a bit of flavor so the wait feels intentional.
  const subText =
    status === "warming"
      ? "Cherise is grabbing her coffee."
      : status === "playing"
        ? "Setlist coming up next."
        : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cosmic Charlie and Cherise show intro"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-6 sm:p-8 text-center space-y-6 shadow-2xl">
        {/* Eyebrow — "ON THE MIC" style radio-callout */}
        <div className="flex items-center justify-center gap-2 text-primary">
          <Radio className="w-4 h-4" />
          <span className="font-mono text-[10px] tracking-[0.24em] uppercase">{eyebrow}</span>
        </div>

        {/* Two speaker plates — active one pulses */}
        <div className="flex items-start justify-center gap-6 sm:gap-10">
          <SpeakerPlate name="Cosmic Charlie" active={charlieActive} />
          <SpeakerPlate name="Cherise" active={cheriseActive} />
        </div>

        {/* Headline + subtext */}
        <div aria-live="polite" className="space-y-2">
          <p
            className={`font-display leading-tight ${
              status === "signoff"
                ? "text-2xl sm:text-3xl italic text-primary"
                : "text-xl sm:text-2xl text-foreground"
            }`}
          >
            {headline}
          </p>
          {subText && (
            <p className="font-body text-sm text-muted-foreground">{subText}</p>
          )}
        </div>

        {/* Waveform pulse — visual heartbeat for the whole overlay */}
        <div
          className="flex items-end justify-center gap-1 h-8"
          aria-hidden="true"
        >
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="w-1.5 bg-primary rounded-full animate-eq"
              style={{
                animationDelay: `${i * 0.1}s`,
                minHeight: "4px",
              }}
            />
          ))}
        </div>

        {/* Skip — always visible, always the escape hatch */}
        <div className="pt-2">
          <Button
            ref={skipButtonRef}
            variant="outline"
            onClick={skipPreRoll}
            className="gap-2 border-primary/40 text-foreground hover:bg-primary/10"
          >
            <SkipForward className="w-4 h-4" />
            Skip → Start Set 1
          </Button>
        </div>
      </div>
    </div>
  );
};

/**
 * A single character's plate — mic icon + name. The active speaker pulses
 * (soft glow + bar-fill inside the mic). The inactive one is dimmed.
 */
const SpeakerPlate = ({ name, active }: { name: string; active: boolean }) => (
  <div className="flex flex-col items-center gap-2">
    <div
      className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all duration-200 ${
        active
          ? "bg-primary/20 border-2 border-primary shadow-[0_0_24px_hsl(var(--primary)/0.4)] animate-pulse"
          : "bg-muted/40 border border-border/50 opacity-40"
      }`}
    >
      <Mic
        className={`w-6 h-6 sm:w-7 sm:h-7 ${
          active ? "text-primary" : "text-muted-foreground"
        }`}
      />
    </div>
    <span
      className={`font-mono text-[10px] tracking-[0.15em] uppercase ${
        active ? "text-primary" : "text-muted-foreground/70"
      }`}
    >
      {name}
    </span>
  </div>
);

export default DjIntroOverlay;
