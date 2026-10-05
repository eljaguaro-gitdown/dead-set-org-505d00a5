import { useEffect, useState } from "react";
import CharlieMark from "@/components/CharlieMark";

/**
 * What the screen does while a setlist is being cued up.
 *
 * Pressing Play All used to change nothing on screen. Resolving a guide means
 * asking the Archive for each night in turn — a search plus a walk through
 * that night's recordings looking for the song — and on a phone that is
 * seconds, not milliseconds. Reported 2026-10-05: "I hit play all. Nothing.
 * Hit it again. Nothing."
 *
 * The second tap was the worse half. playSetlist bumps a sequence number and
 * abandons any run whose number is stale, so tapping again threw away the
 * work already done and started the wait over. Silence taught the exact
 * behaviour that made the silence longer.
 *
 * So this is not decoration. It is the answer to "did that work?" — and the
 * button it sits beside is disabled while it shows, which is what actually
 * stops the second tap.
 *
 * Charlie does not spin. CharlieMark's own note says a rotating portrait reads
 * as a mistake; a rotating REEL reads as a tape being found, which is what is
 * happening. He breathes, the reel turns, and the line underneath says what he
 * is doing in the only vocabulary this app uses for it.
 */

/**
 * Said in taper's terms, because that is what is literally happening: a tape
 * is being located and cued. Nothing here describes machinery.
 */
const LINES = [
  "Charlie's digging through the crates…",
  "Finding the tape…",
  "Threading the reel…",
  "Cueing it up…",
];

/** Long enough to read, short enough that it never feels stuck. */
const LINE_MS = 2200;

const TapeHunt = ({ className = "" }: { className?: string }) => {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % LINES.length), LINE_MS);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className={`flex items-center gap-2.5 ${className}`}
      // One live region, so a screen reader hears the line change rather than
      // the whole row being re-announced.
      role="status"
      aria-live="polite"
    >
      <span className="relative inline-flex items-center justify-center shrink-0" style={{ width: 28, height: 28 }}>
        {/* The reel: it turns, because a tape really is being found. */}
        <span className="ds-tapehunt__reel absolute inset-0 rounded-full border-2 border-dead-gold/35 border-t-dead-gold" />
        <span className="ds-tapehunt__charlie">
          <CharlieMark size={18} />
        </span>
      </span>

      <span className="font-ticket text-[11px] uppercase tracking-[0.1em] text-foreground/85">
        {LINES[i]}
      </span>

      <style>{`
        .ds-tapehunt__reel { animation: ds-tapehunt-spin 1.5s linear infinite; }
        @keyframes ds-tapehunt-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        /* Charlie breathes — he never rotates. See CharlieMark. */
        .ds-tapehunt__charlie { animation: ds-tapehunt-breathe 3.4s ease-in-out infinite; display: inline-flex; }
        @keyframes ds-tapehunt-breathe {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.08); }
        }
        @media (prefers-reduced-motion: reduce) {
          /* The reel still marks time, slowly, because this element's whole
             job is to say work is happening. Charlie holds still. */
          .ds-tapehunt__reel { animation-duration: 4s; }
          .ds-tapehunt__charlie { animation: none; }
        }
      `}</style>
    </div>
  );
};

export default TapeHunt;
