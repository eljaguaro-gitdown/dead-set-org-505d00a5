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
 */
export const useOnlineVisitors = (enabled: boolean) => {
  const [visitors, setVisitors] = useState<OnlineVisitor[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase.channel("online_visitors_admin_listener");

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<OnlineVisitor>();
        const list: OnlineVisitor[] = [];
        for (const key of Object.keys(state)) {
          const presences = state[key];
          if (presences && presences.length > 0) {
            list.push(presences[0] as unknown as OnlineVisitor);
          }
        }
        setVisitors(list);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled]);

  return visitors;
};
