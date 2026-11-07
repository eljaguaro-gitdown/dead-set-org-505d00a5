import { useSyncExternalStore } from "react";
import { peekNight, subscribeNights } from "@/lib/tapeIndex";

/**
 * Said BEFORE the tap, for a night the tape index knows no circulating tape
 * carries the song (a guide that named a night the band did not play it, a
 * night nobody taped). The tap still works — it goes straight to Plan B — but
 * the fan is not promised that night first. Renders nothing until the index
 * has answered, and nothing for a night with a tape.
 */
const NoTapeNote = ({ songId, showDate, className = "" }: { songId: string | null | undefined; showDate: string | null | undefined; className?: string }) => {
  const answer = useSyncExternalStore(subscribeNights, () => peekNight(songId, showDate), () => null);
  if (answer !== "none") return null;
  return (
    <span data-no-tape className={`block font-ticket text-[11px] uppercase tracking-[0.1em] text-card-foreground/80 ${className}`}>
      No tape of it from this night
    </span>
  );
};

export default NoTapeNote;
