import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface Conversation {
  id: string;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar: string | null;
  lastMessageAt: string;
  lastMessagePreview?: string;
  unreadCount: number;
}

interface DirectMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  read: boolean;
  createdAt: string;
}

export const useDirectMessages = (user: User | null) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const profileCache = useRef<Map<string, { name: string; avatar: string | null }>>(new Map());

  const resolveProfile = async (userId: string) => {
    if (profileCache.current.has(userId)) return profileCache.current.get(userId)!;
    const { data } = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("user_id", userId)
      .single();
    const profile = { name: data?.display_name || "Unknown", avatar: data?.avatar_url || null };
    profileCache.current.set(userId, profile);
    return profile;
  };

  // Load conversations
  const loadConversations = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("conversations")
      .select("id, user_one, user_two, last_message_at")
      .order("last_message_at", { ascending: false });

    if (data) {
      const enriched = await Promise.all(
        data.map(async (c) => {
          const otherUserId = c.user_one === user.id ? c.user_two : c.user_one;
          const profile = await resolveProfile(otherUserId);

          // Get last message preview
          const { data: lastMsg } = await supabase
            .from("direct_messages")
            .select("content")
            .eq("conversation_id", c.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          // Get unread count
          const { count } = await supabase
            .from("direct_messages")
            .select("id", { count: "exact", head: true })
            .eq("conversation_id", c.id)
            .eq("read", false)
            .neq("sender_id", user.id);

          return {
            id: c.id,
            otherUserId,
            otherUserName: profile.name,
            otherUserAvatar: profile.avatar,
            lastMessageAt: c.last_message_at,
            lastMessagePreview: lastMsg?.content,
            unreadCount: count || 0,
          };
        })
      );
      setConversations(enriched);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load messages for active conversation
  useEffect(() => {
    if (!activeConversationId || !user) {
      setMessages([]);
      return;
    }

    const load = async () => {
      const { data } = await supabase
        .from("direct_messages")
        .select("id, sender_id, content, read, created_at")
        .eq("conversation_id", activeConversationId)
        .order("created_at", { ascending: true })
        .limit(200);

      if (data) {
        const enriched = await Promise.all(
          data.map(async (m) => {
            const profile = await resolveProfile(m.sender_id);
            return {
              id: m.id,
              senderId: m.sender_id,
              senderName: profile.name,
              content: m.content,
              read: m.read,
              createdAt: m.created_at,
            };
          })
        );
        setMessages(enriched);
      }

      // Mark unread messages as read
      await supabase
        .from("direct_messages")
        .update({ read: true })
        .eq("conversation_id", activeConversationId)
        .eq("read", false)
        .neq("sender_id", user.id);
    };

    load();
  }, [activeConversationId, user]);

  // Realtime subscription for new messages
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("dm-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        async (payload) => {
          const newMsg = payload.new as any;
          const profile = await resolveProfile(newMsg.sender_id);

          if (newMsg.conversation_id === activeConversationId) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, {
                id: newMsg.id,
                senderId: newMsg.sender_id,
                senderName: profile.name,
                content: newMsg.content,
                read: newMsg.read,
                createdAt: newMsg.created_at,
              }];
            });

            // Mark as read if not from me
            if (newMsg.sender_id !== user.id) {
              await supabase
                .from("direct_messages")
                .update({ read: true })
                .eq("id", newMsg.id);
            }
          }

          // Refresh conversation list
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, activeConversationId, loadConversations]);

  // Start or find existing conversation
  const startConversation = useCallback(async (otherUserId: string) => {
    if (!user) return null;

    const [u1, u2] = user.id < otherUserId ? [user.id, otherUserId] : [otherUserId, user.id];

    // Check if conversation exists
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_one", u1)
      .eq("user_two", u2)
      .single();

    if (existing) {
      setActiveConversationId(existing.id);
      return existing.id;
    }

    // Create new conversation
    const { data: created, error } = await supabase
      .from("conversations")
      .insert({ user_one: u1, user_two: u2 })
      .select("id")
      .single();

    if (created) {
      setActiveConversationId(created.id);
      await loadConversations();
      return created.id;
    }

    console.error("Failed to create conversation:", error);
    return null;
  }, [user, loadConversations]);

  // Send message
  const sendMessage = useCallback(async (content: string) => {
    if (!user || !activeConversationId || !content.trim()) return;

    await supabase.from("direct_messages").insert({
      conversation_id: activeConversationId,
      sender_id: user.id,
      content: content.trim(),
    });

    // Update last_message_at
    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", activeConversationId);
  }, [user, activeConversationId]);

  // Search users
  const searchUsers = useCallback(async (query: string) => {
    if (!user || !query.trim()) return [];
    const { data } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url")
      .ilike("display_name", `%${query}%`)
      .neq("user_id", user.id)
      .limit(10);
    return data || [];
  }, [user]);

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return {
    conversations,
    messages,
    activeConversationId,
    setActiveConversationId,
    loading,
    startConversation,
    sendMessage,
    searchUsers,
    totalUnread,
    loadConversations,
  };
};
