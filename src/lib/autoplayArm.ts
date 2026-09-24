/**
 * When a freshly built show should start playing on its own. Builder arms a
 * pending autoplay when a build starts, then re-asks this on every render
 * until it says something other than "wait".
 */
export interface PendingAutoplay {
  /** The setlist row being waited on; null for guest builds, which never persist. */
  setlistId: string | null;
  armedAt: number;
  /** How many songs the build is adding. */
  expectedSlots: number;
}

export type AutoplayDecision =
  | "wait" // not ready yet — ask again when the page changes
  | "lapse" // armed too long ago; drop it rather than ambush the user later
  | "play" // hand the whole show to the player
  | "skip"; // ready, but a tape is already rolling — leave it

export function decideAutoplay(
  pending: PendingAutoplay,
  now: {
    at: number;
    ttlMs: number;
    /** Charlie's skeleton is still up. */
    creating: boolean;
    slotCount: number;
    currentSetlistId: string | null;
    somethingPlaying: boolean;
  },
): AutoplayDecision {
  if (now.at - pending.armedAt > now.ttlMs) return "lapse";
  if (now.creating) return "wait";
  if (now.slotCount === 0) return "wait";
  // Signed-in flows navigate to the new setlist; wait for state to catch up.
  if (pending.setlistId && now.currentSetlistId !== pending.setlistId) return "wait";
  // Charlie inserts songs one row at a time and realtime adds each as it
  // lands. Dropping the needle on the first one or two handed the player that
  // partial list for good: "Song 1 of 2" on a fourteen-song show (2026-09-24).
  if (now.slotCount < pending.expectedSlots) return "wait";
  // Never talk over a tape that's already rolling.
  if (now.somethingPlaying) return "skip";
  return "play";
}
