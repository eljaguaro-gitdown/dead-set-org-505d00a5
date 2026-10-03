import { useCallback, useEffect, useState } from "react";
import { Flag, Trash2, Ban, X, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Reports come through the admin-users edge function (action=reports) rather
// than straight from content_reports: the queue needs the reported text and
// its author, and a direct message is not readable through RLS by anyone
// outside the conversation. Removing and banning go through the same function
// (action=moderate), because a ban needs the auth admin API.
//
// App Store guideline 1.2: act within 24 hours of a report by removing the
// content and ejecting the user. Every report also emails the admins the
// moment it is filed (notify_moderation_report trigger).

interface Report {
  id: string;
  contentType: string;
  contentId: string;
  reason: string | null;
  createdAt: string;
  ownerId: string | null;
  ownerName: string | null;
  excerpt: string | null;
  link: string | null;
  gone: boolean;
}

type Decision = "dismiss" | "remove" | "remove_and_ban";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Admin-only: open content reports, with remove / ban / dismiss. */
const ModerationQueueWidget = ({ enabled }: { enabled: boolean }) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("admin-users?action=reports");
    if (error || data?.error) {
      console.error("[moderation] load failed:", error ?? data?.error);
      toast.error("Couldn't load the moderation queue");
    } else {
      setReports(data.reports ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);

  const decide = async (report: Report, decision: Decision) => {
    if (
      decision === "remove_and_ban" &&
      !window.confirm(
        `Remove this ${report.contentType} and ban ${report.ownerName || "this account"}? ` +
          "They won't be able to sign in, and all their setlists come off the feeds.",
      )
    ) {
      return;
    }
    setBusyId(report.id);
    const { data, error } = await supabase.functions.invoke("admin-users?action=moderate", {
      body: { reportId: report.id, decision },
    });
    setBusyId(null);
    if (error || data?.error) {
      toast.error(data?.error || "Couldn't apply that decision");
      return;
    }
    toast.success(
      decision === "dismiss" ? "Dismissed" : decision === "remove" ? "Removed" : "Removed and banned",
    );
    // Settling one report settles every open report on the same content, and
    // a ban settles the reports on that account — reload rather than guess.
    load();
  };

  return (
    <div className="bg-card text-card-foreground border border-border rounded-lg overflow-hidden">
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
            const overdue = Date.now() - new Date(r.createdAt).getTime() > DAY_MS;
            const busy = busyId === r.id;
            return (
              <div key={r.id} className="px-4 py-3 space-y-2">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-mono text-xs uppercase tracking-wider text-dead-gold">
                    {r.contentType}
                  </span>
                  <span className="text-xs font-body text-card-foreground">
                    by{" "}
                    {r.ownerId ? (
                      <a
                        href={`/user/${r.ownerId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-2 hover:text-primary"
                      >
                        {r.ownerName || "Unknown Head"}
                      </a>
                    ) : (
                      "—"
                    )}
                  </span>
                  <span
                    className={`text-[10px] font-mono ml-auto ${overdue ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}
                    {overdue && " · past 24h"}
                  </span>
                </div>

                {r.gone ? (
                  <p className="text-xs font-body italic text-muted-foreground">
                    Already gone — deleted by its author or removed earlier.
                  </p>
                ) : r.excerpt ? (
                  <p className="text-sm font-body text-card-foreground border-l-2 border-border pl-2 break-words">
                    {r.link ? (
                      <a href={r.link} target="_blank" rel="noreferrer" className="hover:underline">
                        {r.excerpt}
                      </a>
                    ) : (
                      r.excerpt
                    )}
                  </p>
                ) : null}

                {r.reason && (
                  <p className="text-xs font-body text-muted-foreground break-words">
                    Reporter: "{r.reason}"
                  </p>
                )}

                <div className="flex items-center gap-2 pt-1">
                  {busy ? (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      {!r.gone && (
                        <button
                          onClick={() => decide(r, "remove")}
                          className="min-h-[36px] px-2.5 flex items-center gap-1.5 text-xs font-body rounded border border-border hover:bg-muted/40"
                          title="Remove the content, keep the account"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remove
                        </button>
                      )}
                      {r.ownerId && (
                        <button
                          onClick={() => decide(r, "remove_and_ban")}
                          className="min-h-[36px] px-2.5 flex items-center gap-1.5 text-xs font-body rounded border border-destructive/50 text-destructive hover:bg-destructive/10"
                          title="Remove the content and ban the account"
                        >
                          <Ban className="w-3.5 h-3.5" /> Remove + ban
                        </button>
                      )}
                      <button
                        onClick={() => decide(r, "dismiss")}
                        className="min-h-[36px] px-2.5 flex items-center gap-1.5 text-xs font-body rounded text-muted-foreground hover:bg-muted/40 ml-auto"
                        title="No action needed"
                      >
                        <X className="w-3.5 h-3.5" /> Dismiss
                      </button>
                    </>
                  )}
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
