import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, MessageCircle, Users, UserPlus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useChat } from "@/hooks/useChat";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface Collaborator {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
}

interface ChatSidebarProps {
  setlistId: string | null;
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onUnreadChange?: (hasUnread: boolean) => void;
}

const ChatSidebar = ({ setlistId, user, isOpen, onClose, onUnreadChange }: ChatSidebarProps) => {
  const { messages, sendMessage } = useChat(setlistId, user);
  const [input, setInput] = useState("");
  const [showMembers, setShowMembers] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessageCount = useRef<number | null>(null);

  // Load collaborators
  useEffect(() => {
    if (!setlistId || !isOpen) return;
    const load = async () => {
      // Get setlist owner
      const { data: setlist } = await supabase
        .from("setlists")
        .select("creator_id")
        .eq("id", setlistId)
        .single();

      const members: Collaborator[] = [];

      if (setlist) {
        const ownerProfile = await supabase
          .from("profiles")
          .select("display_name, avatar_url")
          .eq("user_id", setlist.creator_id)
          .single();
        members.push({
          userId: setlist.creator_id,
          displayName: ownerProfile.data?.display_name || "Unknown",
          avatarUrl: ownerProfile.data?.avatar_url || null,
          role: "owner",
        });
      }

      // Get collaborators
      const { data: collabs } = await supabase
        .from("collaborators")
        .select("user_id, role")
        .eq("setlist_id", setlistId);

      if (collabs) {
        for (const c of collabs) {
          if (members.some((m) => m.userId === c.user_id)) continue;
          const profile = await supabase
            .from("profiles")
            .select("display_name, avatar_url")
            .eq("user_id", c.user_id)
            .single();
          members.push({
            userId: c.user_id,
            displayName: profile.data?.display_name || "Unknown",
            avatarUrl: profile.data?.avatar_url || null,
            role: c.role,
          });
        }
      }

      setCollaborators(members);
    };
    load();
  }, [setlistId, isOpen]);

  // Search users to invite
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .ilike("display_name", `%${searchQuery}%`)
        .neq("user_id", user?.id || "")
        .limit(8);
      // Filter out existing collaborators
      const existing = new Set(collaborators.map((c) => c.userId));
      setSearchResults((data || []).filter((u) => !existing.has(u.user_id)));
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, user, collaborators]);

  // Track unread messages when sidebar is closed
  useEffect(() => {
    if (prevMessageCount.current !== null && messages.length > prevMessageCount.current && !isOpen) {
      onUnreadChange?.(true);
    }
    prevMessageCount.current = messages.length;
  }, [messages.length, isOpen, onUnreadChange]);

  // Clear unread when opened
  useEffect(() => {
    if (isOpen) onUnreadChange?.(false);
  }, [isOpen, onUnreadChange]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    await sendMessage(input);
    setInput("");
  };

  const handleInvite = async (invitedUserId: string) => {
    if (!setlistId) return;
    // Add as collaborator
    await supabase.from("collaborators").insert({
      setlist_id: setlistId,
      user_id: invitedUserId,
      role: "editor",
    });
    setSearchQuery("");
    setSearchResults([]);
    setShowInvite(false);
    // Reload collaborators
    const profile = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("user_id", invitedUserId)
      .single();
    setCollaborators((prev) => [
      ...prev,
      {
        userId: invitedUserId,
        displayName: profile.data?.display_name || "Unknown",
        avatarUrl: profile.data?.avatar_url || null,
        role: "editor",
      },
    ]);
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const isOwner = collaborators.find((c) => c.role === "owner")?.userId === user?.id;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="fixed right-0 top-0 h-full w-80 bg-card border-l border-border z-50 flex flex-col shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-primary" />
              <h3 className="font-display text-sm text-foreground">Setlist Chat</h3>
              <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                {collaborators.length}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setShowMembers(!showMembers); setShowInvite(false); }}
                className="p-1.5 rounded hover:bg-muted transition-colors"
                title="View members"
              >
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
              {isOwner && (
                <button
                  onClick={() => { setShowInvite(!showInvite); setShowMembers(false); }}
                  className="p-1.5 rounded hover:bg-muted transition-colors"
                  title="Invite to chat"
                >
                  <UserPlus className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
              <button onClick={onClose} className="p-1.5 rounded hover:bg-muted transition-colors">
                <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
          </div>

          {/* Members panel */}
          <AnimatePresence>
            {showMembers && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-b border-border"
              >
                <div className="p-3 space-y-2">
                  <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">Members</p>
                  {collaborators.map((c) => (
                    <div key={c.userId} className="flex items-center gap-2">
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={c.avatarUrl || undefined} />
                        <AvatarFallback className="bg-primary/20 text-primary text-[10px]">
                          {c.displayName[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-body text-foreground flex-1 truncate">{c.displayName}</span>
                      <span className="text-[9px] font-mono text-muted-foreground uppercase">{c.role}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Invite panel */}
          <AnimatePresence>
            {showInvite && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-b border-border"
              >
                <div className="p-3">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search users to invite..."
                      className="pl-8 bg-background border-border text-foreground font-body text-xs h-8"
                      autoFocus
                    />
                  </div>
                  {searchResults.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {searchResults.map((u) => (
                        <button
                          key={u.user_id}
                          onClick={() => handleInvite(u.user_id)}
                          className="w-full flex items-center gap-2 p-1.5 rounded hover:bg-muted transition-colors text-left"
                        >
                          <Avatar className="w-6 h-6">
                            <AvatarImage src={u.avatar_url || undefined} />
                            <AvatarFallback className="bg-primary/20 text-primary text-[10px]">
                              {(u.display_name || "?")[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-body text-foreground">{u.display_name || "Unknown"}</span>
                          <UserPlus className="w-3 h-3 text-primary ml-auto" />
                        </button>
                      ))}
                    </div>
                  )}
                  {searchQuery && searchResults.length === 0 && (
                    <p className="text-[10px] text-muted-foreground mt-2 text-center">No users found</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-2">
                <MessageCircle className="w-8 h-8 text-muted-foreground/20" />
                <p className="text-xs text-muted-foreground font-body text-center">
                  No messages yet. Start the conversation!
                </p>
                {collaborators.length <= 1 && isOwner && (
                  <button
                    onClick={() => { setShowInvite(true); setShowMembers(false); }}
                    className="text-[10px] text-primary font-body hover:underline mt-1"
                  >
                    + Invite someone to chat
                  </button>
                )}
              </div>
            )}
            {messages.map((msg) => {
              const isMe = msg.userId === user?.id;
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                >
                  <span className="text-[10px] text-muted-foreground font-body mb-0.5">
                    {msg.displayName} · {formatTime(msg.createdAt)}
                  </span>
                  <div
                    className={`px-3 py-1.5 rounded-lg text-sm font-body max-w-[85%] ${
                      isMe
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                className="bg-background border-border text-foreground font-body text-sm"
              />
              <Button
                type="submit"
                size="sm"
                className="bg-primary text-primary-foreground shrink-0"
                disabled={!input.trim()}
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </form>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ChatSidebar;
