import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export interface Announcement {
  id: string;
  author_id: string;
  title: string;
  body: string;
  cta_label: string | null;
  cta_url: string | null;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export function useAnnouncements(user: User | null) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) {
      setAnnouncements([]);
      setReadIds(new Set());
      setLoading(false);
      return;
    }
    setLoading(true);
    const [annRes, readRes] = await Promise.all([
      supabase
        .from("announcements")
        .select("*")
        .eq("published", true)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("announcement_reads").select("announcement_id").eq("user_id", user.id),
    ]);
    setAnnouncements((annRes.data as Announcement[]) || []);
    setReadIds(new Set((readRes.data || []).map((r: any) => r.announcement_id)));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Realtime: refresh when new announcements appear
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("announcements-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "announcements" },
        () => fetchAll()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchAll]);

  const markRead = useCallback(
    async (announcementId: string) => {
      if (!user) return;
      if (readIds.has(announcementId)) return;
      setReadIds((prev) => new Set(prev).add(announcementId));
      await supabase
        .from("announcement_reads")
        .insert({ user_id: user.id, announcement_id: announcementId });
    },
    [user, readIds]
  );

  const markAllRead = useCallback(async () => {
    if (!user) return;
    const unread = announcements.filter((a) => !readIds.has(a.id));
    if (unread.length === 0) return;
    setReadIds((prev) => {
      const next = new Set(prev);
      unread.forEach((a) => next.add(a.id));
      return next;
    });
    await supabase.from("announcement_reads").insert(
      unread.map((a) => ({ user_id: user.id, announcement_id: a.id }))
    );
  }, [user, announcements, readIds]);

  const unreadCount = announcements.filter((a) => !readIds.has(a.id)).length;

  return { announcements, readIds, unreadCount, loading, markRead, markAllRead, refresh: fetchAll };
}
