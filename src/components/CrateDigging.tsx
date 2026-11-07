import { useEffect, useState, useSyncExternalStore } from "react";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { useGlobalPlayerHeight } from "@/hooks/useGlobalPlayerHeight";
import { charlieArtFor } from "@/lib/charlieArt";
import { useClaimBottom } from "@/lib/bottomCardClaims";
import { shortShowDate } from "@/lib/playbackIssues";
import { subscribeTaps, tapAge, waitingTap, type Tap } from "@/lib/player/tapTelemetry";

/**
 * "We're going digging" — what the screen says between the tap and the sound.
 *
 * Reported from a phone: tap a night, nothing visibly happens, and if you are
 * quick you get an error saying the song was not found — over a tape that is
 * there and that starts playing a moment later. People read silence as broken
 * and leave. The 2026-11 playback sprint made this four times louder at the
 * owner's request, in two parts:
 *
 *   TapAck — at the finger, at once: a ring and a mini bear where the tap
 *   landed, the moment a tap begins. Nothing waits for a timer.
 *
 *   CrateDigging — a centered sheet near the tapped row from SHOW_AFTER_MS:
 *   marching bears 64×92, Charlie at 80px, the night in the display face.
 *   The copy escalates: "Finding {song} · {date}", then from 3 s "The
 *   Archive's taking its time — still digging". At 8 s the player hands off
 *   to Plan B (PlanBCard), and this gets out of the way.
 *
 * It keys on the WAITING TAP (tapTelemetry), not only on the player's slot,
 * so a wait that happens before the player is called — the version picker
 * looking a night up — is covered like one inside it.
 *
 * WHY IT LIVES AT THE ROOT: `PageLayout` wraps every page in `relative z-10`,
 * which opens a stacking context — anything mounted inside a page loses to the
 * player's root-level z-40 no matter what z-index it sets. So this is a
 * sibling of GlobalAudioPlayer in App.tsx, and it clears the player by
 * MEASURING it, not by assuming a number.
 */

/** Under the 300 ms acknowledgment target; the TapAck covers the first frame. */
export const SHOW_AFTER_MS = 250;
/** Past this, say the Archive is slow rather than repeat the song's name. */
export const ESCALATE_AFTER_MS = 3_000;
/** The sheet's height in layout, for keeping it clear of the player and the screen's edge. */
const SHEET_H = 230;

/** Where the last tap landed, for putting the answer next to it. */
let lastPointer: { x: number; y: number } | null = null;
if (typeof window !== "undefined") {
  try {
    window.addEventListener("pointerdown", (e) => {
      if (Number.isFinite(e.clientX) && Number.isFinite(e.clientY)) lastPointer = { x: e.clientX, y: e.clientY };
    }, true);
  } catch { /* no pointer events: the sheet centres */ }
}

/** Dancing bears: brand palette, in the order they march. */
const BEAR_COLORS = [
  "hsl(var(--dead-gold))",
  "hsl(var(--dead-rose))",
  "hsl(var(--dead-blue))",
];

const Bear = ({ color, delay, width = 64 }: { color: string; delay: number; width?: number }) => (
  <svg
    viewBox="0 0 24 34"
    width={width}
    height={Math.round((width * 34) / 24)}
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

/** The tap the screen should answer, re-read whenever taps change. */
const useWaitingTap = (): Tap | null =>
  useSyncExternalStore(subscribeTaps, waitingTap, () => null);

/** At the finger, at once. */
export const TapAck = () => {
  const tap = useWaitingTap();
  const [at, setAt] = useState<{ x: number; y: number; id: string } | null>(null);
  useEffect(() => {
    if (!tap || !lastPointer) { setAt(null); return; }
    // Only for a tap this pointer started, not one begun by an earlier one.
    if (tapAge(tap) > 600) return;
    setAt({ ...lastPointer, id: tap.id });
    const t = window.setTimeout(() => setAt(null), 1_400);
    return () => window.clearTimeout(t);
  }, [tap?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!at || !tap || tap.id !== at.id) return null;
  return (
    <div
      data-tap-ack
      aria-hidden="true"
      className="pointer-events-none fixed z-[60] -translate-x-1/2 -translate-y-1/2"
      style={{ left: at.x, top: at.y }}
    >
      <span className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dead-gold motion-safe:animate-ping" />
      <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-dead-gold shadow-lg">
        <Bear color="hsl(var(--dead-dark))" delay={0} width={18} />
      </span>
    </div>
  );
};

const CrateDigging = () => {
  const { playingSlot, transport, planB } = useAudioPlayer();
  const playerHeight = useGlobalPlayerHeight();
  const tap = useWaitingTap();
  const [visible, setVisible] = useState(false);
  const [slow, setSlow] = useState(false);

  // Three shapes of one wait: a tap still waiting (any surface), a single tap
  // whose slot has no track yet, and Play All hunting with no slot at all.
  const resolvingOne = !!playingSlot && !playingSlot.directTrackUrl;
  const digging = (!!tap || resolvingOne || !!transport.cueingTitle) && !transport.error && !planB;
  const title = tap?.title ?? playingSlot?.song.title ?? transport.cueingTitle ?? "";
  const date = shortShowDate(tap?.showDate ?? playingSlot?.version?.show_date ?? null);
  const waitKey = tap?.id ?? playingSlot?.id ?? transport.cueingTitle ?? "";

  useEffect(() => {
    setSlow(false);
    if (!digging) {
      setVisible(false);
      return;
    }
    const age = tap ? tapAge(tap) : 0;
    const show = window.setTimeout(() => setVisible(true), Math.max(0, SHOW_AFTER_MS - age));
    const esc = window.setTimeout(() => setSlow(true), Math.max(0, ESCALATE_AFTER_MS - age));
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(esc);
    };
  }, [digging, waitKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Under the install banner on a first visit, which is exactly when a new
  // visitor taps play and waits. See bottomCardClaims.
  useClaimBottom("crate-digging", visible && digging);

  if (!visible || !digging) return null;

  // Near the tapped row: below it when the tap was high on the screen, above
  // it when low — never over the player, never off the top.
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const ceiling = vh - playerHeight - 12 - SHEET_H;
  const y = lastPointer?.y;
  const top = Math.max(
    12,
    Math.min(ceiling, y === undefined ? (vh - SHEET_H) / 2 : y < vh * 0.55 ? y + 28 : y - SHEET_H - 28),
  );

  return (
    <div
      // polite, not assertive: this is reassurance, and it must not interrupt
      // whatever a screen-reader user is already being told.
      role="status"
      aria-live="polite"
      data-crate-digging
      className="fixed inset-x-0 z-50 flex justify-center px-4 pointer-events-none"
      style={{ top }}
    >
      <div className="pointer-events-auto w-full max-w-[520px] rounded-md border-2 border-border bg-card px-5 py-4 text-card-foreground shadow-2xl motion-safe:animate-scale-in">
        <div className="flex items-center gap-4">
          <img
            src={charlieArtFor(80)}
            alt=""
            width={80}
            height={80}
            className="h-20 w-20 shrink-0 rounded-full object-cover"
          />
          <div className="min-w-0 flex-1">
            {/* dead-dark, not primary: primary on the cream card measures
                4.09:1, under the 4.5:1 floor. Computed from index.css. */}
            <p className="font-ticket text-xs uppercase tracking-[0.14em] text-dead-dark">
              Digging through the crates
            </p>
            <p className="font-display text-2xl leading-tight text-card-foreground">
              {slow
                ? "The Archive's taking its time — still digging"
                : title
                  ? `Finding ${title}${date ? ` · ${date}` : ""}`
                  : "Finding that one"}
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-end justify-center gap-2" aria-hidden="true">
          {BEAR_COLORS.map((c, i) => (
            <Bear key={c} color={c} delay={i * 110} />
          ))}
        </div>
        <p className="mt-2 text-center font-ticket text-xs leading-relaxed text-muted-foreground">
          Pulling the tape off the Internet Archive. It'll start on its own.
        </p>
      </div>
    </div>
  );
};

export default CrateDigging;
