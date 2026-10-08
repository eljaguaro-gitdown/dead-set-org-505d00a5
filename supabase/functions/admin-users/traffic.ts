/**
 * The admin dashboard's traffic numbers, from PostHog.
 *
 * They used to come from `page_visits`, which has no hostname and no internal
 * flag, so every Lovable editor or preview reload and every admin session
 * counted as a visitor. On 2026-10-08 the cards read 24 (24h) and 263 (7d);
 * PostHog with the shared filter read 1 and 20. CLAUDE.md already says traffic
 * comes from PostHog, never page_visits, and the daily and weekly reports
 * moved over earlier. This puts the dashboard on the same numbers.
 *
 * Free of Deno APIs, and the filter is passed in rather than imported from
 * _shared/posthogQuery.ts (which reads Deno.env), so the app's Vitest suite and
 * `tsc -p tsconfig.app.json` can load this file.
 */

/** One HogQL query for every traffic tile, over the last 30 days. */
export const buildAdminTrafficSql = (externalTrafficWhere: string): string => `
  SELECT
    uniqIf(person_id, timestamp >= now() - INTERVAL 1 DAY) AS unique24h,
    uniqIf(person_id, timestamp >= now() - INTERVAL 7 DAY) AS unique7d,
    uniq(person_id) AS unique30d,
    countIf(timestamp >= now() - INTERVAL 1 DAY) AS pageViews24h,
    count() AS pageViews30d
  FROM events
  WHERE event = '$pageview'
    AND timestamp >= now() - INTERVAL 30 DAY
    AND ${externalTrafficWhere}`;

export interface AdminTraffic {
  source: "posthog";
  unique24h: number;
  unique7d: number;
  unique30d: number;
  pageViews24h: number;
  pageViews30d: number;
}

const FIELDS = ["unique24h", "unique7d", "unique30d", "pageViews24h", "pageViews30d"] as const;

/**
 * The query's single row as dashboard traffic, or null when PostHog did not
 * answer or answered with something unreadable. Null is shown as "—" rather
 * than 0: an unanswered query must not read as a site with no visitors.
 */
export const toAdminTraffic = (
  rows: Array<Record<string, unknown>> | null,
): AdminTraffic | null => {
  const row = rows?.[0];
  if (!row) return null;
  const out: Partial<AdminTraffic> = { source: "posthog" };
  for (const key of FIELDS) {
    const raw = row[key];
    const value = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
    if (!Number.isFinite(value) || value < 0) return null;
    out[key] = value;
  }
  return out as AdminTraffic;
};
