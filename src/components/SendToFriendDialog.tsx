import { useState, useEffect } from "react";
import { MessageCircle, Send, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { trackShare } from "@/lib/trackShare";

interface Friend {
  conversationId: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

interface SendToFriendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareUrl: string;
  shareText: string;
  setlistId?: string;
}

const SendToFriendDialog = ({
  open,
  onOpenChange,
  shareUrl,
  shareText,
  setlistId,
}: SendToFriendDialogProps) => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) {
      setSentTo(new Set());
      return;
    }
    loadFriends();
  }, [open]);

  const loadFriends = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // Get all conversations for this user
    const { data: convos } = await supabase
      .from("conversations")
      .select("id, user_one, user_two")
      .or(`user_one.eq.${user.id},user_two.eq.${user.id}`)
      .order("last_message_at", { ascending: false });

    if (!convos || convos.length === 0) { setLoading(false); return; }

    const otherIds = convos.map((c) =>
      c.user_one === user.id ? c.user_two : c.user_one
    );

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url")
      .in("user_id", otherIds);

    const profileMap = new Map(
      (profiles || []).map((p) => [p.user_id, p])
    );

    setFriends(
      convos.map((c) => {
        const otherId = c.user_one === user.id ? c.user_two : c.user_one;
        const profile = profileMap.get(otherId);
        return {
          conversationId: c.id,
          userId: otherId,
          displayName: profile?.display_name || "Deadhead",
          avatarUrl: profile?.avatar_url || null,
        };
      })
    );
    setLoading(false);
  };

  const sendToFriend = async (friend: Friend) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const message = `${shareText}\n${shareUrl}`;

    const { error } = await supabase.from("direct_messages").insert({
      conversation_id: friend.conversationId,
      sender_id: user.id,
      content: message,
    });

    if (error) {
      toast.error("Couldn't send message");
      return;
    }

    // Update conversation timestamp
    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", friend.conversationId);

    setSentTo((prev) => new Set(prev).add(friend.userId));
    trackShare({ shareType: "setlist", channel: "sms", setlistId, metadata: { via: "in_app_dm" } });
    toast.success(`Sent to ${friend.displayName}!`);
    // Auto-close after a beat so the user sees confirmation and isn't stranded
    setTimeout(() => onOpenChange(false), 900);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-lg flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            Send to a Friend
          </DialogTitle>
        </DialogHeader>

        <div className="mt-2 max-h-64 overflow-y-auto space-y-1">
          {loading && (
            <p className="text-sm text-muted-foreground font-body py-4 text-center">Loading…</p>
          )}

          {!loading && friends.length === 0 && (
            <div className="py-4 text-center space-y-3">
              <p className="text-sm text-muted-foreground font-body">
                No conversations yet.
              </p>
              <a
                href="/browse"
                className="inline-block text-xs font-body text-primary hover:text-primary/80 underline underline-offset-2"
                onClick={() => onOpenChange(false)}
              >
                Find Deadheads on Browse →
              </a>
            </div>
          )}

          {friends.map((friend) => {
            const sent = sentTo.has(friend.userId);
            return (
              <button
                key={friend.userId}
                onClick={() => !sent && sendToFriend(friend)}
                disabled={sent}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-60"
              >
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                  {friend.avatarUrl ? (
                    <img src={friend.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-body text-muted-foreground">
                      {friend.displayName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="font-body text-sm text-foreground flex-1 text-left truncate">
                  {friend.displayName}
                </span>
                {sent ? (
                  <Check className="w-4 h-4 text-accent shrink-0" />
                ) : (
                  <Send className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SendToFriendDialog;
