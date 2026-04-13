import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribes to the presence channel and returns a Set of currently online user IDs.
 * Lightweight alternative to useOnlineVisitors for non-admin use cases.
 */
export const useOnlineUserIds = (enabled: boolean) => {
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) return;

    const listenerId = `ids_${Math.random().toString(36).slice(2)}`;

    const channel = supabase.channel("online_visitors", {
      config: { presence: { key: listenerId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const ids = new Set<string>();
        for (const key of Object.keys(state)) {
          if (key === listenerId) continue;
          const presences = state[key] as any[];
          if (presences?.[0]?.user_id) {
            ids.add(presences[0].user_id);
          }
        }
        setOnlineIds(ids);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ _listener: true });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled]);

  return onlineIds;
};
