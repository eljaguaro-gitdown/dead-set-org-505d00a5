import { useEffect, useState } from "react";
import {
  getPresenceChannel,
  getPresenceState,
  subscribeToSync,
  type PresencePayload,
} from "@/lib/presenceChannel";

export interface OnlineVisitor {
  visitor_id: string;
  user_id: string | null;
  display_name: string | null;
  avatar_url: string | null;
  page: string;
  joined_at: string;
}

const isBetterPresence = (next: OnlineVisitor, current?: OnlineVisitor) => {
  if (!current) return true;
  if (next.user_id && !current.user_id) return true;
  if (next.display_name && !current.display_name) return true;
  return new Date(next.joined_at).getTime() < new Date(current.joined_at).getTime();
};

/**
 * Admin-only: returns a live list of every visitor on the site.
 * Reads from the shared presence channel — does NOT track its own presence
 * (the broadcaster handles that for everyone, including the admin).
 */
export const useOnlineVisitors = (enabled: boolean) => {
  const [visitors, setVisitors] = useState<OnlineVisitor[]>([]);

  useEffect(() => {
    if (!enabled) return;

    getPresenceChannel();

    const recompute = () => {
      const state = getPresenceState<PresencePayload>();
      const byKey = new Map<string, OnlineVisitor>();

      Object.values(state).forEach((presences) => {
        presences.forEach((presence) => {
          const v = presence as unknown as OnlineVisitor;
          if (!v?.visitor_id) return;
          const dedupeKey = v.user_id || v.visitor_id;
          const current = byKey.get(dedupeKey);
          if (isBetterPresence(v, current)) {
            byKey.set(dedupeKey, v);
          }
        });
      });

      setVisitors(
        Array.from(byKey.values()).sort(
          (a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime(),
        ),
      );
    };

    return subscribeToSync(recompute);
  }, [enabled]);

  return visitors;
};
