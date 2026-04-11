import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

export const useUnreadMessages = (user: User | null) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const profileCache = useRef<Map<string, string>>(new Map());

  const resolveName = async (userId: string): Promise<string> => {
    if (profileCache.current.has(userId)) return profileCache.current.get(userId)!;
    const { data } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", userId)
      .maybeSingle();
    const name = data?.display_name || "Someone";
    profileCache.current.set(userId, name);
    return name;
  };

  const fetchUnreadCount = useCallback(async () => {
    if (!user) { setUnreadCount(0); return; }
    // Count unread messages across all conversations the user is a member of
    const { data: memberships } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", user.id);

    if (!memberships || memberships.length === 0) { setUnreadCount(0); return; }

    const conversationIds = memberships.map((m) => m.conversation_id);
    const { count } = await supabase
      .from("direct_messages")
      .select("id", { count: "exact", head: true })
      .in("conversation_id", conversationIds)
      .eq("read", false)
      .neq("sender_id", user.id);

    setUnreadCount(count || 0);
  }, [user]);

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Realtime: listen for new messages & show toast
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("global-dm-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        async (payload) => {
          const msg = payload.new as any;
          if (msg.sender_id === user.id) return;

          // Check if the user is a member of this conversation
          const { data: membership } = await supabase
            .from("conversation_members")
            .select("id")
            .eq("conversation_id", msg.conversation_id)
            .eq("user_id", user.id)
            .maybeSingle();

          if (!membership) return;

          // Refresh count
          fetchUnreadCount();

          // Show toast
          const senderName = await resolveName(msg.sender_id);
          const preview = msg.content.length > 60 ? msg.content.slice(0, 60) + "…" : msg.content;
          toast(`${senderName}`, {
            description: preview,
            action: {
              label: "View",
              onClick: () => {
                window.location.href = "/messages";
              },
            },
            duration: 5000,
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "direct_messages" },
        () => {
          // Refresh count when messages are marked as read
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchUnreadCount]);

  return { unreadCount, refreshUnreadCount: fetchUnreadCount };
};
