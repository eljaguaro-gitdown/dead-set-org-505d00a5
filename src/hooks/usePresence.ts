import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  getDebugSnapshot,
  getOrCreateVisitorId,
  reconnectPresenceChannel,
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

  // Auto-reconnect when the tab returns to the foreground or the network
  // comes back. iOS Safari aggressively suspends WebSockets in the background
  // and the channel often comes back as CLOSED / CHANNEL_ERROR / TIMED_OUT.
  // Also runs a periodic watchdog so a stale channel recovers even when the
  // tab stays foregrounded (e.g. an admin staring at the debug panel).
  useEffect(() => {
    const STALE_STATUSES = new Set(["CLOSED", "CHANNEL_ERROR", "TIMED_OUT"]);
    // If we've been "SUBSCRIBING" for too long without reaching SUBSCRIBED,
    // treat that as stuck and force a reconnect.
    const SUBSCRIBING_STUCK_MS = 15_000;
    // If we're SUBSCRIBED but haven't seen any sync event in this long, the
    // socket is likely dead even though status hasn't flipped yet.
    const SYNC_STALE_MS = 90_000;

    const maybeReconnect = (reason: string) => {
      const snap = getDebugSnapshot();
      const now = Date.now();
      let stale = STALE_STATUSES.has(snap.status);

      if (!stale && snap.status === "SUBSCRIBING") {
        // No subscribedAt yet — use lastSyncAt or assume long-stuck.
        const since = snap.lastSyncAt ?? 0;
        if (now - since > SUBSCRIBING_STUCK_MS) stale = true;
      }

      if (!stale && snap.status === "SUBSCRIBED" && snap.lastSyncAt) {
        if (now - snap.lastSyncAt > SYNC_STALE_MS) stale = true;
      }

      if (!stale) return;
      console.warn(`[presence] reconnecting (${reason}, status=${snap.status})`);
      reconnectPresenceChannel();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") maybeReconnect("visibility");
    };
    const onFocus = () => maybeReconnect("focus");
    const onOnline = () => maybeReconnect("online");

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);

    // Watchdog: poll every 20s while the tab is visible.
    const watchdog = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      maybeReconnect("watchdog");
    }, 20_000);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      clearInterval(watchdog);
    };
  }, []);
};
