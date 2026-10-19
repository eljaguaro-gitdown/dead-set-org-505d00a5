import { useMemo, useState } from "react";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { lastPacificDays, pacificDay, type AdminFunnel } from "@/lib/adminFunnel";

/**
 * Landing → sign-up, in people.
 *
 * Every stage is a count of distinct outside people from PostHog (dead-set.org
 * only, the owner's accounts and bots excluded), served by admin-users; sign-
 * ups are new accounts that are not internal. This widget used to read
 * page_visits and sum each day's unique visitors, so its 7-day "Visitors" read
 * 283 against 18 real people on 2026-10-08, and every percentage divided by
 * that. A window's total is now its own count of people, never a sum of days.
 */

interface FunnelWidgetProps {
  /** From admin-users; null while loading or when PostHog did not answer. */
  funnel: AdminFunnel | null;
  loading: boolean;
  /** Account creation times of NON-internal users. */
  signupDates: string[];
}

type Range = 7 | 30;

/** First day landing-button taps were recorded on dead-set.org (landing_cta_clicked). */
const CTA_TRACKED_SINCE = "Oct 3";

const FunnelWidget = ({ funnel, loading, signupDates }: FunnelWidgetProps) => {
  const [range, setRange] = useState<Range>(7);

  const days = useMemo(() => lastPacificDays(range), [range]);

  const rows = useMemo(() => {
    const byDay = new Map((funnel?.days ?? []).map((d) => [d.day, d]));
    const signupsByDay = new Map<string, number>();
    for (const ts of signupDates) {
      const day = pacificDay(ts);
      signupsByDay.set(day, (signupsByDay.get(day) ?? 0) + 1);
    }
    return days.map((day) => ({
      day,
      visitors: byDay.get(day)?.visitors ?? 0,
      ctaPeople: byDay.get(day)?.ctaPeople ?? 0,
      authPeople: byDay.get(day)?.authPeople ?? 0,
      signups: signupsByDay.get(day) ?? 0,
    }));
  }, [funnel, days, signupDates]);

  // Window totals: people from PostHog's own window count; sign-ups summed
  // (each account is created once, so summing days does not double-count).
  const totals = funnel?.totals[range] ?? null;
  const signups = rows.reduce((n, r) => n + r.signups, 0);

  const pct = (n: number, d: number | undefined) => (d && d > 0 ? `${((n / d) * 100).toFixed(1)}%` : "—");
  const maxVisitors = Math.max(1, ...rows.map((r) => r.visitors));
  const show = (v: number | undefined) => (loading || v == null ? "—" : v);

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Activity className="w-4 h-4 text-muted-foreground" />
        <h2 className="font-display text-sm text-card-foreground">Conversion Funnel</h2>
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

      {/* Totals strip — people, not visits */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-border border-b border-border">
        <FunnelStat label="Visitors" value={show(totals?.visitors)} />
        <FunnelStat
          label="Tapped a landing button"
          value={show(totals?.ctaPeople)}
          sub={totals ? pct(totals.ctaPeople, totals.visitors) : undefined}
        />
        <FunnelStat
          label="Reached /auth"
          value={show(totals?.authPeople)}
          sub={totals ? pct(totals.authPeople, totals.visitors) : undefined}
        />
        <FunnelStat
          label="Sign-ups"
          value={loading ? "—" : signups}
          sub={totals ? pct(signups, totals.visitors) : undefined}
          highlight
        />
      </div>

      {/* Daily breakdown */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm font-mono">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="text-left px-4 py-2">Day (PT)</th>
              <th className="text-right px-3 py-2">Visitors</th>
              <th className="text-right px-3 py-2">Tapped</th>
              <th className="text-right px-3 py-2">/auth</th>
              <th className="text-right px-4 py-2">Sign-ups</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.day} className="border-b border-border/40 last:border-0">
                <td className="px-4 py-2 text-card-foreground tabular-nums">{r.day.slice(5)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  <div className="inline-flex items-center gap-2 justify-end w-full">
                    <div
                      className="h-1.5 bg-primary/40 rounded-sm"
                      style={{ width: `${(r.visitors / maxVisitors) * 60}px` }}
                    />
                    <span className="text-card-foreground">{funnel ? r.visitors : "—"}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{funnel ? r.ctaPeople : "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{funnel ? r.authPeople : "—"}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  <span className={r.signups > 0 ? "text-accent-foreground font-bold" : "text-muted-foreground"}>
                    {r.signups > 0 ? `+${r.signups}` : "0"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="px-4 py-2 text-xs font-body text-muted-foreground border-t border-border">
        {!loading && !funnel
          ? "Funnel unavailable: PostHog didn't answer, or the admin-users function predates this view."
          : `People, not visits: dead-set.org only, your accounts and bots excluded. A window's total counts each person once, so it can be less than the sum of its days. Landing-button taps are recorded from ${CTA_TRACKED_SINCE}.`}
      </p>
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
  value: number | string;
  sub?: string;
  highlight?: boolean;
}) => (
  <div className="px-4 py-3">
    <p className="text-xs uppercase tracking-wider text-muted-foreground font-mono">{label}</p>
    <p className={`font-display text-2xl tabular-nums ${highlight ? "text-primary" : "text-card-foreground"}`}>{value}</p>
    {sub && <p className="text-xs font-mono text-muted-foreground">{sub}</p>}
  </div>
);

export default FunnelWidget;
