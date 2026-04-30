import { useEffect, useState } from "react";
import {
  getPresenceChannel,
  getPresenceState,
  subscribeToSync,
  type PresencePayload,
} from "@/lib/presenceChannel";

/**
 * Returns a Set of currently online user IDs (auth'd users only).
 * Reads from the shared presence channel — does NOT track its own presence.
 */
export const useOnlineUserIds = (enabled: boolean) => {
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) return;

    // Ensure the shared channel exists (broadcaster usually creates it first,
    // but if a listener mounts earlier we still want it open).
    getPresenceChannel();

    const recompute = () => {
      const state = getPresenceState<PresencePayload>();
      const ids = new Set<string>();
      Object.values(state).forEach((presences) => {
        presences.forEach((p) => {
          if (p?.user_id) ids.add(p.user_id);
        });
      });
      setOnlineIds(ids);
    };

    return subscribeToSync(recompute);
  }, [enabled]);

  return onlineIds;
};
