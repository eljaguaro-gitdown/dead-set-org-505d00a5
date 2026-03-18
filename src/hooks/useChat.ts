import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

interface ChatMessage {
  id: string;
  content: string;
  userId: string;
  displayName: string;
  createdAt: string;
}

export const useChat = (setlistId: string | null, user: User | null) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const profileCache = useRef<Map<string, string>>(new Map());

  const resolveDisplayName = async (userId: string): Promise<string> => {
    if (profileCache.current.has(userId)) return profileCache.current.get(userId)!;
    const { data } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", userId)
      .single();
    const name = data?.display_name || "Unknown";
    profileCache.current.set(userId, name);
    return name;
  };

  // Load existing messages
  useEffect(() => {
    if (!setlistId) return;
    setLoading(true);
    const load = async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("setlist_id", setlistId)
        .order("created_at", { ascending: true })
        .limit(100);
      if (data) {
        const enriched = await Promise.all(
          data.map(async (m) => ({
            id: m.id,
            content: m.content,
            userId: m.user_id,
            displayName: await resolveDisplayName(m.user_id),
            createdAt: m.created_at,
          }))
        );
        setMessages(enriched);
      }
      setLoading(false);
    };
    load();
  }, [setlistId]);

  // Realtime subscription
  useEffect(() => {
    if (!setlistId) return;
    const channel = supabase
      .channel(`chat-${setlistId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `setlist_id=eq.${setlistId}`,
        },
        async (payload) => {
          const newMsg = payload.new as Database["public"]["Tables"]["chat_messages"]["Row"];
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return prev; // Will be added below after resolving name
          });
          const displayName = await resolveDisplayName(newMsg.user_id);
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, {
              id: newMsg.id,
              content: newMsg.content,
              userId: newMsg.user_id,
              displayName,
              createdAt: newMsg.created_at,
            }];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [setlistId]);

  const sendMessage = useCallback(async (content: string) => {
    if (!setlistId || !user || !content.trim()) return;
    await supabase.from("chat_messages").insert({
      setlist_id: setlistId,
      user_id: user.id,
      content: content.trim(),
    });
  }, [setlistId, user]);

  return { messages, loading, sendMessage };
};
