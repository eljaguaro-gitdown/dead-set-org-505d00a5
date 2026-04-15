import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface ConversationMember {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

interface Conversation {
  id: string;
  isGroup: boolean;
  name: string | null;
  // For 1-on-1 backward compat
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar: string | null;
  // For group chats
  members: ConversationMember[];
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
      .maybeSingle();
    const profile = { name: data?.display_name || "Unknown", avatar: data?.avatar_url || null };
    profileCache.current.set(userId, profile);
    return profile;
  };

  // Load conversations — batched queries to avoid N+1
  const loadConversations = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("conversations")
      .select("id, user_one, user_two, last_message_at, name, is_group")
      .order("last_message_at", { ascending: false });

    if (error) {
      console.error("Failed to load conversations:", error);
      setConversations([]);
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const conversationIds = data.map((c) => c.id);

    // Batch: get all members, last messages, and unread counts in 3 queries
    const [membersRes, lastMsgsRes, unreadRes] = await Promise.all([
      supabase
        .from("conversation_members")
        .select("conversation_id, user_id")
        .in("conversation_id", conversationIds),
      supabase
        .from("direct_messages")
        .select("conversation_id, content, created_at")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("direct_messages")
        .select("conversation_id", { count: "exact" })
        .in("conversation_id", conversationIds)
        .eq("read", false)
        .neq("sender_id", user.id),
    ]);

    // Build lookup maps
    const membersByConv = new Map<string, string[]>();
    for (const m of membersRes.data || []) {
      const list = membersByConv.get(m.conversation_id) || [];
      list.push(m.user_id);
      membersByConv.set(m.conversation_id, list);
    }

    // Last message per conversation (first occurrence since sorted desc)
    const lastMsgByConv = new Map<string, string>();
    for (const m of lastMsgsRes.data || []) {
      if (!lastMsgByConv.has(m.conversation_id)) {
        lastMsgByConv.set(m.conversation_id, m.content);
      }
    }

    // Unread counts per conversation
    const unreadByConv = new Map<string, number>();
    for (const m of unreadRes.data || []) {
      unreadByConv.set(m.conversation_id, (unreadByConv.get(m.conversation_id) || 0) + 1);
    }

    // Collect all unique user IDs we need profiles for
    const allOtherUserIds = new Set<string>();
    for (const c of data) {
      const members = membersByConv.get(c.id) || [];
      for (const uid of members) {
        if (uid !== user.id) allOtherUserIds.add(uid);
      }
      // Fallback from conversation record
      const fallbackOther = c.user_one === user.id ? c.user_two : c.user_one;
      allOtherUserIds.add(fallbackOther);
    }

    // Batch fetch all profiles at once
    if (allOtherUserIds.size > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", [...allOtherUserIds]);
      for (const p of profiles || []) {
        profileCache.current.set(p.user_id, {
          name: p.display_name || "Unknown",
          avatar: p.avatar_url || null,
        });
      }
    }

    const enriched = data.map((c) => {
      const members = (membersByConv.get(c.id) || []).filter((uid) => uid !== user.id);
      const memberProfiles = members.map((uid) => {
        const profile = profileCache.current.get(uid) || { name: "Unknown", avatar: null };
        return { userId: uid, displayName: profile.name, avatarUrl: profile.avatar };
      });

      const otherUserId = members[0] || (c.user_one === user.id ? c.user_two : c.user_one);
      const otherProfile = profileCache.current.get(otherUserId) || { name: "Unknown", avatar: null };

      const displayName = c.is_group
        ? c.name || memberProfiles.map((m) => m.displayName).join(", ") || "Group Chat"
        : otherProfile.name;

      return {
        id: c.id,
        isGroup: c.is_group || false,
        name: c.name,
        otherUserId,
        otherUserName: displayName,
        otherUserAvatar: c.is_group ? null : otherProfile.avatar,
        members: memberProfiles,
        lastMessageAt: c.last_message_at,
        lastMessagePreview: lastMsgByConv.get(c.id),
        unreadCount: unreadByConv.get(c.id) || 0,
      };
    });

    setConversations(enriched);
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

            if (newMsg.sender_id !== user.id) {
              await supabase
                .from("direct_messages")
                .update({ read: true })
                .eq("id", newMsg.id);
            }
          }

          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, activeConversationId, loadConversations]);

  // Start or find existing 1-on-1 conversation
  const startConversation = useCallback(async (otherUserId: string) => {
    if (!user) return null;

    const [u1, u2] = user.id < otherUserId ? [user.id, otherUserId] : [otherUserId, user.id];

    // Check if conversation exists
    const { data: existing, error: existingError } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_one", u1)
      .eq("user_two", u2)
      .eq("is_group", false)
      .maybeSingle();

    if (existingError) {
      console.error("Failed to check existing conversation:", existingError);
      return null;
    }

    if (existing) {
      setActiveConversationId(existing.id);
      return existing.id;
    }

    const conversationId = crypto.randomUUID();

    const { error: createError } = await supabase
      .from("conversations")
      .insert({ id: conversationId, user_one: u1, user_two: u2, is_group: false });

    if (createError) {
      console.error("Failed to create conversation:", createError);
      return null;
    }

    const { error: selfMembershipError } = await supabase
      .from("conversation_members")
      .insert({ conversation_id: conversationId, user_id: user.id });

    if (selfMembershipError) {
      console.error("Failed to add current user to conversation:", selfMembershipError);
      return null;
    }

    const { error: otherMembershipError } = await supabase
      .from("conversation_members")
      .insert({ conversation_id: conversationId, user_id: otherUserId });

    if (otherMembershipError) {
      console.error("Failed to add recipient to conversation:", otherMembershipError);
      return null;
    }

    setActiveConversationId(conversationId);
    await loadConversations();
    return conversationId;
  }, [user, loadConversations]);

  // Start a group conversation
  const startGroupConversation = useCallback(async (memberIds: string[], name?: string) => {
    if (!user || memberIds.length === 0) return null;

    const conversationId = crypto.randomUUID();

    // Must satisfy CHECK (user_one < user_two) constraint
    const [u1, u2] = user.id < memberIds[0] ? [user.id, memberIds[0]] : [memberIds[0], user.id];

    const { error: createError } = await supabase
      .from("conversations")
      .insert({
        id: conversationId,
        user_one: u1,
        user_two: u2,
        is_group: true,
        name: name || null,
      });

    if (createError) {
      console.error("Failed to create group conversation:", createError);
      return null;
    }

    const { error: selfMembershipError } = await supabase
      .from("conversation_members")
      .insert({ conversation_id: conversationId, user_id: user.id });

    if (selfMembershipError) {
      console.error("Failed to add creator to group conversation:", selfMembershipError);
      return null;
    }

    const { error: memberInsertError } = await supabase.from("conversation_members").insert(
      memberIds.map((uid) => ({ conversation_id: conversationId, user_id: uid }))
    );

    if (memberInsertError) {
      console.error("Failed to add members to group conversation:", memberInsertError);
      return null;
    }

    setActiveConversationId(conversationId);
    await loadConversations();
    return conversationId;
  }, [user, loadConversations]);

  // Add member to existing group
  const addGroupMember = useCallback(async (conversationId: string, userId: string) => {
    await supabase.from("conversation_members").insert({
      conversation_id: conversationId,
      user_id: userId,
    });
    await loadConversations();
  }, [loadConversations]);

  // Send message (with guard against double-sends)
  const sendingRef = useRef(false);
  const sendMessage = useCallback(async (content: string) => {
    if (!user || !activeConversationId || !content.trim()) return;
    if (sendingRef.current) return;
    sendingRef.current = true;

    try {
      await supabase.from("direct_messages").insert({
        conversation_id: activeConversationId,
        sender_id: user.id,
        content: content.trim(),
      });

      await supabase
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", activeConversationId);

      // Fire-and-forget: notify recipient via email
      const activeConv = conversations.find((c) => c.id === activeConversationId);
      if (activeConv) {
        const senderProfile = await supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", user.id)
          .maybeSingle();
        const senderName = senderProfile.data?.display_name || user.email?.split("@")[0] || "A Deadhead";

        // Check which users are currently online via presence
        const onlineUserIds = new Set<string>();
        try {
          // Find the already-subscribed presence channel (PresenceBroadcaster creates it)
          const existingChannel = supabase.getChannels().find(
            (ch) => ch.topic === "realtime:online_visitors"
          );
          if (existingChannel) {
            const state = existingChannel.presenceState();
            for (const key of Object.keys(state)) {
              const presences = state[key] as any[];
              if (presences?.[0]?.user_id) {
                onlineUserIds.add(presences[0].user_id);
              }
            }
          }
        } catch {}

        const recipientIds = activeConv.isGroup
          ? activeConv.members.map((m) => m.userId)
          : [activeConv.otherUserId];

        // Only notify offline recipients
        recipientIds
          .filter((id) => !onlineUserIds.has(id))
          .forEach((recipientUserId) => {
            supabase.functions.invoke("notify-dm", {
              body: {
                recipientUserId,
                senderName,
                messagePreview: content.trim().slice(0, 200),
              },
            }).catch(() => {});
          });
      }
    } finally {
      sendingRef.current = false;
    }
  }, [user, activeConversationId, conversations]);

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
    startGroupConversation,
    addGroupMember,
    sendMessage,
    searchUsers,
    totalUnread,
    loadConversations,
  };
};
