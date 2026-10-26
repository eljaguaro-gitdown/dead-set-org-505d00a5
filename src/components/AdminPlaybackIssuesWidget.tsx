/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, Loader2, RotateCcw, Wrench, X, Disc3 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { shortShowDate } from "@/lib/playbackIssues";

/**
 * Tapes fans could not play. Each was apologised for with "we're on it", so
 * this queue is the "on it". The life of an issue:
 *
 *   open      a fan hit it (repeats add to report_count, not new rows)
 *   fixed     someone corrected the data or the code
 *   verified  it has been heard playing — either a SIGNED-IN fan's first real
 *             20s play of that night after it was marked fixed (an anonymous
 *             play counts as evidence but verifies nothing: the anon key is
 *             public), or by hand here. This is
 *             what emails the fans who asked to hear, and puts the names of
 *             those who said yes on Build Notes.
 *   wont_fix  the night genuinely has no tape; nothing to tell anyone
 *
 * A report of a "fixed" issue reopens it: it was not fixed.
 */

const rpc = (fn: string, args?: Record<string, unknown>): PromiseLike<{ data: any; error: any }> =>
  (supabase as unknown as {
    rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: any; error: any }>;
  }).rpc(fn, args);

interface TapeIssue {
  id: string;
  kind: string;
  status: string;
  song_id: string | null;
  song_title: string;
  show_date: string | null;
  archive_url: string | null;
  track_url: string | null;
  report_count: number;
  followers: number;
  credited: number;
  first_reported_at: string;
  last_reported_at: string;
  last_build_sha: string | null;
  fix_note: string | null;
}

const KIND_LABEL: Record<string, string> = {
  not_on_tape: "song not on the tape",
  no_tape: "no tape found",
  wont_play: "tape won't spin",
  none_in_setlist: "nothing in the setlist played",
};

const AdminPlaybackIssuesWidget = ({ enabled }: { enabled: boolean }) => {
  const [issues, setIssues] = useState<TapeIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await rpc("admin_playback_issues", { p_include_closed: false });
    if (error) {
      console.error("[playback issues] load failed:", error);
      toast.error("Couldn't load the tape queue");
    } else {
      setIssues(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load]);

  const setStatus = async (issue: TapeIssue, status: "open" | "fixed" | "verified" | "wont_fix") => {
    let note: string | null = null;
    if (status === "fixed") {
      note = window.prompt("What was wrong, and what fixed it? (kept with the issue)", issue.fix_note ?? "");
      if (note === null) return;
    }
    if (
      status === "verified" &&
      !window.confirm(
        `Mark ${issue.song_title} verified? Only if you have heard it play. ` +
          (issue.followers > 0 ? `${issue.followers} fan(s) get the "it's fixed" email now.` : "Nobody is waiting on it."),
      )
    ) {
      return;
    }
    setBusyId(issue.id);
    const { error } = await rpc("set_playback_issue_status", { p_issue_id: issue.id, p_status: status, p_note: note });
    setBusyId(null);
    if (error) {
      toast.error("Couldn't update that issue");
      return;
    }
    toast.success(
      status === "fixed"
        ? "Marked fixed. It verifies itself when a signed-in fan next plays that night, or mark it verified once you've heard it."
        : status === "verified"
          ? "Verified. The fans who asked are being told."
          : status === "wont_fix"
            ? "Closed"
            : "Reopened",
    );
    void load();
  };

  const open = issues.filter((i) => i.status === "open").length;

  return (
    <div className="bg-card text-card-foreground border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Disc3 className="w-3.5 h-3.5 text-dead-dark" />
        <h2 className="font-display text-sm text-card-foreground">Tapes that wouldn't play</h2>
        <span className="text-xs font-mono text-muted-foreground ml-auto">
          {open} open · {issues.length - open} fixed, awaiting a play
        </span>
      </div>

      {loading ? (
        <div className="p-6 text-center text-sm text-muted-foreground font-body">Loading…</div>
      ) : issues.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-sm text-muted-foreground font-body">Every tap has found its tape. Nothing to chase.</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {issues.map((i) => {
            const busy = busyId === i.id;
            const date = shortShowDate(i.show_date);
            return (
              <div key={i.id} className="px-4 py-3 space-y-1.5">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-body text-sm font-semibold text-card-foreground">
                    {i.song_id ? (
                      <a href={`/song/${i.song_id}`} target="_blank" rel="noreferrer" className="hover:underline">
                        {i.song_title}
                      </a>
                    ) : (
                      i.song_title
                    )}
                    {date ? ` · ${date}` : ""}
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    {KIND_LABEL[i.kind] ?? i.kind}
                  </span>
                  {i.status === "fixed" && (
                    <span className="font-mono text-[11px] uppercase tracking-wider text-dead-dark">fixed · awaiting a play</span>
                  )}
                  <span className="text-[10px] font-mono ml-auto text-muted-foreground">
                    {formatDistanceToNow(new Date(i.last_reported_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-xs font-body text-muted-foreground">
                  {i.report_count} {i.report_count === 1 ? "report" : "reports"} · {i.followers} waiting to hear
                  {i.credited > 0 ? ` · ${i.credited} said yes to credit` : ""}
                  {i.last_build_sha ? ` · build ${i.last_build_sha.slice(0, 7)}` : ""}
                </p>
                {(i.archive_url || i.track_url) && (
                  <p className="text-xs font-mono text-muted-foreground break-all">
                    {i.archive_url && (
                      <a href={i.archive_url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                        {i.archive_url.replace(/^https:\/\/archive\.org\//, "")}
                      </a>
                    )}
                    {i.track_url && !i.archive_url && i.track_url}
                  </p>
                )}
                {i.fix_note && <p className="text-xs font-body text-card-foreground border-l-2 border-border pl-2">{i.fix_note}</p>}
                <div className="flex items-center gap-2 pt-1">
                  {busy ? (
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      {i.status === "open" && (
                        <button
                          onClick={() => void setStatus(i, "fixed")}
                          className="min-h-[36px] px-2.5 flex items-center gap-1.5 text-xs font-body rounded border border-border hover:bg-muted/40"
                        >
                          <Wrench className="w-3.5 h-3.5" /> Mark fixed
                        </button>
                      )}
                      <button
                        onClick={() => void setStatus(i, "verified")}
                        className="min-h-[36px] px-2.5 flex items-center gap-1.5 text-xs font-body rounded border border-border hover:bg-muted/40"
                        title="Only once you have heard it play"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                      </button>
                      {i.status === "fixed" && (
                        <button
                          onClick={() => void setStatus(i, "open")}
                          className="min-h-[36px] px-2.5 flex items-center gap-1.5 text-xs font-body rounded text-muted-foreground hover:bg-muted/40"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Reopen
                        </button>
                      )}
                      <button
                        onClick={() => void setStatus(i, "wont_fix")}
                        className="min-h-[36px] px-2.5 flex items-center gap-1.5 text-xs font-body rounded text-muted-foreground hover:bg-muted/40 ml-auto"
                        title="The night genuinely has no tape"
                      >
                        <X className="w-3.5 h-3.5" /> No tape exists
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

export default AdminPlaybackIssuesWidget;
