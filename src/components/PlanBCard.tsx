import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { useGlobalPlayerHeight } from "@/hooks/useGlobalPlayerHeight";
import { useClaimBottom } from "@/lib/bottomCardClaims";
import { planBCopy } from "@/lib/player/planB";
import { shortShowDate } from "@/lib/playbackIssues";
import { charlieArtFor } from "@/lib/charlieArt";

/**
 * "Here's a sure thing." What the screen says when Plan B is playing: the
 * tapped night could not make a sound, so a version of the same song we
 * know plays has started instead. It says so plainly — which night failed,
 * which night this is — because playing a different night without a word
 * would put the music and the page on different shows.
 *
 * Root-mounted like PlaybackOopsCard (PageLayout's stacking context would
 * bury it), clears the player by measuring it, and holds the bottom so the
 * install banner yields. Gone on any tap, on leaving the page, or on X.
 */
const PlanBCard = () => {
  const { planB, dismissPlanB } = useAudioPlayer();
  const playerHeight = useGlobalPlayerHeight();
  const location = useLocation();
  useClaimBottom("plan-b", !!planB);

  const pathRef = useRef(location.pathname);
  useEffect(() => {
    if (pathRef.current === location.pathname) return;
    pathRef.current = location.pathname;
    dismissPlanB();
  }, [location.pathname, dismissPlanB]);

  if (!planB) return null;
  const { headline, detail } = planBCopy(planB.reason, shortShowDate(planB.sureDate), shortShowDate(planB.failedDate));

  return (
    <div
      role="status"
      aria-live="polite"
      data-plan-b
      className="fixed inset-x-0 z-50 flex justify-center px-4 pointer-events-none"
      style={{ bottom: playerHeight + 12 }}
    >
      <div className="pointer-events-auto relative flex w-full max-w-[440px] items-center gap-3 rounded-sm border border-border bg-card px-4 py-3 pr-10 text-card-foreground shadow-xl motion-safe:animate-scale-in">
        <button
          type="button"
          onClick={dismissPlanB}
          aria-label="Dismiss"
          className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-sm text-card-foreground hover:bg-muted/60"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        <img src={charlieArtFor(48)} alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-full object-cover" />
        <div className="min-w-0">
          {/* dead-dark on the cream card: primary and gold both fail 4.5:1 here. */}
          <p className="font-ticket text-[10px] uppercase tracking-[0.14em] text-dead-dark">{planB.songTitle}</p>
          <p className="font-body text-sm font-semibold leading-snug text-card-foreground">{headline}</p>
          <p className="font-body text-sm leading-snug text-card-foreground">{detail}</p>
        </div>
      </div>
    </div>
  );
};

export default PlanBCard;
