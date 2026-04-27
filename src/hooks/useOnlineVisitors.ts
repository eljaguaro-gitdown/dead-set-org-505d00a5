import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const HEARTBEAT_INTERVAL = 30_000;
const VISITOR_ID_KEY = "ds_visitor_id";

export interface OnlineVisitor {
  visitor_id: string;
  user_id: string | null;
  display_name: string | null;
  avatar_url: string | null;
  page: string;
  joined_at: string;
}

const getOrCreateVisitorId = () => {
  const existing = localStorage.getItem(VISITOR_ID_KEY);
  if (existing) return existing;

  const visitorId = crypto.randomUUID();
  localStorage.setItem(VISITOR_ID_KEY, visitorId);
  return visitorId;
};

const isBetterPresence = (next: OnlineVisitor, current?: OnlineVisitor) => {
  if (!current) return true;
  if (next.user_id && !current.user_id) return true;
  if (next.display_name && !current.display_name) return true;
  return new Date(next.joined_at).getTime() < new Date(current.joined_at).getTime();
};

/**
 * Admin-only hook: subscribes to the presence channel and returns
 * a live list of everyone currently on the site.
 *
 * The admin listener also tracks the current admin's real presence, so the
 * widget still shows "you" even if the global broadcaster has not synced yet.
 */
export const useOnlineVisitors = (enabled: boolean) => {
  const [visitors, setVisitors] = useState<OnlineVisitor[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const selfPresenceRef = useRef<OnlineVisitor | null>(null);
  const { user, loading } = useAuth();

  const syncState = useCallback(() => {
    const channel = channelRef.current;
    if (!channel) return;

    const state = channel.presenceState<OnlineVisitor>();
    const visitorsById = new Map<string, OnlineVisitor>();

    Object.values(state).forEach((presences) => {
      presences.forEach((presence) => {
        const visitor = presence as unknown as OnlineVisitor;
        if (!visitor.visitor_id) return;

        const key = visitor.user_id || visitor.visitor_id;
        const current = visitorsById.get(key);
        if (isBetterPresence(visitor, current)) {
          visitorsById.set(key, visitor);
        }
      });
    });

    setVisitors(
      Array.from(visitorsById.values()).sort(
        (a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime(),
      ),
    );
  }, []);

  useEffect(() => {
    if (!enabled || loading) return;

    let cancelled = false;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    const visitorId = getOrCreateVisitorId();

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

      if (cancelled) return;

      const presenceState: OnlineVisitor = {
        visitor_id: visitorId,
        user_id: user?.id || null,
        display_name: displayName,
        avatar_url: avatarUrl,
        page: window.location.pathname,
        joined_at: new Date().toISOString(),
      };

      selfPresenceRef.current = presenceState;

      const channel = supabase.channel("online_visitors", {
        config: { presence: { key: visitorId } },
      });

      channelRef.current = channel;

      channel
        .on("presence", { event: "sync" }, syncState)
        .on("presence", { event: "join" }, syncState)
        .on("presence", { event: "leave" }, syncState)
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED" && !cancelled && selfPresenceRef.current) {
            await channel.track(selfPresenceRef.current);
            syncState();
          }
        });

      heartbeat = setInterval(() => {
        if (!channelRef.current || !selfPresenceRef.current) return;
        const updated = { ...selfPresenceRef.current, page: window.location.pathname };
        selfPresenceRef.current = updated;
        channelRef.current.track(updated);
        syncState();
      }, HEARTBEAT_INTERVAL);
    };

    init();

    return () => {
      cancelled = true;
      if (heartbeat) clearInterval(heartbeat);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      selfPresenceRef.current = null;
    };
  }, [enabled, loading, syncState, user]);

  return visitors;
};
