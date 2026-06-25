import { useState, useEffect, useRef } from "react";
import { MessageCircle, Send, Check, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { trackShare } from "@/lib/trackShare";

interface Recipient {
  // For existing convos we know the conversation id; for fresh recipients
  // we only know the user id and create the convo on send.
  conversationId?: string;
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
  const [recents, setRecents] = useState<Recipient[]>([]);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Recipient[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const meRef = useRef<{ id: string } | null>(null);

  useEffect(() => {
    if (!open) {
      setSentTo(new Set());
      setQuery("");
      setSearchResults([]);
      setNote("");
      return;
    }
    loadRecents();
  }, [open]);

  // Debounced user search
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const me = meRef.current;
      if (!me) return;
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .ilike("display_name", `%${query.trim()}%`)
        .neq("user_id", me.id)
        .limit(8);
      setSearchResults(
        (data || []).map((p) => ({
          userId: p.user_id,
          displayName: p.display_name || "Deadhead",
          avatarUrl: p.avatar_url || null,
        }))
      );
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const loadRecents = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    meRef.current = { id: user.id };

    const { data: convos } = await supabase
      .from("conversations")
      .select("id, user_one, user_two, is_group")
      .or(`user_one.eq.${user.id},user_two.eq.${user.id}`)
      .eq("is_group", false)
      .order("last_message_at", { ascending: false })
      .limit(8);

    if (!convos || convos.length === 0) { setRecents([]); setLoading(false); return; }

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

    setRecents(
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

  const ensureConversation = async (recipient: Recipient, myId: string): Promise<string | null> => {
    if (recipient.conversationId) return recipient.conversationId;

    const [u1, u2] = myId < recipient.userId ? [myId, recipient.userId] : [recipient.userId, myId];

    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_one", u1)
      .eq("user_two", u2)
      .eq("is_group", false)
      .maybeSingle();

    if (existing) return existing.id;

    const conversationId = crypto.randomUUID();
    const { error: createErr } = await supabase
      .from("conversations")
      .insert({ id: conversationId, user_one: u1, user_two: u2, is_group: false });
    if (createErr) return null;

    // Both members must be added explicitly
    const { error: m1 } = await supabase
      .from("conversation_members")
      .insert({ conversation_id: conversationId, user_id: myId });
    if (m1) return null;
    const { error: m2 } = await supabase
      .from("conversation_members")
      .insert({ conversation_id: conversationId, user_id: recipient.userId });
    if (m2) return null;

    return conversationId;
  };

  const sendToRecipient = async (recipient: Recipient) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const conversationId = await ensureConversation(recipient, user.id);
    if (!conversationId) {
      toast.error("Couldn't open conversation");
      return;
    }

    const trimmedNote = note.trim();
    const message = trimmedNote
      ? `${trimmedNote}\n${shareUrl}`
      : `${shareText}\n${shareUrl}`;

    const { error } = await supabase.from("direct_messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: message,
    });

    if (error) {
      toast.error("Couldn't send message");
      return;
    }

    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId);

    // Notify recipient via email if they're not currently online
    try {
      const onlineUserIds = new Set<string>();
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

      if (!onlineUserIds.has(recipient.userId)) {
        const senderProfile = await supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", user.id)
          .maybeSingle();
        const senderName =
          senderProfile.data?.display_name ||
          user.email?.split("@")[0] ||
          "A Deadhead";

        supabase.functions
          .invoke("notify-dm", {
            body: {
              recipientUserId: recipient.userId,
              senderName,
              messagePreview: message.slice(0, 200),
            },
          })
          .catch(() => {});
      }
    } catch {}

    setSentTo((prev) => new Set(prev).add(recipient.userId));
    trackShare({ shareType: "setlist", channel: "sms", setlistId, metadata: { via: "in_app_dm" } });
    toast.success(`Sent to ${recipient.displayName}!`);
    setTimeout(() => onOpenChange(false), 900);
  };

  const list: Recipient[] = query.trim() ? searchResults : recents;
  const listLabel = query.trim() ? "Results" : recents.length ? "Recent" : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-card-foreground max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-lg flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            Send to a Deadhead
          </DialogTitle>
        </DialogHeader>

        <div className="mt-2 space-y-3">
          {/* Optional note */}
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note (optional)…"
            maxLength={200}
            className="bg-background border-border text-foreground font-body text-sm"
          />

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Deadheads by name…"
              className="pl-9 bg-background border-border text-foreground font-body text-sm"
            />
          </div>

          {/* List */}
          <div className="max-h-64 overflow-y-auto -mx-1">
            {listLabel && (
              <p className="px-3 pt-1 pb-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                {listLabel}
              </p>
            )}

            {loading && !query && (
              <p className="text-sm text-muted-foreground font-body py-4 text-center">
                Loading…
              </p>
            )}

            {!loading && list.length === 0 && (
              <div className="py-4 text-center space-y-2">
                <p className="text-sm text-muted-foreground font-body">
                  {query ? "No Deadheads match that name." : "No conversations yet."}
                </p>
                {!query && (
                  <p className="text-[11px] text-muted-foreground/70 font-body">
                    Search above to find any user by name.
                  </p>
                )}
              </div>
            )}

            {list.map((recipient) => {
              const sent = sentTo.has(recipient.userId);
              return (
                <button
                  key={recipient.userId}
                  onClick={() => !sent && sendToRecipient(recipient)}
                  disabled={sent}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-60"
                >
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {recipient.avatarUrl ? (
                      <img src={recipient.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-body text-muted-foreground">
                        {recipient.displayName.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="font-body text-sm text-card-foreground flex-1 text-left truncate">
                    {recipient.displayName}
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
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SendToFriendDialog;
