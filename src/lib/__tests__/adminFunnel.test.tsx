import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { render, screen, within } from "@testing-library/react";
import {
  buildAdminFunnelDailySql,
  buildAdminFunnelTotalsSql,
  toAdminFunnel,
} from "../../../supabase/functions/admin-users/funnel";
import { internalUserIds, isInternalEmail } from "../../../supabase/functions/_shared/internalAccounts";
import { lastPacificDays, pacificDay, readAdminFunnel } from "@/lib/adminFunnel";
import FunnelWidget from "@/components/FunnelWidget";
import { buildFunnel, excludeInternal, type AuthEventRow } from "@/components/AuthFunnelWidget";

/**
 * The admin dashboard audit of 2026-10-08: the Conversion Funnel read 283
 * "visitors" in 7 days against 18 real people (page_visits, plus a sum of
 * daily uniques), every count included the owner, and the Sign-up Funnel
 * counted sign-ins as sign-ups. These pin the fixes.
 */
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

describe("internal accounts", () => {
  it("matches the owner's other accounts and the test accounts, case-insensitively", () => {
    for (const e of [
      "eljaguaro+appreview@gmail.com",
      "Grateful_Jaguaro@dead-set.org",
      "jay_cohen@icloud.com",
      "qa-verify-auth-2026-07-13@example.com",
      "qa-verify-race-test-0713@dead-set-org-qa.test",
    ]) {
      expect(isInternalEmail(e), e).toBe(true);
    }
  });

  it("never matches a real fan, including Apple private-relay addresses", () => {
    for (const e of ["ricneil27@gmail.com", "clange98@yahoo.com", "668xfpbnh8@privaterelay.appleid.com", null, ""]) {
      expect(isInternalEmail(e), String(e)).toBe(false);
    }
  });

  it("adds every admin by role, even one whose email is not on the list", () => {
    const ids = internalUserIds(
      [{ id: "fan", email: "fan@gmail.com" }, { id: "test", email: "x@example.com" }],
      ["some-admin"],
    );
    expect([...ids].sort()).toEqual(["some-admin", "test"]);
  });
});

describe("funnel SQL", () => {
  const daily = buildAdminFunnelDailySql("FILTER_MARKER");
  const totals = buildAdminFunnelTotalsSql("FILTER_MARKER");

  it("applies the filter it is given, inside a bounded window", () => {
    for (const sql of [daily, totals]) {
      expect(sql).toMatch(/AND FILTER_MARKER/);
      expect(sql).toMatch(/timestamp >= now\(\) - INTERVAL 31 DAY/);
    }
  });

  it("counts people, and only people", () => {
    for (const sql of [daily, totals]) {
      expect(sql).not.toMatch(/\bcount(If)?\(/i);
      expect(sql).toMatch(/uniqIf\(person_id/);
    }
  });

  it("buckets by Pacific day", () => {
    expect(daily).toMatch(/toTimeZone\(timestamp, 'America\/Los_Angeles'\)/);
    expect(daily).toMatch(/GROUP BY day/);
  });

  it("computes each window's total as its own uniq, not from the daily rows", () => {
    expect(totals).not.toMatch(/GROUP BY/);
    expect(totals).toMatch(/AS visitors7/);
    expect(totals).toMatch(/- 6\) AS visitors7/);
    expect(totals).toMatch(/AS visitors30/);
  });

  it("counts landing taps from the landing page only", () => {
    expect(totals).toMatch(/event = 'landing_cta_clicked' AND properties\.page = '\/'/);
  });
});

describe("toAdminFunnel / readAdminFunnel", () => {
  const dailyRows = [
    { day: "2026-10-05", visitors: 10, ctaPeople: 0, authPeople: 4 },
    { day: "2026-10-06", visitors: "3", ctaPeople: 0, authPeople: 1 },
  ];
  const totalRows = [{ visitors7: 18, ctaPeople7: 0, authPeople7: 5, visitors30: 45, ctaPeople30: 0, authPeople30: 6 }];

  it("maps both queries, and survives the trip to the page", () => {
    const f = toAdminFunnel(dailyRows, totalRows);
    expect(f?.totals[7]).toEqual({ visitors: 18, ctaPeople: 0, authPeople: 5 });
    expect(f?.days[1]).toEqual({ day: "2026-10-06", visitors: 3, ctaPeople: 0, authPeople: 1 });
    expect(readAdminFunnel(JSON.parse(JSON.stringify(f)))).toEqual(f);
  });

  it("is null, never zeros, when either query did not answer", () => {
    expect(toAdminFunnel(null, totalRows)).toBeNull();
    expect(toAdminFunnel(dailyRows, null)).toBeNull();
    expect(toAdminFunnel(dailyRows, [])).toBeNull();
  });

  it("is null when any number is unreadable", () => {
    expect(toAdminFunnel(dailyRows, [{ ...totalRows[0], visitors7: -1 }])).toBeNull();
    expect(toAdminFunnel([{ ...dailyRows[0], day: "Oct 5" }], totalRows)).toBeNull();
  });

  it("the page refuses anything not labelled PostHog", () => {
    const f = toAdminFunnel(dailyRows, totalRows)!;
    expect(readAdminFunnel({ ...f, source: "page_visits" })).toBeNull();
    expect(readAdminFunnel(null)).toBeNull();
  });
});

describe("Pacific days", () => {
  it("dates an evening in California as that evening, not the next UTC day", () => {
    // clange98 signed up 2026-10-06 03:25 UTC: the evening of Oct 5 in California.
    expect(pacificDay("2026-10-06T03:25:00Z")).toBe("2026-10-05");
  });

  it("steps back one calendar day at a time across a DST change", () => {
    const days = lastPacificDays(4, new Date("2026-11-02T20:00:00Z")); // DST ended Nov 1
    expect(days).toEqual(["2026-11-02", "2026-11-01", "2026-10-31", "2026-10-30"]);
  });
});

describe("FunnelWidget", () => {
  const today = pacificDay(new Date());
  const funnel = toAdminFunnel(
    [{ day: today, visitors: 2, ctaPeople: 1, authPeople: 1 }],
    [{ visitors7: 18, ctaPeople7: 1, authPeople7: 5, visitors30: 45, ctaPeople30: 1, authPeople30: 6 }],
  );

  it("shows the window's own count of people, not a sum of days", () => {
    render(<FunnelWidget funnel={funnel} loading={false} signupDates={[new Date().toISOString()]} />);
    const stat = screen.getByText("Visitors", { selector: "p" }).parentElement!;
    expect(within(stat).getByText("18")).toBeInTheDocument();
    // Sign-ups divide by the same people the Visitors tile shows: 1 of 18.
    const signups = screen.getByText("Sign-ups", { selector: "p" }).parentElement!;
    expect(within(signups).getByText("5.6%")).toBeInTheDocument();
  });

  it("says unavailable, with no numbers, when the funnel is null", () => {
    render(<FunnelWidget funnel={null} loading={false} signupDates={[]} />);
    expect(screen.getByText(/Funnel unavailable/)).toBeInTheDocument();
    const stat = screen.getByText("Visitors", { selector: "p" }).parentElement!;
    expect(within(stat).getByText("—")).toBeInTheDocument();
  });

  it("no longer queries page_visits, and the Lovable 'referrals' strip is gone", () => {
    const src = stripComments(read("src/components/FunnelWidget.tsx"));
    expect(src).not.toMatch(/page_visits|visitor_attribution|supabase/);
    expect(src).not.toMatch(/Lovable|lovable/);
  });
});

describe("Sign-up Funnel", () => {
  const ev = (event_name: string, visitor_id: string, extra: Partial<AuthEventRow> = {}): AuthEventRow => ({
    event_name,
    visitor_id,
    provider: null,
    created_at: "2026-10-05T19:00:00Z",
    ...extra,
  });
  const google = { provider: "google" };

  it("counts a new account, not a returning member's sign-in", () => {
    const f = buildFunnel([
      ev("auth_modal_opened", "a"),
      ev("oauth_redirect_started", "a", google),
      ev("oauth_returned", "a", { ...google, metadata: { isFreshAccount: true } }),
      ev("auth_modal_opened", "b"),
      ev("oauth_redirect_started", "b", google),
      ev("oauth_returned", "b", { ...google, metadata: { isFreshAccount: false } }),
      ev("email_confirmed", "b", google), // a Google account's email_confirmed fires on sign-in
    ]);
    const newAccounts = f.total.steps.find((s) => s.key === "new")!;
    expect(newAccounts.visitors).toBe(1);
    expect(f.total.notes.find((n) => n.label.startsWith("Existing"))!.visitors).toBe(1);
    expect(f.byProvider.google.steps.map((s) => s.visitors)).toEqual([2, 2, 1]);
  });

  it("keeps errors and returning sign-ins out of the email funnel's steps", () => {
    const f = buildFunnel([
      ev("signup_email_attempted", "c", { provider: "email" }),
      ev("signup_email_failed", "c", { provider: "email" }),
      ev("signup_email_needs_confirmation", "c", { provider: "email" }),
      ev("email_confirmed", "c", { provider: "email" }),
    ]);
    expect(f.byProvider.email.steps.map((s) => s.key)).toEqual(["attempted", "signup_attempt", "needs_confirm", "new"]);
    expect(f.byProvider.email.steps.find((s) => s.key === "new")!.visitors).toBe(1);
    expect(f.byProvider.email.notes.find((n) => n.label.includes("error"))!.visitors).toBe(1);
  });

  it("leaves out the owner's accounts and every browser that has signed in to one", () => {
    const events = [
      ev("auth_modal_opened", "owner-laptop"), // no user_id before sign-in
      ev("oauth_returned", "owner-laptop", { user_id: "admin", ...google }),
      ev("auth_modal_opened", "fan"),
    ];
    const kept = excludeInternal(events, ["admin"], ["owner-laptop"]);
    expect(kept.map((e) => e.visitor_id)).toEqual(["fan"]);
  });

  it("leaves out an owner sign-in from a browser not yet known as the owner's", () => {
    // e.g. the confirmation link opened on a new phone: user_id set, browser unseen.
    const events = [ev("email_confirmed", "new-phone", { user_id: "admin", provider: "email" }), ev("auth_modal_opened", "fan")];
    expect(excludeInternal(events, ["admin"], []).map((e) => e.visitor_id)).toEqual(["fan"]);
  });
});

describe("admin-users serves what the page needs", () => {
  const src = stripComments(read("supabase/functions/admin-users/index.ts"));

  it("queries both funnel SQLs with the shared external filter", () => {
    expect(src).toMatch(/buildAdminFunnelDailySql\(POSTHOG_EXTERNAL_TRAFFIC_WHERE\)/);
    expect(src).toMatch(/buildAdminFunnelTotalsSql\(POSTHOG_EXTERNAL_TRAFFIC_WHERE\)/);
    expect(src).toMatch(/const funnel = toAdminFunnel\(funnelDailyRows, funnelTotalRows\)/);
  });

  it("flags internal users, by role and by the shared list", () => {
    expect(src).toMatch(/from\("user_roles"\)\.select\("user_id"\)\.eq\("role", "admin"\)/);
    expect(src).toMatch(/isInternal: internalIds\.has\(u\.id\)/);
  });

  it("returns the funnel and the internal ids", () => {
    expect(src).toMatch(/\bfunnel,\s*\n\s*internal: \{ userIds: internalIdList, visitorIds: \[\.\.\.internalVisitorIds\] \}/);
  });
});

describe("the admin page counts fans", () => {
  const admin = stripComments(read("src/pages/Admin.tsx"));

  it("totals, sign-ins and setlists exclude internal accounts", () => {
    expect(admin).toMatch(/const fans = users\.filter\(\(u\) => !u\.isInternal\)/);
    expect(admin).toMatch(/fans\.filter\(/);
    expect(admin).not.toMatch(/users\.reduce\(\(sum, u\) => sum \+ u\.setlistCount, 0\)\s*\}/);
  });

  it("feeds the funnels fans' sign-ups and the internal ids", () => {
    expect(admin).toMatch(/signupDates=\{fans\.map/);
    expect(admin).toMatch(/internalVisitorIds=\{internal\?\.visitorIds\}/);
  });
});
