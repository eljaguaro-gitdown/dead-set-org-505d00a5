import { useEffect, useState } from "react";
import {
  getPresenceChannel,
  getPresenceState,
  subscribeToSync,
  type PresencePayload,
} from "@/lib/presenceChannel";
import { summarizePresence, type MergedVisitor } from "@/lib/presenceSummary";

export type OnlineVisitor = MergedVisitor;

/**
 * Admin-only: returns a live list of the people on the site.
 * Reads from the shared presence channel — does NOT track its own presence
 * (the broadcaster handles that for everyone, including the admin).
 *
 * Entries whose heartbeat has stopped are left out, a device's tabs count
 * once (signed in if any of them is), and a user on two devices counts once.
 * See src/lib/presenceSummary.ts.
 */
export const useOnlineVisitors = (enabled: boolean) => {
  const [visitors, setVisitors] = useState<OnlineVisitor[]>([]);

  useEffect(() => {
    if (!enabled) return;

    getPresenceChannel();

    const recompute = () => {
      const state = getPresenceState<PresencePayload>();
      setVisitors(summarizePresence(state).visitors);
    };

    const unsub = subscribeToSync(recompute);
    // Ghosts age out on the clock, not on a channel event, so look again.
    const id = setInterval(recompute, 15_000);
    return () => {
      unsub();
      clearInterval(id);
    };
  }, [enabled]);

  return visitors;
};
