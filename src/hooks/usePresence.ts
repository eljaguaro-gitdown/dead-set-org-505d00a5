import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const HEARTBEAT_INTERVAL = 30_000; // 30s heartbeat to keep presence fresh

/**
 * Broadcasts the current visitor's presence on a shared Realtime channel.
 * This runs on every page — lightweight heartbeat so admins can see who's online.
 */
export const usePresence = () => {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const presenceRef = useRef<Record<string, unknown> | null>(null);
  const { user, loading } = useAuth();
  const location = useLocation();

  // Initialize channel once when user changes — wait until auth has resolved
  // so we don't broadcast an anonymous presence before the session hydrates.
  useEffect(() => {
    if (loading) return;
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

      presenceRef.current = presenceState;

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

      // Heartbeat: re-track periodically so stale entries don't linger
      const heartbeat = setInterval(() => {
        if (channelRef.current && presenceRef.current) {
          channelRef.current.track({
            ...presenceRef.current,
            page: window.location.pathname,
          });
        }
      }, HEARTBEAT_INTERVAL);

      return () => {
        clearInterval(heartbeat);
      };
    };

    const cleanupPromise = init();

    return () => {
      cleanupPromise.then((cleanup) => cleanup?.());
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      presenceRef.current = null;
    };
  }, [user]);

  // Update page on every React Router navigation
  useEffect(() => {
    if (channelRef.current && presenceRef.current) {
      const updated = { ...presenceRef.current, page: location.pathname };
      presenceRef.current = updated;
      channelRef.current.track(updated);
    }
  }, [location.pathname]);
};
