import { useEffect, useState } from "react";
import { Megaphone, Send, Trash2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow } from "date-fns";
import type { Announcement } from "@/hooks/useAnnouncements";

const AdminAnnouncementsPanel = () => {
  const { user } = useAuth();
  const [list, setList] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    setList((data as Announcement[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleSubmit = async () => {
    if (!user) return;
    if (!title.trim() || !body.trim()) {
      toast.error("Title and body are required");
      return;
    }
    if ((ctaLabel.trim() && !ctaUrl.trim()) || (ctaUrl.trim() && !ctaLabel.trim())) {
      toast.error("CTA needs both a label and a URL");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("announcements").insert({
      author_id: user.id,
      title: title.trim(),
      body: body.trim(),
      cta_label: ctaLabel.trim() || null,
      cta_url: ctaUrl.trim() || null,
      published: true,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Announcement sent to all users");
    setTitle("");
    setBody("");
    setCtaLabel("");
    setCtaUrl("");
    refresh();
  };

  const togglePublished = async (a: Announcement) => {
    const { error } = await supabase
      .from("announcements")
      .update({ published: !a.published })
      .eq("id", a.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(a.published ? "Hidden from users" : "Re-published");
    refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this announcement permanently?")) return;
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Deleted");
    refresh();
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Megaphone className="w-4 h-4 text-muted-foreground" />
        <h2 className="font-display text-sm text-foreground">Broadcast Announcement</h2>
        <span className="font-mono text-[10px] text-muted-foreground/60 tracking-wider uppercase ml-auto">
          Sent to all signed-in users
        </span>
      </div>

      {/* Composer */}
      <div className="p-4 space-y-3 border-b border-border">
        <Input
          placeholder="Title (e.g. Backstage is open)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="font-body"
          maxLength={120}
        />
        <Textarea
          placeholder="Message body — speak to the community."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          className="font-body"
          maxLength={1000}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            placeholder="CTA label (optional, e.g. Visit Backstage)"
            value={ctaLabel}
            onChange={(e) => setCtaLabel(e.target.value)}
            className="font-body"
            maxLength={40}
          />
          <Input
            placeholder="CTA URL (optional, e.g. /backstage)"
            value={ctaUrl}
            onChange={(e) => setCtaUrl(e.target.value)}
            className="font-body"
            maxLength={500}
          />
        </div>
        <div className="flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={submitting || !title.trim() || !body.trim()}
            className="font-mono text-xs tracking-wider uppercase gap-2"
          >
            <Send className="w-3.5 h-3.5" />
            {submitting ? "Sending…" : "Send to all users"}
          </Button>
        </div>
      </div>

      {/* History */}
      <div>
        <div className="px-4 py-2 text-[10px] font-mono text-muted-foreground tracking-wider uppercase border-b border-border/40">
          Recent ({list.length})
        </div>
        {loading ? (
          <div className="px-4 py-6 text-center font-body text-xs text-muted-foreground">
            Loading…
          </div>
        ) : list.length === 0 ? (
          <div className="px-4 py-6 text-center font-body text-xs text-muted-foreground">
            No announcements yet.
          </div>
        ) : (
          <ul className="divide-y divide-border/40 max-h-[400px] overflow-y-auto">
            {list.map((a) => (
              <li key={a.id} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-display text-sm text-foreground">{a.title}</h4>
                      {!a.published && (
                        <span className="font-mono text-[9px] text-muted-foreground/60 tracking-wider uppercase border border-border rounded px-1.5 py-0.5">
                          Hidden
                        </span>
                      )}
                    </div>
                    <p className="font-body text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">
                      {a.body}
                    </p>
                    {a.cta_label && a.cta_url && (
                      <p className="font-mono text-[10px] text-primary/70 mt-1 tracking-wider">
                        CTA: {a.cta_label} → {a.cta_url}
                      </p>
                    )}
                    <p className="font-mono text-[10px] text-muted-foreground/60 mt-1 tracking-wider uppercase">
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => togglePublished(a)}
                      className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                      title={a.published ? "Hide" : "Re-publish"}
                    >
                      {a.published ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AdminAnnouncementsPanel;
