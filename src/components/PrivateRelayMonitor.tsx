import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Apple, CheckCircle2, AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RelayUser {
  user_id: string;
  email: string;
  display_name: string | null;
  signed_up_at: string;
  welcome_status: string | null;
  welcome_sent_at: string | null;
  welcome_error: string | null;
}

const RELAY_DOMAIN = "@privaterelay.appleid.com";

const PrivateRelayMonitor = () => {
  const [rows, setRows] = useState<RelayUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      // 1. Get all relay users from auth (via admin-users edge function)
      const { data: usersData } = await supabase.functions.invoke("admin-users");
      const allUsers: Array<{ id: string; email: string; createdAt: string; displayName: string | null }> =
        usersData?.users ?? [];
      const relayUsers = allUsers.filter((u) => u.email?.toLowerCase().endsWith(RELAY_DOMAIN));

      if (relayUsers.length === 0) {
        setRows([]);
        return;
      }

      // 2. Fetch latest welcome-email log entry per recipient
      const emails = relayUsers.map((u) => u.email);
      const { data: logs } = await supabase
        .from("email_send_log")
        .select("recipient_email, status, error_message, created_at")
        .eq("template_name", "welcome-email")
        .in("recipient_email", emails)
        .order("created_at", { ascending: false });

      const latest = new Map<string, { status: string; error_message: string | null; created_at: string }>();
      for (const log of logs ?? []) {
        const key = log.recipient_email.toLowerCase();
        if (!latest.has(key)) {
          latest.set(key, {
            status: log.status,
            error_message: log.error_message,
            created_at: log.created_at,
          });
        }
      }

      const merged: RelayUser[] = relayUsers.map((u) => {
        const log = latest.get(u.email.toLowerCase());
        return {
          user_id: u.id,
          email: u.email,
          display_name: u.displayName,
          signed_up_at: u.createdAt,
          welcome_status: log?.status ?? null,
          welcome_sent_at: log?.created_at ?? null,
          welcome_error: log?.error_message ?? null,
        };
      });

      merged.sort((a, b) => +new Date(b.signed_up_at) - +new Date(a.signed_up_at));
      setRows(merged);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const sent = rows.filter((r) => r.welcome_status === "sent").length;
  const failed = rows.filter((r) => r.welcome_status && r.welcome_status !== "sent").length;
  const missing = rows.filter((r) => !r.welcome_status).length;

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Apple className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-display text-sm text-card-foreground">Apple Private Relay — Welcome Email Delivery</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={load}
          disabled={refreshing}
          className="h-8 px-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {loading ? (
        <div className="p-8 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="p-6 text-sm text-muted-foreground text-center">
          No Apple Private Relay users yet.
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3 p-4 border-b border-border">
            <div className="text-center">
              <div className="text-2xl font-display text-primary">{rows.length}</div>
              <div className="text-sm text-muted-foreground">Relay Users</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-display text-emerald-700">{sent}</div>
              <div className="text-sm text-muted-foreground">Welcome Sent</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-display ${failed + missing > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                {failed + missing}
              </div>
              <div className="text-sm text-muted-foreground">Failed / Missing</div>
            </div>
          </div>

          {/* Per-user table */}
          <div className="divide-y divide-border">
            {rows.map((r) => {
              const ok = r.welcome_status === "sent";
              return (
                <div key={r.user_id} className="p-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 md:items-center">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {ok ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                      )}
                      <span className="text-sm font-medium text-card-foreground truncate">
                        {r.display_name || "(no name)"}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground font-mono truncate mt-1">
                      {r.email}
                    </div>
                    {r.welcome_error && (
                      <div className="text-sm text-destructive mt-1">
                        Error: {r.welcome_error}
                      </div>
                    )}
                    {!r.welcome_status && (
                      <div className="text-sm text-amber-800 mt-1">
                        No welcome email log entry found.
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground md:text-right shrink-0">
                    <div>Signup: {new Date(r.signed_up_at).toLocaleString()}</div>
                    {r.welcome_sent_at && (
                      <div>Welcome: {new Date(r.welcome_sent_at).toLocaleString()}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-4 py-3 border-t border-border bg-muted/20">
            <p className="text-sm text-muted-foreground">
              <strong className="text-card-foreground">Note:</strong> "Sent" confirms the email left our server and was accepted by Apple's relay.
              Apple then forwards it to the user's real inbox — that handoff is invisible to us, but a successful "sent" status with no
              bounce/suppression entry means delivery is working as expected.
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default PrivateRelayMonitor;
