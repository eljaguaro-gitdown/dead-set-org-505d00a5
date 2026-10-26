import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Play, X } from "lucide-react";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { useAuth } from "@/hooks/useAuth";
import { useGlobalPlayerHeight } from "@/hooks/useGlobalPlayerHeight";
import { captureEvent } from "@/lib/posthog";
import { useClaimBottom } from "@/lib/bottomCardClaims";
import { isNativeApp } from "@/lib/nativeApp";
import {
  NOTED_LINE,
  SIGNED_IN_PROMISE,
  SIGNED_OUT_PROMISE,
  knownGoodToSlot,
  oopsCopy,
  rememberPendingFollow,
  setPlaybackCredit,
  shortShowDate,
} from "@/lib/playbackIssues";

/**
 * "Oops, that's embarrassing." What a fan sees when a tap will not play for a
 * reason a fix can address: an apology, a tape we KNOW plays, and — once the
 * report has actually been filed — that it has been noted, with a promise to
 * say when it is fixed (signed in) or an invitation to sign in for that.
 *
 * Each sentence is only said once it is true. "It's been noted" waits for the
 * report to come back with an id; the suggestion appears only if a tape has
 * really played for someone recently. A card that promised either and could
 * not keep it would be worse than the dead tap it apologises for.
 *
 * Root-mounted beside CrateDigging for the same reason: PageLayout's
 * `relative z-10` would trap it under the player's z-40.
 */
const PlaybackOopsCard = () => {
  const { playbackOops: oops, dismissPlaybackOops, playSingle } = useAudioPlayer();
  const { user } = useAuth();
  const playerHeight = useGlobalPlayerHeight();
  const navigate = useNavigate();
  const location = useLocation();
  const [credit, setCredit] = useState(false);
  const [creditFailed, setCreditFailed] = useState(false);
  useClaimBottom("playback-oops", !!oops);

  // A new failure starts unticked: credit is asked for each time, never assumed.
  useEffect(() => {
    setCredit(false);
    setCreditFailed(false);
    if (oops) captureEvent("playback_oops_shown", { kind: oops.kind, signed_in: !!user });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oops?.key]);

  if (!oops) return null;

  const { headline, detail } = oopsCopy(oops);
  const noted = typeof oops.issueId === "string";
  const suggestion = oops.suggestion ?? null;

  const toggleCredit = async (next: boolean) => {
    if (!oops.issueId) return;
    setCredit(next);
    setCreditFailed(false);
    const ok = await setPlaybackCredit(oops.issueId, next);
    if (!ok) {
      setCredit(!next);
      setCreditFailed(true);
    } else {
      captureEvent("playback_oops_credit", { credit: next });
    }
  };

  const signIn = () => {
    if (oops.issueId) rememberPendingFollow(oops.issueId);
    captureEvent("playback_oops_sign_in");
    dismissPlaybackOops();
    navigate(`/auth?redirect=${encodeURIComponent(location.pathname + location.search)}`);
  };

  const playSuggestion = () => {
    if (!suggestion) return;
    captureEvent("playback_oops_suggestion_played", { same_song: suggestion.songId === oops.songId });
    void playSingle(knownGoodToSlot(suggestion));
  };

  return (
    <div
      role="alert"
      data-playback-oops
      className="fixed inset-x-0 z-50 flex justify-center px-4 pointer-events-none"
      style={{ bottom: playerHeight + 12 }}
    >
      <div className="pointer-events-auto relative w-full max-w-[420px] rounded-sm border border-border bg-card px-4 py-3 pr-10 text-card-foreground shadow-xl motion-safe:animate-scale-in">
        <button
          type="button"
          onClick={dismissPlaybackOops}
          aria-label="Dismiss"
          className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-sm text-card-foreground hover:bg-muted/60"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* dead-dark, not primary or gold: both fail 4.5:1 on the cream card. */}
        <p className="font-ticket text-[10px] uppercase tracking-[0.14em] text-dead-dark">
          Well, that's embarrassing
        </p>
        <p className="font-body text-sm font-semibold leading-snug text-card-foreground">{headline}</p>
        <p className="font-body text-sm leading-snug text-card-foreground">{detail}</p>

        {noted && (
          <div className="mt-2 space-y-1.5">
            <p className="font-body text-sm leading-snug text-card-foreground">{NOTED_LINE}</p>
            {user ? (
              <>
                <p className="font-body text-sm leading-snug text-card-foreground">{SIGNED_IN_PROMISE}</p>
                {/* Web only: the iOS app shows no credits (App Review 1.2; see
                    CommunityFixesList), so it must not ask for one either. */}
                {!isNativeApp() && (
                <label className="flex min-h-[36px] cursor-pointer items-center gap-2 font-body text-sm text-card-foreground">
                  <input
                    type="checkbox"
                    checked={credit}
                    onChange={(e) => void toggleCredit(e.target.checked)}
                    className="h-4 w-4 shrink-0 accent-[hsl(var(--dead-dark))]"
                  />
                  Credit me by name on Build Notes when it is
                </label>
                )}
                {creditFailed && (
                  <p className="font-ticket text-[11px] text-card-foreground">
                    Couldn't save that just now. Try the box again.
                  </p>
                )}
              </>
            ) : (
              <p className="font-body text-sm leading-snug text-card-foreground">
                <button
                  type="button"
                  onClick={signIn}
                  className="font-semibold underline underline-offset-2 hover:no-underline"
                >
                  Sign in
                </button>{" "}
                {SIGNED_OUT_PROMISE.replace(/^Sign in /, "")}
              </p>
            )}
          </div>
        )}

        {suggestion && (
          <div className="mt-3 border-t border-border pt-2.5">
            <p className="font-ticket text-[11px] uppercase tracking-[0.1em] text-card-foreground">
              One we know plays
            </p>
            {/* Gold as a fill with dark ink: 5.30:1, where gold text on the
                cream card is 2.58:1 (CLAUDE.md). */}
            <button
              type="button"
              onClick={playSuggestion}
              className="mt-1 flex min-h-[40px] w-full items-center gap-2 rounded-sm bg-dead-gold px-3 py-2 text-left font-body text-sm font-semibold text-dead-dark hover:brightness-105"
            >
              <Play className="h-4 w-4 shrink-0 fill-current" aria-hidden="true" />
              <span className="min-w-0 truncate">
                {suggestion.songTitle}
                {shortShowDate(suggestion.showDate) ? ` · ${shortShowDate(suggestion.showDate)}` : ""}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlaybackOopsCard;
