import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useChat } from "@/hooks/useChat";
import type { User } from "@supabase/supabase-js";

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessageCount = useRef(0);

  // Track unread messages when sidebar is closed
  useEffect(() => {
    if (messages.length > prevMessageCount.current && !isOpen) {
      onUnreadChange?.(true);
    }
    prevMessageCount.current = messages.length;
  }, [messages.length, isOpen, onUnreadChange]);

  // Clear unread when opened
  useEffect(() => {
    if (isOpen) {
      onUnreadChange?.(false);
    }
  }, [isOpen, onUnreadChange]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    await sendMessage(input);
    setInput("");
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed right-0 top-0 h-full w-80 bg-card border-l border-border z-50 flex flex-col shadow-2xl"
        >
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-primary" />
              <h3 className="font-display text-sm text-foreground">Setlist Chat</h3>
            </div>
            <button onClick={onClose}>
              <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-xs text-muted-foreground font-body text-center mt-8">
                No messages yet. Start the conversation!
              </p>
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
