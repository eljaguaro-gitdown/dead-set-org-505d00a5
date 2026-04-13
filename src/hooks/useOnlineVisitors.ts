import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface OnlineVisitor {
  visitor_id: string;
  user_id: string | null;
  display_name: string | null;
  avatar_url: string | null;
  page: string;
  joined_at: string;
}

/**
 * Admin-only hook: subscribes to the presence channel and returns
 * a live list of everyone currently on the site.
 *
 * Uses a unique channel name so it doesn't collide with the broadcaster's
 * channel instance on the same client, but joins the same presence topic
 * by tracking an empty state to trigger the initial sync.
 */
export const useOnlineVisitors = (enabled: boolean) => {
  const [visitors, setVisitors] = useState<OnlineVisitor[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const listenerId = `admin_${Math.random().toString(36).slice(2)}`;

    const channel = supabase.channel("online_visitors", {
      config: { presence: { key: listenerId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<OnlineVisitor>();
        const list: OnlineVisitor[] = [];
        for (const key of Object.keys(state)) {
          // Skip our own listener entry
          if (key === listenerId) continue;
          const presences = state[key];
          if (presences && presences.length > 0) {
            list.push(presences[0] as unknown as OnlineVisitor);
          }
        }
        setVisitors(list);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          // Track minimal presence so the server sends us the initial sync
          await channel.track({ _listener: true });
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled]);

  return visitors;
};
