import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function DispatchSenderPanel() {
  const [busy, setBusy] = useState<"test" | "live" | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [testEmails, setTestEmails] = useState(
    "eljaguaro@gmail.com, jay_cohen@icloud.com",
  );

  async function sendTest() {
    setBusy("test");
    setLastResult(null);
    const list = testEmails
      .split(/[\s,]+/)
      .map((e) => e.trim())
      .filter((e) => e.includes("@"));
    if (list.length === 0) {
      toast.error("No valid email addresses");
      setBusy(null);
      return;
    }
    let sent = 0;
    let failed = 0;
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
        sent += data?.sent_count ?? 0;
        failed += data?.failed_count ?? 0;
      } catch (e: any) {
        failed++;
        toast.error(`Failed: ${email}`, { description: e?.message });
      }
    }
    const summary = `${sent} sent · ${failed} failed (across ${list.length} recipient${list.length === 1 ? "" : "s"})`;
    setLastResult(summary);
    toast.success("Test dispatch complete", { description: summary });
    setBusy(null);
  }

  async function sendLive() {
    if (!window.confirm("Send Dispatch 002 to ALL opted-in users?")) return;
    setBusy("live");
    setLastResult(null);
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
      const summary = `${data?.sent_count ?? 0} sent · ${data?.failed_count ?? 0} failed (of ${data?.recipient_count ?? 0})`;
      setLastResult(summary);
      toast.success("Dispatch sent", { description: summary });
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setLastResult(`Error: ${msg}`);
      toast.error("Dispatch failed", { description: msg });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Send className="w-4 h-4 text-muted-foreground" />
        <h2 className="font-display text-sm text-foreground">Editorial Dispatch 002</h2>
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
          className="font-body"
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
          Send test
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
      {lastResult && (
        <p className="text-sm font-body text-muted-foreground">{lastResult}</p>
      )}
    </div>
  );
}
