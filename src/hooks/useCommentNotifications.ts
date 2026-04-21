import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export interface CommentNotification {
  id: string;
  setlist_id: string;
  comment_id: string;
  commenter_user_id: string;
  commenter_name: string | null;
  setlist_title: string | null;
  preview: string | null;
  read: boolean;
  created_at: string;
}

export function useCommentNotifications(user: User | null) {
  const [notifications, setNotifications] = useState<CommentNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("comment_notifications")
      .select("*")
      .eq("recipient_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setNotifications((data as CommentNotification[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Realtime: new notifications arrive instantly
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`comment-notifs-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "comment_notifications",
          filter: `recipient_user_id=eq.${user.id}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as CommentNotification, ...prev]);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = useCallback(async () => {
    if (!user) return;
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await supabase
      .from("comment_notifications")
      .update({ read: true })
      .in("id", unreadIds);
  }, [user, notifications]);

  return { notifications, unreadCount, loading, markAllRead, refresh: fetchAll };
}
