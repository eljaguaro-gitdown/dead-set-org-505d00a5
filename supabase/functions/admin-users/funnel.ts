/**
 * The admin Conversion Funnel's people counts, from PostHog.
 *
 * The widget used to read page_visits, which counts Lovable preview reloads
 * and admin sessions, and then ADDED each day's unique visitors together, so
 * anyone who came back on a second day counted twice. On 2026-10-08 its 7-day
 * "Visitors" read 283 against 18 real people, and every percentage divided by
 * that. Here every stage is a count of distinct people on the shared external
 * filter, and a window's total is its own uniq, never a sum of days.
 *
 * Days are Pacific calendar days, the owner's clock. The 7d and 30d windows
 * are "today plus the previous 6 / 29 Pacific days", so a window's total and
 * the daily rows beneath it cover exactly the same span.
 *
 * Free of Deno APIs, filter passed in (see traffic.ts for why).
 */

const TZ = "America/Los_Angeles";
const DAY = `toDate(toTimeZone(timestamp, '${TZ}'))`;
const TODAY = `toDate(toTimeZone(now(), '${TZ}'))`;

/** A landing-page button tap. `page` is set by trackCtaClick; '/' is the landing page. */
const CTA = `event = 'landing_cta_clicked' AND properties.page = '/'`;
const AUTH_VIEW = `event = '$pageview' AND properties.$pathname LIKE '/auth%'`;

const whereFor = (externalTrafficWhere: string) => `
  WHERE event IN ('$pageview', 'landing_cta_clicked')
    AND timestamp >= now() - INTERVAL 31 DAY
    AND ${DAY} >= ${TODAY} - 29
    AND ${externalTrafficWhere}`;

/** One row per Pacific day with any activity, over the last 30 Pacific days. */
export const buildAdminFunnelDailySql = (externalTrafficWhere: string): string => `
  SELECT
    toString(${DAY}) AS day,
    uniqIf(person_id, event = '$pageview') AS visitors,
    uniqIf(person_id, ${CTA}) AS ctaPeople,
    uniqIf(person_id, ${AUTH_VIEW}) AS authPeople
  FROM events${whereFor(externalTrafficWhere)}
  GROUP BY day
  ORDER BY day`;

/** Distinct people per stage over each window — never derived from the daily rows. */
export const buildAdminFunnelTotalsSql = (externalTrafficWhere: string): string => `
  SELECT
    uniqIf(person_id, event = '$pageview' AND ${DAY} >= ${TODAY} - 6) AS visitors7,
    uniqIf(person_id, ${CTA} AND ${DAY} >= ${TODAY} - 6) AS ctaPeople7,
    uniqIf(person_id, ${AUTH_VIEW} AND ${DAY} >= ${TODAY} - 6) AS authPeople7,
    uniqIf(person_id, event = '$pageview') AS visitors30,
    uniqIf(person_id, ${CTA}) AS ctaPeople30,
    uniqIf(person_id, ${AUTH_VIEW}) AS authPeople30
  FROM events${whereFor(externalTrafficWhere)}`;

export interface FunnelStages {
  visitors: number;
  ctaPeople: number;
  authPeople: number;
}

export interface AdminFunnel {
  source: "posthog";
  /** Pacific days (YYYY-MM-DD) that had activity; missing days had none. */
  days: Array<{ day: string } & FunnelStages>;
  totals: { 7: FunnelStages; 30: FunnelStages };
}

const num = (raw: unknown): number => {
  const v = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
  return Number.isFinite(v) && v >= 0 ? v : NaN;
};

/**
 * Both queries' rows as the funnel, or null when either is missing or
 * unreadable. Null is shown as "—", never as zero: an unanswered query must
 * not read as a funnel nobody entered.
 */
export const toAdminFunnel = (
  dailyRows: Array<Record<string, unknown>> | null,
  totalRows: Array<Record<string, unknown>> | null,
): AdminFunnel | null => {
  const t = totalRows?.[0];
  if (!dailyRows || !t) return null;
  const totals = {
    7: { visitors: num(t.visitors7), ctaPeople: num(t.ctaPeople7), authPeople: num(t.authPeople7) },
    30: { visitors: num(t.visitors30), ctaPeople: num(t.ctaPeople30), authPeople: num(t.authPeople30) },
  };
  for (const w of [totals[7], totals[30]]) {
    if (Object.values(w).some((v) => Number.isNaN(v))) return null;
  }
  const days: AdminFunnel["days"] = [];
  for (const r of dailyRows) {
    const day = typeof r.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.day) ? r.day : null;
    const row = { visitors: num(r.visitors), ctaPeople: num(r.ctaPeople), authPeople: num(r.authPeople) };
    if (!day || Object.values(row).some((v) => Number.isNaN(v))) return null;
    days.push({ day, ...row });
  }
  return { source: "posthog", days, totals };
};
