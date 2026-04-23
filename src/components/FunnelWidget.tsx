import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FunnelWidgetProps {
  /** Pre-loaded signup timestamps from the admin-users edge function */
  signupDates: string[];
  enabled: boolean;
}

type Range = 7 | 30;

interface DayRow {
  day: string; // YYYY-MM-DD
  visitors: number;
  ctaClicks: number;
  authVisits: number;
  signups: number;
}

const fmtDay = (d: Date) => d.toISOString().slice(0, 10);

const buildDayBuckets = (days: number): Record<string, DayRow> => {
  const buckets: Record<string, DayRow> = {};
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const key = fmtDay(d);
    buckets[key] = { day: key, visitors: 0, ctaClicks: 0, authVisits: 0, signups: 0 };
  }
  return buckets;
};

const FunnelWidget = ({ signupDates, enabled }: FunnelWidgetProps) => {
  const [range, setRange] = useState<Range>(7);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<DayRow[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const sinceDate = new Date();
      sinceDate.setUTCDate(sinceDate.getUTCDate() - (range - 1));
      sinceDate.setUTCHours(0, 0, 0, 0);
      const sinceIso = sinceDate.toISOString();

      const buckets = buildDayBuckets(range);

      // Fetch in parallel — admins have SELECT on both tables via RLS
      const [visitsRes, ctaRes] = await Promise.all([
        supabase
          .from("page_visits")
          .select("visitor_id, page_path, created_at")
          .gte("created_at", sinceIso)
          .limit(50_000),
        supabase
          .from("share_events")
          .select("created_at, channel")
          .eq("share_type", "cta_click")
          .gte("created_at", sinceIso)
          .limit(50_000),
      ]);

      if (cancelled) return;

      // Track unique visitors per day
      const dailyVisitors: Record<string, Set<string>> = {};
      for (const v of visitsRes.data ?? []) {
        const day = fmtDay(new Date(v.created_at));
        if (!buckets[day]) continue;
        if (!dailyVisitors[day]) dailyVisitors[day] = new Set();
        dailyVisitors[day].add(v.visitor_id);
        if (v.page_path === "/auth" || v.page_path?.startsWith("/auth?")) {
          buckets[day].authVisits++;
        }
      }
      for (const [day, set] of Object.entries(dailyVisitors)) {
        if (buckets[day]) buckets[day].visitors = set.size;
      }

      for (const c of ctaRes.data ?? []) {
        const day = fmtDay(new Date(c.created_at));
        if (buckets[day]) buckets[day].ctaClicks++;
      }

      for (const ts of signupDates) {
        const day = fmtDay(new Date(ts));
        if (buckets[day]) buckets[day].signups++;
      }

      setRows(Object.values(buckets).reverse()); // newest first
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [enabled, range, signupDates]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          visitors: acc.visitors + r.visitors,
          ctaClicks: acc.ctaClicks + r.ctaClicks,
          authVisits: acc.authVisits + r.authVisits,
          signups: acc.signups + r.signups,
        }),
        { visitors: 0, ctaClicks: 0, authVisits: 0, signups: 0 },
      ),
    [rows],
  );

  const pct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : "—");
  const maxVisitors = Math.max(1, ...rows.map((r) => r.visitors));

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Activity className="w-4 h-4 text-muted-foreground" />
        <h2 className="font-display text-sm text-foreground">Conversion Funnel</h2>
        <div className="ml-auto flex items-center gap-1">
          {([7, 30] as Range[]).map((r) => (
            <Button
              key={r}
              size="sm"
              variant={range === r ? "default" : "outline"}
              onClick={() => setRange(r)}
              className="h-7 px-2 text-xs font-mono"
            >
              {r}d
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-8 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
        </div>
      ) : (
        <>
          {/* Totals strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-border border-b border-border">
            <FunnelStat label="Visitors" value={totals.visitors} />
            <FunnelStat label="CTA clicks" value={totals.ctaClicks} sub={pct(totals.ctaClicks, totals.visitors)} />
            <FunnelStat label="/auth visits" value={totals.authVisits} sub={pct(totals.authVisits, totals.visitors)} />
            <FunnelStat label="Signups" value={totals.signups} sub={pct(totals.signups, totals.visitors)} highlight />
          </div>

          {/* Daily breakdown */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-mono">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="text-left px-4 py-2">Day</th>
                  <th className="text-right px-3 py-2">Visitors</th>
                  <th className="text-right px-3 py-2">CTA</th>
                  <th className="text-right px-3 py-2">/auth</th>
                  <th className="text-right px-4 py-2">Signups</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.day} className="border-b border-border/40 last:border-0">
                    <td className="px-4 py-2 text-foreground tabular-nums">{r.day.slice(5)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <div className="inline-flex items-center gap-2 justify-end w-full">
                        <div
                          className="h-1.5 bg-primary/40 rounded-sm"
                          style={{ width: `${(r.visitors / maxVisitors) * 60}px` }}
                        />
                        <span className="text-foreground">{r.visitors}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.ctaClicks}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.authVisits}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      <span className={r.signups > 0 ? "text-primary font-bold" : "text-muted-foreground"}>
                        {r.signups > 0 ? `+${r.signups}` : "0"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="px-4 py-2 text-xs font-body text-muted-foreground/70 border-t border-border">
            CTA clicks tracked from landing-page hero buttons. Older clicks may be missing if tracking was added recently.
          </p>
        </>
      )}
    </div>
  );
};

const FunnelStat = ({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: number;
  sub?: string;
  highlight?: boolean;
}) => (
  <div className="px-4 py-3">
    <p className="text-xs uppercase tracking-wider text-muted-foreground font-mono">{label}</p>
    <p className={`font-display text-2xl tabular-nums ${highlight ? "text-primary" : "text-foreground"}`}>{value}</p>
    {sub && <p className="text-xs font-mono text-muted-foreground/70">{sub}</p>}
  </div>
);

export default FunnelWidget;
