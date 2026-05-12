import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function DispatchSenderPanel() {
  const [busy, setBusy] = useState<"test" | "live" | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  async function run(testMode: boolean) {
    setBusy(testMode ? "test" : "live");
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("send-dispatch", {
        body: {
          dispatch_id: "002",
          subject: "We are finding each other",
          html_path: "dispatches/002.html",
          test_mode: testMode,
          test_recipient: testMode ? "grateful_jaguaro@dead-set.org" : undefined,
        },
      });
      if (error) throw error;
      const summary = `${data?.sent_count ?? 0} sent · ${data?.failed_count ?? 0} failed (of ${data?.recipient_count ?? 0})`;
      setLastResult(summary);
      toast.success(testMode ? "Test dispatch sent" : "Dispatch sent", {
        description: summary,
      });
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setLastResult(`Error: ${msg}`);
      toast.error("Dispatch failed", { description: msg });
    } finally {
      setBusy(null);
    }
  }

  async function confirmAndSend() {
    if (!window.confirm("Send Dispatch 002 to ALL opted-in users?")) return;
    await run(false);
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Send className="w-4 h-4 text-muted-foreground" />
        <h2 className="font-display text-sm text-foreground">Editorial Dispatch 002</h2>
      </div>
      <p className="text-sm text-muted-foreground font-body">
        "We are finding each other" — sends from grateful_jaguaro@dead-set.org.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => run(true)}
          disabled={busy !== null}
          className="font-body"
        >
          {busy === "test" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
          Test send to me
        </Button>
        <Button
          size="sm"
          onClick={confirmAndSend}
          disabled={busy !== null}
          className="font-body"
        >
          {busy === "live" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
          Send to everyone
        </Button>
      </div>
      {lastResult && (
        <p className="text-sm font-body text-muted-foreground">{lastResult}</p>
      )}
    </div>
  );
}
