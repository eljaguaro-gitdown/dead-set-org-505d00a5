import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { buildAdminTrafficSql, toAdminTraffic } from "../../../supabase/functions/admin-users/traffic";
import { readAdminTraffic } from "@/lib/adminTraffic";

/**
 * The admin dashboard's visitor cards read page_visits, which counts every
 * Lovable preview reload and admin session: 24 (24h) and 263 (7d) on
 * 2026-10-08, against 1 and 20 in PostHog with the shared filter. They now
 * come from PostHog through admin-users, on the same filter as the daily and
 * weekly reports.
 */
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

describe("buildAdminTrafficSql", () => {
  const sql = buildAdminTrafficSql("FILTER_MARKER");

  it("applies the filter it is given", () => {
    expect(sql).toMatch(/AND FILTER_MARKER\s*$/);
  });

  it("counts pageviews only, inside a 30-day WHERE bound", () => {
    expect(sql).toMatch(/WHERE event = '\$pageview'/);
    expect(sql).toMatch(/AND timestamp >= now\(\) - INTERVAL 30 DAY/);
  });

  it("splits 24h and 7d inside that window, and counts people by person_id", () => {
    expect(sql).toMatch(/uniqIf\(person_id, timestamp >= now\(\) - INTERVAL 1 DAY\) AS unique24h/);
    expect(sql).toMatch(/uniqIf\(person_id, timestamp >= now\(\) - INTERVAL 7 DAY\) AS unique7d/);
    expect(sql).toMatch(/uniq\(person_id\) AS unique30d/);
    expect(sql).toMatch(/countIf\(timestamp >= now\(\) - INTERVAL 1 DAY\) AS pageViews24h/);
    expect(sql).toMatch(/count\(\) AS pageViews30d/);
    expect(sql).not.toMatch(/distinct_id/);
  });
});

describe("toAdminTraffic", () => {
  const row = { unique24h: 1, unique7d: 20, unique30d: 41, pageViews24h: 3, pageViews30d: 180 };

  it("maps PostHog's row", () => {
    expect(toAdminTraffic([row])).toEqual({ source: "posthog", ...row });
  });

  it("accepts numeric strings, which ClickHouse sends for large counts", () => {
    expect(toAdminTraffic([{ ...row, pageViews30d: "180" }])?.pageViews30d).toBe(180);
  });

  it("is null, never zeros, when PostHog did not answer", () => {
    expect(toAdminTraffic(null)).toBeNull();
    expect(toAdminTraffic([])).toBeNull();
  });

  it("is null when any field is missing, blank, negative or not a number", () => {
    for (const key of Object.keys(row)) {
      for (const v of [undefined, "", -1, "x", null]) {
        expect(toAdminTraffic([{ ...row, [key]: v }]), `${key}=${String(v)}`).toBeNull();
      }
    }
  });
});

describe("admin-users uses PostHog for traffic", () => {
  const src = stripComments(read("supabase/functions/admin-users/index.ts"));

  it("queries PostHog with the shared external-traffic filter and returns the mapped row", () => {
    expect(src).toMatch(/queryPostHog\("admin-users traffic", buildAdminTrafficSql\(POSTHOG_EXTERNAL_TRAFFIC_WHERE\)\)/);
    expect(src).toMatch(/const traffic = toAdminTraffic\(trafficRows\)/);
    expect(src).toMatch(/\btraffic,\s*\n\s*\}\)/);
  });

  it("no longer reads the page_visits traffic cache", () => {
    expect(src).not.toMatch(/admin_traffic_stats_cache|refresh_admin_traffic_stats|page_visits/);
  });

  it("the shared filter is still production host, internal cohort out, bots out", () => {
    const shared = read("supabase/functions/_shared/posthogQuery.ts");
    expect(shared).toMatch(/properties\.\$host IN \('dead-set\.org', 'www\.dead-set\.org'\)/);
    expect(shared).toMatch(/person_id NOT IN COHORT 579554/);
    expect(shared).toMatch(/NOT coalesce\(properties\.\$virt_is_bot, false\)/);
  });
});

describe("readAdminTraffic (the page's side)", () => {
  const row = { unique24h: 1, unique7d: 20, unique30d: 45, pageViews24h: 1, pageViews30d: 211 };

  it("accepts exactly what admin-users now sends", () => {
    const sent = toAdminTraffic([row]);
    expect(sent).not.toBeNull();
    expect(readAdminTraffic(JSON.parse(JSON.stringify(sent)))).toEqual(sent);
  });

  it("refuses the old page_visits payload, which used the same field names", () => {
    // What admin-users returned before this change. Shown under a PostHog
    // caption it would be the very number this change exists to remove.
    const old = { totalPageViews: 9000, totalUnique: 800, unique24h: 24, unique7d: 263, unique30d: 400 };
    expect(readAdminTraffic(old)).toBeNull();
    expect(readAdminTraffic({ ...old, pageViews24h: 5, pageViews30d: 50 })).toBeNull();
  });

  it("refuses a PostHog payload with a missing, negative or non-numeric field", () => {
    const ok = { source: "posthog", ...row };
    expect(readAdminTraffic(ok)).toEqual(ok);
    for (const key of Object.keys(row)) {
      for (const v of [undefined, -1, "20", null, Number.NaN]) {
        expect(readAdminTraffic({ ...ok, [key]: v }), `${key}=${String(v)}`).toBeNull();
      }
    }
  });

  it("is null for no payload (PostHog did not answer)", () => {
    expect(readAdminTraffic(null)).toBeNull();
    expect(readAdminTraffic(undefined)).toBeNull();
  });

  it("is what the dashboard stores", () => {
    const admin = stripComments(read("src/pages/Admin.tsx"));
    expect(admin).toMatch(/setTraffic\(readAdminTraffic\(usersRes\.data\.traffic\)\)/);
    expect(admin.match(/setTraffic\(/g)).toHaveLength(1);
  });
});
