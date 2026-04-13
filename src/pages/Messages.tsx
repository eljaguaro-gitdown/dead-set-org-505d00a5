import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Search, MessageCircle, Plus, Users, X, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import PageLayout from "@/components/PageLayout";
import SiteHeader from "@/components/SiteHeader";
import { useAuth } from "@/hooks/useAuth";
import { useDirectMessages } from "@/hooks/useDirectMessages";
import { useIsMobile } from "@/hooks/use-mobile";
import { useOnlineUserIds } from "@/hooks/useOnlineUserIds";

const Messages = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const isMobile = useIsMobile();
  const {
    conversations,
    messages,
    activeConversationId,
    setActiveConversationId,
    loading,
    startConversation,
    startGroupConversation,
    sendMessage,
    searchUsers,
  } = useDirectMessages(user);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [groupMode, setGroupMode] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);
  const [groupName, setGroupName] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const onlineUserIds = useOnlineUserIds(!!user);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // User search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const results = await searchUsers(searchQuery);
      setSearchResults(results);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, searchUsers]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    const msg = input;
    setInput("");
    try {
      await sendMessage(msg);
    } finally {
      setSending(false);
    }
  };

  const handleStartConversation = async (otherUserId: string) => {
    if (groupMode) {
      // Toggle user selection for group
      setSelectedUsers((prev) => {
        const exists = prev.find((u) => u.user_id === otherUserId);
        if (exists) return prev.filter((u) => u.user_id !== otherUserId);
        const userResult = searchResults.find((u) => u.user_id === otherUserId);
        return userResult ? [...prev, userResult] : prev;
      });
      return;
    }
    const conversationId = await startConversation(otherUserId);
    if (!conversationId) return;
    setShowSearch(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleCreateGroup = async () => {
    if (selectedUsers.length === 0) return;
    const memberIds = selectedUsers.map((u) => u.user_id);
    const conversationId = await startGroupConversation(memberIds, groupName || undefined);
    if (!conversationId) return;
    setShowSearch(false);
    setGroupMode(false);
    setSelectedUsers([]);
    setGroupName("");
    setSearchQuery("");
    setSearchResults([]);
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const activeConv = conversations.find((c) => c.id === activeConversationId);
  const showConversationList = !activeConversationId || !isMobile;
  const showChat = !!activeConversationId;

  if (authLoading) return null;

  return (
    <PageLayout>
      <SiteHeader>
        <button
          onClick={() => navigate("/my-setlists")}
          className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors tracking-wider uppercase"
        >
          My Setlists
        </button>
      </SiteHeader>

      <div className="flex-1 flex overflow-hidden" style={{ height: "calc(100vh - 73px)" }}>
        {/* Conversation List */}
        {showConversationList && (
          <div className={`${isMobile && activeConversationId ? "hidden" : ""} ${isMobile ? "w-full" : "w-80"} border-r border-border flex flex-col bg-card`}>
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="font-display text-lg text-foreground">Messages</h2>
              <button
                onClick={() => { setShowSearch(!showSearch); setGroupMode(false); setSelectedUsers([]); }}
                className="p-2 rounded-md hover:bg-muted transition-colors"
              >
                <Plus className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* User search / new conversation */}
            <AnimatePresence>
              {showSearch && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-b border-border"
                >
                  <div className="p-3">
                    {/* Toggle: DM vs Group */}
                    <div className="flex gap-1 mb-2">
                      <button
                        onClick={() => { setGroupMode(false); setSelectedUsers([]); }}
                        className={`flex-1 text-[10px] font-mono uppercase tracking-wider py-1.5 rounded transition-colors ${
                          !groupMode ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Direct Message
                      </button>
                      <button
                        onClick={() => setGroupMode(true)}
                        className={`flex-1 text-[10px] font-mono uppercase tracking-wider py-1.5 rounded transition-colors flex items-center justify-center gap-1 ${
                          groupMode ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Users className="w-3 h-3" /> Group
                      </button>
                    </div>

                    {/* Group name input */}
                    {groupMode && (
                      <Input
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        placeholder="Group name (optional)..."
                        className="mb-2 bg-background border-border text-foreground font-body text-sm"
                      />
                    )}

                    {/* Selected users for group */}
                    {groupMode && selectedUsers.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {selectedUsers.map((u) => (
                          <span
                            key={u.user_id}
                            className="inline-flex items-center gap-1 bg-primary/20 text-primary text-[10px] font-body px-2 py-0.5 rounded-full"
                          >
                            {u.display_name}
                            <button onClick={() => setSelectedUsers((prev) => prev.filter((p) => p.user_id !== u.user_id))}>
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search users..."
                        className="pl-9 bg-background border-border text-foreground font-body text-sm"
                        autoFocus
                      />
                    </div>

                    {searchResults.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {searchResults.map((u) => {
                          const isSelected = selectedUsers.some((s) => s.user_id === u.user_id);
                          return (
                            <button
                              key={u.user_id}
                              onClick={() => handleStartConversation(u.user_id)}
                              className={`w-full flex items-center gap-3 p-2 rounded-md hover:bg-muted transition-colors text-left ${
                                isSelected ? "bg-primary/10" : ""
                              }`}
                            >
                              <Avatar className="w-8 h-8">
                                <AvatarImage src={u.avatar_url || undefined} />
                                <AvatarFallback className="bg-primary/20 text-primary text-xs">
                                  {(u.display_name || "?")[0].toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-body text-foreground flex-1">{u.display_name || "Unknown"}</span>
                              {groupMode && isSelected && (
                                <Check className="w-4 h-4 text-primary" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {searchQuery && searchResults.length === 0 && (
                      <p className="text-xs text-muted-foreground mt-2 text-center">No users found</p>
                    )}

                    {/* Create group button */}
                    {groupMode && selectedUsers.length > 0 && (
                      <Button
                        onClick={handleCreateGroup}
                        size="sm"
                        className="w-full mt-3 bg-primary text-primary-foreground"
                      >
                        <Users className="w-3.5 h-3.5 mr-1" />
                        Create Group ({selectedUsers.length + 1})
                      </Button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto">
              {conversations.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center h-full gap-3 px-6">
                  <MessageCircle className="w-10 h-10 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground font-body text-center">
                    No conversations yet. Tap <span className="text-primary">+</span> to start one.
                  </p>
                </div>
              )}
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setActiveConversationId(conv.id)}
                  className={`w-full flex items-center gap-3 p-4 border-b border-border/50 hover:bg-muted/50 transition-colors text-left ${
                    conv.id === activeConversationId ? "bg-muted/70" : ""
                  }`}
                >
                  {conv.isGroup ? (
                    <div className="w-10 h-10 shrink-0 rounded-full bg-primary/20 flex items-center justify-center">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                  ) : (
                    <div className="relative shrink-0">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={conv.otherUserAvatar || undefined} />
                        <AvatarFallback className="bg-primary/20 text-primary text-sm">
                          {conv.otherUserName[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {onlineUserIds.has(conv.otherUserId) && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-card" />
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-display text-foreground truncate">{conv.otherUserName}</span>
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0 ml-2">
                        {formatTime(conv.lastMessageAt)}
                      </span>
                    </div>
                    {conv.lastMessagePreview && (
                      <p className="text-xs text-muted-foreground font-body truncate mt-0.5">
                        {conv.lastMessagePreview}
                      </p>
                    )}
                  </div>
                  {conv.unreadCount > 0 && (
                    <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-mono flex items-center justify-center shrink-0">
                      {conv.unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat view */}
        {showChat && (
          <div className="flex-1 flex flex-col bg-background">
            {/* Chat header */}
            <div className="flex items-center gap-3 p-4 border-b border-border bg-card">
              {isMobile && (
                <button onClick={() => setActiveConversationId(null)} className="p-1">
                  <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                </button>
              )}
              {activeConv && (
                <>
                  {activeConv.isGroup ? (
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <Users className="w-4 h-4 text-primary" />
                    </div>
                  ) : (
                    <div className="relative">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={activeConv.otherUserAvatar || undefined} />
                        <AvatarFallback className="bg-primary/20 text-primary text-xs">
                          {activeConv.otherUserName[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {onlineUserIds.has(activeConv.otherUserId) && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-card" />
                      )}
                    </div>
                  )}
                  <div>
                    <span className="font-display text-sm text-foreground">{activeConv.otherUserName}</span>
                    {activeConv.isGroup && activeConv.members.length > 0 && (
                      <p className="text-[10px] text-muted-foreground font-body">
                        {activeConv.members.length + 1} members
                      </p>
                    )}
                    {!activeConv.isGroup && onlineUserIds.has(activeConv.otherUserId) && (
                      <p className="text-[10px] text-green-500 font-body">Online</p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <p className="text-xs text-muted-foreground font-body text-center mt-8">
                  Send a message to start the conversation ✌️
                </p>
              )}
              {messages.map((msg) => {
                const isMe = msg.senderId === user?.id;
                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                    <span className="text-[10px] text-muted-foreground font-body mb-0.5">
                      {msg.senderName} · {formatTime(msg.createdAt)}
                    </span>
                    <div
                      className={`px-3 py-1.5 rounded-lg text-sm font-body max-w-[85%] ${
                        isMe ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
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
            <div className="p-3 border-t border-border bg-card">
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
                <Button type="submit" size="sm" className="bg-primary text-primary-foreground shrink-0" disabled={!input.trim() || sending}>
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </form>
            </div>
          </div>
        )}

        {/* Empty state for desktop when no conversation selected */}
        {!activeConversationId && !isMobile && (
          <div className="flex-1 flex items-center justify-center bg-background">
            <div className="text-center">
              <MessageCircle className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground font-body">Select a conversation or start a new one</p>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default Messages;
