import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";

type DeliveryStatus = "pending" | "sent" | "failed" | "dlq" | "suppressed" | "bounced" | "complained" | "unknown";

interface RecipientResult {
  email: string;
  messageId?: string;
  status: DeliveryStatus;
  error?: string;
}

interface DispatchEntry {
  id: string;
  subject: string;
  htmlPath: string;
  label: string;
  blurb: string;
}

// Registered dispatches — the html_path must exist in send-dispatch's
// DISPATCH_HTML map (see supabase/functions/send-dispatch/index.ts). Add a new
// entry here after registering the corresponding dispatch_NNN.ts module.
// Newest first.
const DISPATCHES: DispatchEntry[] = [
  {
    id: "003",
    subject: "Firsts & Lasts — a letter from the lab",
    htmlPath: "dispatches/003.html",
    label: "003 · Firsts & Lasts",
    blurb: "Community update + FTP/LTP launch, with a shout to Philly Bob.",
  },
  {
    id: "002",
    subject: "We are finding each other",
    htmlPath: "dispatches/002.html",
    label: "002 · We are finding each other",
    blurb: "Editorial — the community loop, Nightfall of Diamonds, score-by-date.",
  },
];

const TERMINAL = new Set<DeliveryStatus>(["sent", "failed", "dlq", "suppressed", "bounced", "complained"]);

async function pollDelivery(messageIds: string[], timeoutMs = 45000): Promise<Record<string, { status: DeliveryStatus; error?: string }>> {
  const result: Record<string, { status: DeliveryStatus; error?: string }> = {};
  for (const id of messageIds) result[id] = { status: "pending" };
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const pending = messageIds.filter((id) => !TERMINAL.has(result[id].status));
    if (pending.length === 0) break;

    const { data } = await supabase
      .from("email_send_log")
      .select("message_id,status,error_message,created_at")
      .in("message_id", pending)
      .order("created_at", { ascending: false });

    if (data) {
      const seen = new Set<string>();
      for (const row of data) {
        if (!row.message_id || seen.has(row.message_id)) continue;
        seen.add(row.message_id);
        result[row.message_id] = {
          status: (row.status as DeliveryStatus) ?? "unknown",
          error: row.error_message ?? undefined,
        };
      }
    }
    if (messageIds.every((id) => TERMINAL.has(result[id].status))) break;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return result;
}

function StatusBadge({ status }: { status: DeliveryStatus }) {
  const isOk = status === "sent";
  const isPending = status === "pending" || status === "unknown";
  const Icon = isOk ? CheckCircle2 : isPending ? Clock : XCircle;
  const cls = isOk
    ? "text-emerald-700"
    : isPending
      ? "text-muted-foreground"
      : "text-destructive";
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-body ${cls}`}>
      <Icon className="w-3.5 h-3.5" />
      {status}
    </span>
  );
}

export default function DispatchSenderPanel() {
  const [busy, setBusy] = useState<"test" | "live" | null>(null);
  const [results, setResults] = useState<RecipientResult[]>([]);
  const [testEmails, setTestEmails] = useState("");
  const [selectedId, setSelectedId] = useState<string>(DISPATCHES[0].id);
  const [subjectOverride, setSubjectOverride] = useState<string>("");

  const selected = useMemo(
    () => DISPATCHES.find((d) => d.id === selectedId) ?? DISPATCHES[0],
    [selectedId],
  );
  const effectiveSubject = subjectOverride.trim() || selected.subject;

  async function sendTest() {
    setBusy("test");
    setResults([]);
    const list = testEmails
      .split(/[\s,]+/)
      .map((e) => e.trim())
      .filter((e) => e.includes("@"));
    if (list.length === 0) {
      toast.error("No valid email addresses");
      setBusy(null);
      return;
    }

    const initial: RecipientResult[] = list.map((email) => ({ email, status: "pending" }));
    setResults(initial);

    const enqueued: RecipientResult[] = [];
    for (const email of list) {
      try {
        const { data, error } = await supabase.functions.invoke("send-dispatch", {
          body: {
            dispatch_id: selected.id,
            subject: effectiveSubject,
            html_path: selected.htmlPath,
            test_mode: true,
            test_recipient: email,
          },
        });
        if (error) throw error;
        const r = data?.results?.[0];
        enqueued.push({
          email,
          messageId: r?.id,
          status: r?.status === "failed" ? "failed" : "pending",
          error: r?.status === "failed" ? "Enqueue failed" : undefined,
        });
      } catch (e: any) {
        enqueued.push({ email, status: "failed", error: e?.message ?? String(e) });
      }
    }
    setResults([...enqueued]);

    const ids = enqueued.map((r) => r.messageId).filter((x): x is string => !!x);
    if (ids.length > 0) {
      const delivery = await pollDelivery(ids);
      const merged = enqueued.map((r) =>
        r.messageId && delivery[r.messageId]
          ? { ...r, status: delivery[r.messageId].status, error: delivery[r.messageId].error }
          : r,
      );
      setResults(merged);
      const okCount = merged.filter((r) => r.status === "sent").length;
      const failCount = merged.filter((r) => r.status !== "sent" && r.status !== "pending").length;
      toast[okCount === merged.length ? "success" : "warning" as any]?.("Test dispatch results", {
        description: `${okCount} delivered · ${failCount} failed · ${merged.length - okCount - failCount} pending`,
      }) ?? toast.success("Test dispatch results", { description: `${okCount} delivered · ${failCount} failed` });
    }
    setBusy(null);
  }

  async function sendLive() {
    if (!window.confirm(`Send Dispatch ${selected.id} ("${effectiveSubject}") to ALL opted-in users?`)) return;
    setBusy("live");
    setResults([]);
    try {
      const { data, error } = await supabase.functions.invoke("send-dispatch", {
        body: {
          dispatch_id: selected.id,
          subject: effectiveSubject,
          html_path: selected.htmlPath,
          test_mode: false,
        },
      });
      if (error) throw error;
      toast.success("Dispatch enqueued", {
        description: `${data?.sent_count ?? 0} queued · ${data?.failed_count ?? 0} failed (of ${data?.recipient_count ?? 0})`,
      });
    } catch (e: any) {
      toast.error("Dispatch failed", { description: e?.message ?? String(e) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Send className="w-4 h-4 text-muted-foreground" />
        <h2 className="font-display text-sm text-card-foreground">Editorial Dispatch</h2>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-muted-foreground font-body block">
          Which dispatch
        </label>
        <select
          value={selectedId}
          onChange={(e) => {
            setSelectedId(e.target.value);
            setSubjectOverride("");
          }}
          disabled={busy !== null}
          className="w-full h-9 rounded-md border border-input bg-secondary text-card-foreground px-3 text-sm font-body focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {DISPATCHES.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground font-body">
          {selected.blurb} Sends from noreply@notify.dead-set.org (replies go to grateful_jaguaro@dead-set.org).
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-muted-foreground font-body block">
          Subject line <span className="text-xs opacity-70">(override for this send only — leave blank to use default)</span>
        </label>
        <Input
          value={subjectOverride}
          onChange={(e) => setSubjectOverride(e.target.value)}
          placeholder={selected.subject}
          disabled={busy !== null}
          className="font-body bg-secondary text-card-foreground"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm text-muted-foreground font-body block">
          Test recipients (comma-separated)
        </label>
        <Input
          value={testEmails}
          onChange={(e) => setTestEmails(e.target.value)}
          placeholder="email1@example.com, email2@example.com"
          disabled={busy !== null}
          className="font-body bg-secondary text-card-foreground"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={sendTest}
          disabled={busy !== null}
          className="font-body"
        >
          {busy === "test" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
          Send test & verify delivery
        </Button>
        <Button
          size="sm"
          onClick={sendLive}
          disabled={busy !== null}
          className="font-body"
        >
          {busy === "live" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
          Send Dispatch {selected.id} to everyone
        </Button>
      </div>

      {results.length > 0 && (
        <div className="border-t border-border pt-3 space-y-2">
          <p className="text-sm font-body text-muted-foreground">
            Provider delivery status
            {busy === "test" && " (polling…)"}
          </p>
          <ul className="space-y-1.5">
            {results.map((r) => (
              <li key={r.email} className="flex items-start justify-between gap-3 text-sm font-body">
                <span className="text-card-foreground truncate">{r.email}</span>
                <div className="flex flex-col items-end gap-0.5">
                  <StatusBadge status={r.status} />
                  {r.error && (
                    <span className="text-sm text-destructive max-w-xs text-right break-words">
                      {r.error}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
