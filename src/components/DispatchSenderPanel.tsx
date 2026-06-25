import { useState } from "react";
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
      // latest row per message_id wins
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
    ? "text-emerald-500"
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
  const [testEmails, setTestEmails] = useState(
    "eljaguaro@gmail.com, jay_cohen@icloud.com",
  );

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

    // Enqueue each test recipient and capture message_id from edge function
    const enqueued: RecipientResult[] = [];
    for (const email of list) {
      try {
        const { data, error } = await supabase.functions.invoke("send-dispatch", {
          body: {
            dispatch_id: "002",
            subject: "We are finding each other",
            html_path: "dispatches/002.html",
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

    // Poll provider delivery status
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
    if (!window.confirm("Send Dispatch 002 to ALL opted-in users?")) return;
    setBusy("live");
    setResults([]);
    try {
      const { data, error } = await supabase.functions.invoke("send-dispatch", {
        body: {
          dispatch_id: "002",
          subject: "We are finding each other",
          html_path: "dispatches/002.html",
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
        <h2 className="font-display text-sm text-card-foreground">Editorial Dispatch 002</h2>
      </div>
      <p className="text-sm text-muted-foreground font-body">
        "We are finding each other" — sends from noreply@notify.dead-set.org (replies go to grateful_jaguaro@dead-set.org).
      </p>
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground font-body block">
          Test recipients (comma-separated)
        </label>
        <Input
          value={testEmails}
          onChange={(e) => setTestEmails(e.target.value)}
          placeholder="email1@example.com, email2@example.com"
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
          Send to everyone
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
                    <span className="text-sm text-destructive/80 max-w-xs text-right break-words">
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
