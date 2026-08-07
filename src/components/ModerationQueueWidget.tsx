import { useCallback, useEffect, useState } from "react";
import { Flag, Check, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// content_reports is newer than the generated Database types — regenerate
// src/integrations/supabase/types.ts via the Supabase CLI to drop this cast.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface Report {
  id: string;
  reporter_id: string;
  content_type: string;
  content_id: string;
  reason: string | null;
  status: string;
  created_at: string;
}

const contentLink = (r: Report): string | null => {
  if (r.content_type === "setlist") return `/setlist/${r.content_id}`;
  if (r.content_type === "profile") return `/user/${r.content_id}`;
  return null;
};

/** Admin-only: open content reports with resolve/dismiss actions. */
const ModerationQueueWidget = ({ enabled }: { enabled: boolean }) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await db
      .from("content_reports")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: true })
      .limit(50);
    if (!error) setReports(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);

  const settle = async (id: string, status: "resolved" | "dismissed") => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await db
      .from("content_reports")
      .update({ status, resolved_at: new Date().toISOString(), resolved_by: user?.id ?? null })
      .eq("id", id);
    if (error) {
      toast.error("Couldn't update the report");
      return;
    }
    setReports((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Flag className="w-3.5 h-3.5 text-dead-gold" />
        <h2 className="font-display text-sm text-card-foreground">Moderation Queue</h2>
        <span className="text-xs font-mono text-muted-foreground ml-auto">
          {reports.length} open
        </span>
      </div>

      {loading ? (
        <div className="p-6 text-center text-sm text-muted-foreground font-body">Loading…</div>
      ) : reports.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-sm text-muted-foreground font-body">
            Nothing reported. The lot is peaceful.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {reports.map((r) => {
            const link = contentLink(r);
            return (
              <div key={r.id} className="px-4 py-3 flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-body text-card-foreground">
                    <span className="font-mono text-xs uppercase tracking-wider text-dead-gold">
                      {r.content_type}
                    </span>{" "}
                    {link ? (
                      <a href={link} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-primary">
                        view content
                      </a>
                    ) : (
                      <span className="font-mono text-[10px] text-muted-foreground">{r.content_id}</span>
                    )}
                  </p>
                  {r.reason && (
                    <p className="text-xs font-body text-muted-foreground mt-0.5 break-words">
                      "{r.reason}"
                    </p>
                  )}
                  <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-1">
                  <button
                    onClick={() => settle(r.id, "resolved")}
                    className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center text-emerald-600 hover:bg-emerald-600/10 rounded"
                    title="Mark resolved (action taken)"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => settle(r.id, "dismissed")}
                    className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center text-muted-foreground hover:bg-muted/40 rounded"
                    title="Dismiss (no action needed)"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ModerationQueueWidget;
