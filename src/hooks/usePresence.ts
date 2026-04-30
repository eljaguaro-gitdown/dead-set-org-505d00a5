import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  getOrCreateVisitorId,
  trackPresence,
  type PresencePayload,
} from "@/lib/presenceChannel";

const HEARTBEAT_INTERVAL = 30_000;

/**
 * Broadcasts the current visitor's presence on the shared Realtime channel.
 * Mounts once at app root.
 */
export const usePresence = () => {
  const presenceRef = useRef<PresencePayload | null>(null);
  const { user, loading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;

    let cancelled = false;
    let heartbeat: ReturnType<typeof setInterval> | null = null;

    const init = async () => {
      const visitorId = getOrCreateVisitorId();

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

      if (cancelled) return;

      const payload: PresencePayload = {
        visitor_id: visitorId,
        user_id: user?.id || null,
        display_name: displayName,
        avatar_url: avatarUrl,
        page: window.location.pathname,
        joined_at: new Date().toISOString(),
      };

      presenceRef.current = payload;
      await trackPresence(payload);

      heartbeat = setInterval(() => {
        if (!presenceRef.current) return;
        const path = window.location.pathname;
        if (presenceRef.current.page === path) return; // no-op heartbeat — keep payload stable
        const updated = { ...presenceRef.current, page: path };
        presenceRef.current = updated;
        trackPresence(updated);
      }, HEARTBEAT_INTERVAL);
    };

    init();

    return () => {
      cancelled = true;
      if (heartbeat) clearInterval(heartbeat);
    };
  }, [user, loading]);

  // Update page on React Router navigation — skip if unchanged.
  useEffect(() => {
    if (!presenceRef.current) return;
    if (presenceRef.current.page === location.pathname) return;
    const updated = { ...presenceRef.current, page: location.pathname };
    presenceRef.current = updated;
    trackPresence(updated);
  }, [location.pathname]);
};
