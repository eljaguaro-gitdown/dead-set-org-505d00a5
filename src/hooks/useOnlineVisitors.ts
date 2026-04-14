import { useEffect, useState, useRef, useCallback } from "react";
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
 * Listens to sync, join, and leave events for maximum responsiveness.
 */
export const useOnlineVisitors = (enabled: boolean) => {
  const [visitors, setVisitors] = useState<OnlineVisitor[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const listenerIdRef = useRef<string>("");

  const syncState = useCallback(() => {
    const channel = channelRef.current;
    const listenerId = listenerIdRef.current;
    if (!channel) return;

    const state = channel.presenceState<OnlineVisitor>();
    const list: OnlineVisitor[] = [];
    for (const key of Object.keys(state)) {
      if (key === listenerId) continue;
      const presences = state[key];
      if (presences && presences.length > 0) {
        const p = presences[0] as unknown as OnlineVisitor;
        // Skip bare listener entries (from other admin tabs)
        if ((p as any)._listener && !p.visitor_id) continue;
        list.push(p);
      }
    }
    setVisitors(list);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const listenerId = `admin_${Math.random().toString(36).slice(2)}`;
    listenerIdRef.current = listenerId;

    const channel = supabase.channel("online_visitors", {
      config: { presence: { key: listenerId } },
    });

    channel
      .on("presence", { event: "sync" }, syncState)
      .on("presence", { event: "join" }, syncState)
      .on("presence", { event: "leave" }, syncState)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ _listener: true });
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [enabled, syncState]);

  return visitors;
};
