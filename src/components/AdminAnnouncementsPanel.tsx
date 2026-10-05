import { useEffect, useState } from "react";
import { Megaphone, Send, Trash2, Eye, EyeOff, Pencil, X, FileText } from "lucide-react";
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
  /**
   * Which announcement the composer is editing, if any.
   *
   * Drafts arrive here from the draft_songbook_announcement trigger, which
   * writes words generated from a Songbook entry rather than written by
   * anyone. Without this the only two options were publish-verbatim or retype,
   * which is not a review step.
   */
  const [editingId, setEditingId] = useState<string | null>(null);

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

  const handleSubmit = async (publish: boolean) => {
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
    const fields = {
      title: title.trim(),
      body: body.trim(),
      cta_label: ctaLabel.trim() || null,
      cta_url: ctaUrl.trim() || null,
      published: publish,
    };
    // Editing updates the row in place so a reviewed draft keeps its identity
    // instead of leaving the original behind to be deleted by hand.
    const { error } = editingId
      ? await supabase.from("announcements").update(fields).eq("id", editingId)
      : await supabase.from("announcements").insert({ ...fields, author_id: user.id });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      publish
        ? "Announcement sent to all users"
        : "Saved as a draft — nothing sent",
    );
    clearComposer();
    refresh();
  };

  const startEditing = (a: Announcement) => {
    setEditingId(a.id);
    setTitle(a.title);
    setBody(a.body);
    setCtaLabel(a.cta_label || "");
    setCtaUrl(a.cta_url || "");
  };

  const clearComposer = () => {
    setEditingId(null);
    setTitle("");
    setBody("");
    setCtaLabel("");
    setCtaUrl("");
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
        <h2 className="font-display text-sm text-card-foreground">Broadcast Announcement</h2>
        <span className="font-mono text-[10px] text-muted-foreground tracking-wider uppercase ml-auto">
          Sent to all signed-in users
        </span>
      </div>

      {/* Composer */}
      <div className="p-4 space-y-3 border-b border-border">
        <Input
          placeholder="Title (e.g. Backstage is open)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="font-body bg-secondary text-card-foreground"
          maxLength={120}
        />
        <Textarea
          placeholder="Message body — speak to the community."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          className="font-body bg-secondary text-card-foreground"
          maxLength={1000}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            placeholder="CTA label (optional, e.g. Visit Backstage)"
            value={ctaLabel}
            onChange={(e) => setCtaLabel(e.target.value)}
            className="font-body bg-secondary text-card-foreground"
            maxLength={40}
          />
          <Input
            placeholder="CTA URL (optional, e.g. /backstage)"
            value={ctaUrl}
            onChange={(e) => setCtaUrl(e.target.value)}
            className="font-body bg-secondary text-card-foreground"
            maxLength={500}
          />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {editingId && (
            <button
              type="button"
              onClick={clearComposer}
              className="mr-auto flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground hover:text-card-foreground tracking-wider uppercase transition-colors"
            >
              <X className="w-3 h-3" />
              Cancel edit
            </button>
          )}
          {/* Saving without sending is the whole point of a draft: the words
              the trigger generated can be rewritten and left unpublished. */}
          <Button
            variant="outline"
            onClick={() => handleSubmit(false)}
            disabled={submitting || !title.trim() || !body.trim()}
            className="font-mono text-xs tracking-wider uppercase gap-2"
          >
            <FileText className="w-3.5 h-3.5" />
            {submitting ? "Saving…" : "Save draft"}
          </Button>
          <Button
            onClick={() => handleSubmit(true)}
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
                      <h4 className="font-display text-sm text-card-foreground">{a.title}</h4>
                      {!a.published && (
                        <span className="font-mono text-[9px] text-muted-foreground tracking-wider uppercase border border-border rounded px-1.5 py-0.5">
                          Draft — not sent
                        </span>
                      )}
                    </div>
                    <p className="font-body text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">
                      {a.body}
                    </p>
                    {a.cta_label && a.cta_url && (
                      <p className="font-mono text-[10px] text-accent-foreground mt-1 tracking-wider">
                        CTA: {a.cta_label} → {a.cta_url}
                      </p>
                    )}
                    <p className="font-mono text-[10px] text-muted-foreground mt-1 tracking-wider uppercase">
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => startEditing(a)}
                      className={`p-1.5 transition-colors ${
                        editingId === a.id
                          ? "text-accent-foreground"
                          : "text-muted-foreground hover:text-card-foreground"
                      }`}
                      title="Edit in the composer above"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => togglePublished(a)}
                      className="p-1.5 text-muted-foreground hover:text-card-foreground transition-colors"
                      title={a.published ? "Hide from users" : "Send to all users as-is"}
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
