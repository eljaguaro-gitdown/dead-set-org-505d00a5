import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play } from "lucide-react";
import { useAudioPlayer, type PlayableSlot } from "@/contexts/AudioPlayerContext";
import { useAuth } from "@/hooks/useAuth";
import { useGlobalPlayerHeight } from "@/hooks/useGlobalPlayerHeight";
import { captureEvent } from "@/lib/posthog";
import { useClaimBottom } from "@/lib/bottomCardClaims";
import { SYNTHETIC_VERSION_DEFAULTS } from "@/lib/syntheticVersion";
import {
  claimPendingFollows,
  fetchMyFixedTapes,
  markFixedTapeSeen,
  shortShowDate,
  type FixedTape,
} from "@/lib/playbackIssues";

/**
 * The other half of the oops card's promise: "we'll let you know as soon as
 * it's fixed." The email goes out from the database the moment a fix is
 * verified; this is the in-app copy, shown the next time the fan is here, so
 * the promise is kept even when the mail lands in a promotions tab.
 *
 * It also attaches reports the fan filed while signed out and then signed in
 * for ("Sign in and we'll let you know"), before asking what has been fixed.
 */
const FixedTapeNotice = () => {
  const { user } = useAuth();
  const { playSingle, playbackOops } = useAudioPlayer();
  const playerHeight = useGlobalPlayerHeight();
  const navigate = useNavigate();
  const [fixed, setFixed] = useState<FixedTape[]>([]);

  useEffect(() => {
    if (!user) {
      setFixed([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      await claimPendingFollows();
      const list = await fetchMyFixedTapes();
      if (!cancelled) setFixed(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = fixed[0];
  // One card at a time: a fresh dead tap outranks old good news.
  const visible = !!user && !!current && !playbackOops;
  useClaimBottom("fixed-tape", visible);
  if (!visible) return null;

  const done = () => {
    void markFixedTapeSeen(current.issueId);
    setFixed((prev) => prev.slice(1));
  };

  const spin = () => {
    captureEvent("playback_fixed_spin");
    done();
    if (current.songId && current.showDate) {
      // Resolved by night through the normal path — the one the fix repaired.
      const slot: PlayableSlot = {
        id: `fixed-${current.issueId}`,
        song: { id: current.songId, title: current.songTitle },
        version: {
          ...SYNTHETIC_VERSION_DEFAULTS,
          id: `fixed-${current.issueId}`,
          song_id: current.songId,
          show_date: current.showDate,
        },
        setNumber: 1,
        position: 0,
        segueToNext: false,
        directTrackUrl: null,
      };
      void playSingle(slot);
    } else if (current.songId) {
      navigate(`/song/${current.songId}`);
    }
  };

  const date = shortShowDate(current.showDate);

  return (
    <div
      role="status"
      aria-live="polite"
      data-fixed-tape-notice
      className="fixed inset-x-0 z-50 flex justify-center px-4 pointer-events-none"
      style={{ bottom: playerHeight + 12 }}
    >
      <div className="pointer-events-auto w-full max-w-[420px] rounded-sm border border-border bg-card px-4 py-3 text-card-foreground shadow-xl motion-safe:animate-scale-in">
        <p className="font-ticket text-[10px] uppercase tracking-[0.14em] text-dead-dark">Hey Now · it's fixed</p>
        <p className="font-body text-sm font-semibold leading-snug text-card-foreground">
          {current.songTitle}
          {date ? ` · ${date}` : ""} plays again.
        </p>
        <p className="font-body text-sm leading-snug text-card-foreground">
          You flagged it, we fixed it, and it's been checked. Thanks for making this better.
          {current.creditOk ? " Your name's on Build Notes." : ""}
        </p>
        <div className="mt-2.5 flex items-center gap-2">
          {current.songId && (
            <button
              type="button"
              onClick={spin}
              className="flex min-h-[40px] items-center gap-2 rounded-sm bg-dead-gold px-3 py-2 font-body text-sm font-semibold text-dead-dark hover:brightness-105"
            >
              <Play className="h-4 w-4 fill-current" aria-hidden="true" />
              Spin it
            </button>
          )}
          <button
            type="button"
            onClick={done}
            className="min-h-[40px] rounded-sm px-3 font-body text-sm text-card-foreground hover:bg-muted/60"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

export default FixedTapeNotice;
