import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Mail, AlertTriangle, TrendingDown, TrendingUp, Loader2 } from "lucide-react";

type LogRow = {
  message_id: string | null;
  template_name: string;
  recipient_email: string;
  status: string;
  error_message: string | null;
  created_at: string;
};

type Window = "24h" | "7d" | "30d";

const WINDOWS: { id: Window; label: string; ms: number; buckets: number; bucketMs: number }[] = [
  { id: "24h", label: "Last 24h", ms: 86_400_000, buckets: 24, bucketMs: 3_600_000 },
  { id: "7d", label: "Last 7d", ms: 7 * 86_400_000, buckets: 7, bucketMs: 86_400_000 },
  { id: "30d", label: "Last 30d", ms: 30 * 86_400_000, buckets: 30, bucketMs: 86_400_000 },
];

// Industry deliverability thresholds (Postmaster guidelines)
const THRESHOLDS = {
  bounceWarn: 2, // %
  bounceCritical: 5,
  complaintWarn: 0.1,
  complaintCritical: 0.3,
  failWarn: 5,
  failCritical: 10,
};

const STATUS_TONE: Record<string, string> = {
  sent: "text-emerald-700",
  bounced: "text-destructive",
  dlq: "text-destructive",
  failed: "text-destructive",
  complained: "text-destructive",
  suppressed: "text-amber-800",
  pending: "text-muted-foreground",
};

function dedupeLatest(rows: LogRow[]): LogRow[] {
  const map = new Map<string, LogRow>();
  for (const r of rows) {
    if (!r.message_id) continue;
    const prev = map.get(r.message_id);
    if (!prev || new Date(r.created_at) > new Date(prev.created_at)) {
      map.set(r.message_id, r);
    }
  }
  return Array.from(map.values());
}

export default function DeliverabilityMonitor() {
  const [windowId, setWindowId] = useState<Window>("7d");
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const win = WINDOWS.find((w) => w.id === windowId)!;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const since = new Date(Date.now() - win.ms).toISOString();
    supabase
      .from("email_send_log")
      .select("message_id, template_name, recipient_email, status, error_message, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Deliverability fetch error", error);
          setRows([]);
        } else {
          setRows((data as LogRow[]) || []);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [windowId, win.ms]);

  const stats = useMemo(() => {
    const latest = dedupeLatest(rows);
    const total = latest.length;
    const by = (s: string) => latest.filter((r) => r.status === s).length;
    const sent = by("sent");
    const bounced = by("bounced");
    const complained = by("complained");
    const dlq = by("dlq") + by("failed");
    const suppressed = by("suppressed");
    const delivered = sent; // proxy for inbox/delivered
    const pct = (n: number) => (total === 0 ? 0 : (n / total) * 100);
    return {
      total,
      sent,
      delivered,
      bounced,
      complained,
      dlq,
      suppressed,
      bounceRate: pct(bounced),
      complaintRate: pct(complained),
      failRate: pct(dlq),
      deliveryRate: pct(delivered),
    };
  }, [rows]);

  // Time-series buckets
  const series = useMemo(() => {
    const latest = dedupeLatest(rows);
    const now = Date.now();
    const start = now - win.ms;
    const buckets = Array.from({ length: win.buckets }, (_, i) => ({
      t: start + i * win.bucketMs,
      total: 0,
      sent: 0,
      bounced: 0,
      dlq: 0,
    }));
    for (const r of latest) {
      const t = new Date(r.created_at).getTime();
      const idx = Math.floor((t - start) / win.bucketMs);
      if (idx < 0 || idx >= buckets.length) continue;
      buckets[idx].total++;
      if (r.status === "sent") buckets[idx].sent++;
      else if (r.status === "bounced") buckets[idx].bounced++;
      else if (r.status === "dlq" || r.status === "failed") buckets[idx].dlq++;
    }
    return buckets;
  }, [rows, win]);

  // Alerts: compare last bucket vs prior average; also flag absolute thresholds
  const alerts = useMemo(() => {
    const out: { level: "critical" | "warn"; message: string }[] = [];
    if (stats.bounceRate >= THRESHOLDS.bounceCritical)
      out.push({ level: "critical", message: `Bounce rate ${stats.bounceRate.toFixed(1)}% exceeds 5% — pause sends and review list hygiene.` });
    else if (stats.bounceRate >= THRESHOLDS.bounceWarn)
      out.push({ level: "warn", message: `Bounce rate ${stats.bounceRate.toFixed(1)}% above 2% — monitor closely.` });

    if (stats.complaintRate >= THRESHOLDS.complaintCritical)
      out.push({ level: "critical", message: `Spam complaint rate ${stats.complaintRate.toFixed(2)}% exceeds 0.3% — Gmail/Yahoo will throttle.` });
    else if (stats.complaintRate >= THRESHOLDS.complaintWarn)
      out.push({ level: "warn", message: `Spam complaints ${stats.complaintRate.toFixed(2)}% above 0.1%.` });

    if (stats.failRate >= THRESHOLDS.failCritical)
      out.push({ level: "critical", message: `Hard failure rate ${stats.failRate.toFixed(1)}% — check provider status and queue health.` });
    else if (stats.failRate >= THRESHOLDS.failWarn)
      out.push({ level: "warn", message: `Failure rate ${stats.failRate.toFixed(1)}% elevated.` });

    // Spike detection: compare last bucket failures+bounces vs prior 6 avg
    const last = series[series.length - 1];
    const prior = series.slice(Math.max(0, series.length - 7), series.length - 1);
    if (last && prior.length >= 3) {
      const lastBad = last.bounced + last.dlq;
      const priorBadAvg = prior.reduce((s, b) => s + b.bounced + b.dlq, 0) / prior.length;
      if (lastBad >= 3 && lastBad >= priorBadAvg * 3) {
        out.push({
          level: "warn",
          message: `Bounce/failure spike detected: ${lastBad} in latest bucket vs avg ${priorBadAvg.toFixed(1)}.`,
        });
      }
    }
    return out;
  }, [stats, series]);

  const recentFailures = useMemo(
    () =>
      dedupeLatest(rows)
        .filter((r) => ["bounced", "dlq", "failed", "complained"].includes(r.status))
        .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
        .slice(0, 10),
    [rows]
  );

  const maxBucketTotal = Math.max(1, ...series.map((b) => b.total));

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2 flex-wrap">
        <Mail className="w-4 h-4 text-muted-foreground" />
        <h2 className="font-display text-sm text-card-foreground">Email Deliverability</h2>
        <div className="ml-auto flex gap-1">
          {WINDOWS.map((w) => (
            <button
              key={w.id}
              onClick={() => setWindowId(w.id)}
              className={`px-2 py-1 text-xs rounded font-body border transition-colors ${
                windowId === w.id
                  ? "bg-primary/15 border-primary/40 text-accent-foreground"
                  : "border-border text-muted-foreground hover:text-card-foreground"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-8 flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading deliverability data…
        </div>
      ) : (
        <div className="p-4 space-y-5">
          {/* Alerts */}
          {alerts.length > 0 && (
            <div className="space-y-2">
              {alerts.map((a, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 rounded-lg border p-3 text-sm font-body ${
                    a.level === "critical"
                      ? "border-destructive/40 bg-destructive/10 text-destructive"
                      : "border-amber-400/40 bg-amber-400/10 text-amber-800"
                  }`}
                >
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{a.message}</span>
                </div>
              ))}
            </div>
          )}
          {alerts.length === 0 && stats.total > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm font-body text-emerald-700">
              <TrendingUp className="w-4 h-4" />
              All deliverability signals within healthy thresholds.
            </div>
          )}

          {/* Stat grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Stat label="Total Sent" value={stats.total} />
            <Stat label="Delivered" value={`${stats.deliveryRate.toFixed(1)}%`} sub={`${stats.delivered}`} tone="text-emerald-700" />
            <Stat label="Bounced" value={`${stats.bounceRate.toFixed(2)}%`} sub={`${stats.bounced}`} tone={stats.bounceRate >= THRESHOLDS.bounceWarn ? "text-destructive" : undefined} />
            <Stat label="Complaints" value={`${stats.complaintRate.toFixed(2)}%`} sub={`${stats.complained}`} tone={stats.complaintRate >= THRESHOLDS.complaintWarn ? "text-destructive" : undefined} />
            <Stat label="Failed (DLQ)" value={`${stats.failRate.toFixed(1)}%`} sub={`${stats.dlq}`} tone={stats.failRate >= THRESHOLDS.failWarn ? "text-destructive" : undefined} />
          </div>

          {/* Sparkline-style chart */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground font-body uppercase tracking-wider">
                Volume over time
              </p>
              <div className="flex gap-3 text-[11px] text-muted-foreground font-body">
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-400 rounded-sm" /> Sent</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-destructive rounded-sm" /> Bounced</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-400 rounded-sm" /> Failed</span>
              </div>
            </div>
            <div className="flex items-end gap-1 h-24 bg-background/40 rounded p-2 border border-border">
              {series.map((b, i) => {
                const total = b.total;
                const h = (total / maxBucketTotal) * 100;
                const sentH = total ? (b.sent / total) * h : 0;
                const bounceH = total ? (b.bounced / total) * h : 0;
                const dlqH = total ? (b.dlq / total) * h : 0;
                return (
                  <div
                    key={i}
                    className="flex-1 flex flex-col-reverse min-w-0"
                    title={`${new Date(b.t).toLocaleString()}\nSent: ${b.sent}  Bounced: ${b.bounced}  Failed: ${b.dlq}`}
                  >
                    <div style={{ height: `${sentH}%` }} className="bg-emerald-400/80" />
                    <div style={{ height: `${bounceH}%` }} className="bg-destructive/80" />
                    <div style={{ height: `${dlqH}%` }} className="bg-amber-400/80" />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent failures */}
          <div>
            <p className="text-xs text-muted-foreground font-body uppercase tracking-wider mb-2 flex items-center gap-1">
              <TrendingDown className="w-3 h-3" /> Recent failures
            </p>
            {recentFailures.length === 0 ? (
              <p className="text-sm text-muted-foreground font-body">No bounces or failures in this window.</p>
            ) : (
              <div className="space-y-1">
                {recentFailures.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm font-body border-b border-border/50 py-1.5">
                    <span className={`uppercase text-[10px] tracking-wider w-20 ${STATUS_TONE[r.status] || ""}`}>
                      {r.status}
                    </span>
                    <span className="text-card-foreground truncate flex-1">{r.recipient_email}</span>
                    <span className="text-muted-foreground text-xs hidden sm:inline">{r.template_name}</span>
                    <span className="text-muted-foreground text-xs">
                      {new Date(r.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="text-center">
      <p className="text-xs text-muted-foreground font-body uppercase tracking-wider">{label}</p>
      <p className={`font-display text-2xl mt-1 ${tone || "text-card-foreground"}`}>{value}</p>
      {sub !== undefined && <p className="text-xs text-muted-foreground font-body mt-0.5">{sub}</p>}
    </div>
  );
}
