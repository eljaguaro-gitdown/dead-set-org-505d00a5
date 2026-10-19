/**
 * The Conversion Funnel's people counts, as admin-users returns them.
 *
 * They come from PostHog on the shared external filter (see
 * supabase/functions/admin-users/funnel.ts). The web and the edge functions
 * deploy separately, so a payload is accepted only when it says it came from
 * PostHog and every number is readable. Anything else is null, which the
 * widget shows as "—" rather than as a funnel it cannot vouch for.
 */
export interface FunnelStages {
  visitors: number;
  ctaPeople: number;
  authPeople: number;
}

export interface AdminFunnel {
  source: "posthog";
  days: Array<{ day: string } & FunnelStages>;
  totals: { 7: FunnelStages; 30: FunnelStages };
}

const isCount = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
const isStages = (s: unknown): s is FunnelStages =>
  !!s &&
  typeof s === "object" &&
  isCount((s as FunnelStages).visitors) &&
  isCount((s as FunnelStages).ctaPeople) &&
  isCount((s as FunnelStages).authPeople);

export const readAdminFunnel = (payload: unknown): AdminFunnel | null => {
  if (!payload || typeof payload !== "object") return null;
  const f = payload as Record<string, unknown>;
  if (f.source !== "posthog") return null;
  const totals = f.totals as Record<string, unknown> | undefined;
  if (!totals || !isStages(totals[7]) || !isStages(totals[30])) return null;
  if (!Array.isArray(f.days)) return null;
  for (const d of f.days) {
    if (!isStages(d) || typeof (d as { day?: unknown }).day !== "string") return null;
  }
  return f as unknown as AdminFunnel;
};

/** The Pacific calendar date of an instant, as YYYY-MM-DD — the funnel's day. */
export const pacificDay = (instant: Date | string | number): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(instant));

/**
 * The last `count` Pacific days, newest first, ending today. Steps back from
 * today's date by calendar day rather than by 24 hours, so a DST change can
 * neither skip nor repeat a day.
 */
export const lastPacificDays = (count: number, now: Date = new Date()): string[] => {
  const [y, m, d] = pacificDay(now).split("-").map(Number);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(new Date(Date.UTC(y, m - 1, d - i)).toISOString().slice(0, 10));
  }
  return out;
};
