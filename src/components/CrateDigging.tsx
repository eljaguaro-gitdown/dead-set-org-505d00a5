import { useEffect, useState } from "react";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { useGlobalPlayerHeight } from "@/hooks/useGlobalPlayerHeight";
import { charlieArtFor } from "@/lib/charlieArt";

/**
 * "We're going digging" — what the screen says between the tap and the sound.
 *
 * Reported from a phone: tap a night, nothing visibly happens, and if you are
 * quick you get an error saying the song was not found — over a tape that is
 * there and that starts playing a moment later. The only feedback today is a
 * 20px spinner inside the play button of the bottom bar, which on a long
 * Songbook page is both tiny and nowhere near where the tap happened. People
 * move fast, read the silence as broken, and leave.
 *
 * Resolving a night means asking the Internet Archive for the recording and
 * then for the track inside it. On good signal that is a few hundred
 * milliseconds; on hotel wifi it is seconds, and each fetch is capped at 12s
 * with a retry behind it. We cannot make the Archive fast. We can stop
 * pretending nothing is happening.
 *
 * WHY A DELAY: a fast resolve must not flash this. 450ms is past the typical
 * good-signal resolve (~440ms tap-to-sound, measured 2026-10-05) so a snappy
 * tap shows nothing at all, and a slow one gets an answer almost immediately.
 *
 * WHY IT LIVES AT THE ROOT: `PageLayout` wraps every page in `relative z-10`,
 * which opens a stacking context — anything mounted inside a page loses to the
 * player's root-level z-40 no matter what z-index it sets. So this is a
 * sibling of GlobalAudioPlayer in App.tsx, and it clears the player by
 * MEASURING it (the bar is drag-resizable and has two implementations of
 * different heights), not by assuming a number.
 */

/** Past a good-signal resolve, so a fast tap never sees this. */
const SHOW_AFTER_MS = 450;

/** Dancing bears: brand palette, in the order they march. */
const BEAR_COLORS = [
  "hsl(var(--dead-gold))",
  "hsl(var(--dead-rose))",
  "hsl(var(--dead-blue))",
];

const Bear = ({ color, delay }: { color: string; delay: number }) => (
  <svg
    viewBox="0 0 24 34"
    width="16"
    height="23"
    fill={color}
    aria-hidden="true"
    className="shrink-0 origin-bottom motion-safe:animate-[bear-step_0.9s_ease-in-out_infinite] motion-reduce:animate-none"
    style={{ animationDelay: `${delay}ms` }}
  >
    <circle cx="6.4" cy="6" r="3.3" />
    <circle cx="17.6" cy="6" r="3.3" />
    <circle cx="12" cy="8.6" r="5.9" />
    <rect x="5.5" y="14" width="13" height="13" rx="6.5" />
    <rect x="1.4" y="15" width="4.4" height="9" rx="2.2" />
    <rect x="18.2" y="15" width="4.4" height="9" rx="2.2" />
    <rect x="6" y="26" width="5" height="7.5" rx="2.5" />
    <rect x="13" y="26" width="5" height="7.5" rx="2.5" />
  </svg>
);

const CrateDigging = () => {
  const { playingSlot, transport } = useAudioPlayer();
  const playerHeight = useGlobalPlayerHeight();
  const [visible, setVisible] = useState(false);

  /**
   * The window with no feedback: a slot is on screen as "playing" but has no
   * track behind it yet. `transport.error` ends it — once there is something
   * to say, the bar says it and this gets out of the way.
   */
  const digging = !!playingSlot && !playingSlot.directTrackUrl && !transport.error;
  const title = playingSlot?.song.title ?? "";

  useEffect(() => {
    if (!digging) {
      setVisible(false);
      return;
    }
    const t = window.setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    return () => window.clearTimeout(t);
  }, [digging, playingSlot?.id]);

  if (!visible || !digging) return null;

  return (
    <div
      // polite, not assertive: this is reassurance, and it must not interrupt
      // whatever a screen-reader user is already being told.
      role="status"
      aria-live="polite"
      data-crate-digging
      className="fixed inset-x-0 z-50 flex justify-center px-4 pointer-events-none"
      style={{ bottom: playerHeight + 12 }}
    >
      <div className="pointer-events-auto flex w-full max-w-[420px] items-center gap-3 rounded-sm border border-border bg-card px-4 py-3 text-card-foreground shadow-xl motion-safe:animate-scale-in">
        <img
          src={charlieArtFor(40)}
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 shrink-0 rounded-full object-cover"
        />
        <div className="min-w-0 flex-1">
          {/* dead-dark, not primary: primary on the cream card measures
              4.09:1, under the 4.5:1 floor for text this size. Computed from
              index.css, not eyeballed. The play comes from the bears. */}
          <p className="font-ticket text-[10px] uppercase tracking-[0.14em] text-dead-dark">
            Digging through the crates
          </p>
          <p className="font-body text-sm leading-snug text-card-foreground truncate">
            {title ? `Finding ${title}` : "Finding that one"}
          </p>
          <p className="font-ticket text-[11px] leading-relaxed text-muted-foreground">
            Pulling the tape off the Internet Archive. It'll start on its own.
          </p>
        </div>
        {/* Decorative, so the narrowest phone gives their room to the words:
            at 320 the eyebrow wrapped and the card grew to 150px. */}
        <div className="hidden min-[360px]:flex shrink-0 items-end gap-0.5" aria-hidden="true">
          {BEAR_COLORS.map((c, i) => (
            <Bear key={c} color={c} delay={i * 110} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default CrateDigging;
