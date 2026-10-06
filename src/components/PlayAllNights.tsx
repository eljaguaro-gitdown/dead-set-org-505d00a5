import { Loader2, Play } from "lucide-react";
import type { PlayableSlot } from "@/contexts/AudioPlayerContext";

/**
 * The "Play all N nights" control, shared by both Songbook issue surfaces.
 *
 * It takes the QUEUE, not a count. That is the whole point: the curated page
 * used to count rows with a stored archive_org_url while ladderPlaylist
 * decided what actually plays, and the two disagreed badly — Shakedown Street
 * has 15 versions and one url, so the button offered one night above a ladder
 * of fifteen. A component that is handed the slots cannot be passed a number
 * that contradicts them, which is a guarantee no test can give about two
 * filters sitting in different files.
 *
 * It also renders nothing for an empty queue, so neither page needs its own
 * visibility gate — a third place for the same rule to drift.
 *
 * Above the lifespan block on purpose: the point of an issue is to get
 * somebody listening, and this used to sit at the foot of the page behind a
 * scroll. `aria-disabled` rather than `disabled` because Chromium moves focus
 * off an element that becomes disabled, dropping a keyboard or switch user to
 * <body> mid-cue; the handler's own guard is what actually refuses the tap.
 * The label keeps a constant width and only the 12px icon swaps — a busy state
 * that grows a control has pushed Share off a 320px screen here before.
 */
const PlayAllNights = ({
  slots,
  cueing,
  onPlay,
}: {
  slots: PlayableSlot[];
  cueing: boolean;
  onPlay: () => void;
}) => {
  if (slots.length === 0) return null;
  return (
    <button
      type="button"
      onClick={onPlay}
      aria-disabled={cueing}
      className="mt-5 inline-flex items-center gap-2.5 rounded-sm bg-dead-dark px-5 py-3 font-ticket text-xs uppercase tracking-[0.14em] text-dead-cream transition-opacity hover:opacity-90"
    >
      {cueing ? (
        <Loader2 className="w-3 h-3 animate-spin shrink-0" />
      ) : (
        <Play className="w-3 h-3 shrink-0" />
      )}
      Play all {slots.length} {slots.length === 1 ? "night" : "nights"}
    </button>
  );
};

export default PlayAllNights;
