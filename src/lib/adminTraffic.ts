/**
 * The admin dashboard's traffic numbers, as admin-users returns them.
 *
 * They come from PostHog (production host only, internal accounts and bots
 * excluded; see supabase/functions/admin-users/traffic.ts). The web and the
 * edge functions deploy separately, and an older admin-users sends page_visits
 * counts under the same field names, so a payload is accepted only when it
 * says it came from PostHog. Anything else is null, which the dashboard shows
 * as "—" rather than as a number it cannot vouch for.
 */
export interface TrafficStats {
  source: "posthog";
  unique24h: number;
  unique7d: number;
  unique30d: number;
  pageViews24h: number;
  pageViews30d: number;
}

const FIELDS = ["unique24h", "unique7d", "unique30d", "pageViews24h", "pageViews30d"] as const;

export const readAdminTraffic = (payload: unknown): TrafficStats | null => {
  if (!payload || typeof payload !== "object") return null;
  const t = payload as Record<string, unknown>;
  if (t.source !== "posthog") return null;
  for (const key of FIELDS) {
    const v = t[key];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return null;
  }
  return t as unknown as TrafficStats;
};
