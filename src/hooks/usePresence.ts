import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Broadcasts the current visitor's presence on a shared Realtime channel.
 * This runs on every page — lightweight heartbeat so admins can see who's online.
 */
export const usePresence = () => {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const visitorId = localStorage.getItem("ds_visitor_id") || crypto.randomUUID();
    if (!localStorage.getItem("ds_visitor_id")) {
      localStorage.setItem("ds_visitor_id", visitorId);
    }

    const init = async () => {
      let displayName: string | null = null;
      let avatarUrl: string | null = null;

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, avatar_url")
          .eq("user_id", user.id)
          .maybeSingle();
        displayName = profile?.display_name || user.email?.split("@")[0] || null;
        avatarUrl = profile?.avatar_url || null;
      }

      const presenceState = {
        visitor_id: visitorId,
        user_id: user?.id || null,
        display_name: displayName,
        avatar_url: avatarUrl,
        page: window.location.pathname,
        joined_at: new Date().toISOString(),
      };

      const channel = supabase.channel("online_visitors", {
        config: { presence: { key: visitorId } },
      });

      channel
        .on("presence", { event: "sync" }, () => {
          // Admin hook will read this
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel.track(presenceState);
          }
        });

      channelRef.current = channel;

      // Update page path on navigation
      const updatePage = () => {
        channel.track({ ...presenceState, page: window.location.pathname });
      };
      window.addEventListener("popstate", updatePage);

      return () => {
        window.removeEventListener("popstate", updatePage);
      };
    };

    const cleanupPromise = init();

    return () => {
      cleanupPromise.then((cleanup) => cleanup?.());
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [user]);
};
