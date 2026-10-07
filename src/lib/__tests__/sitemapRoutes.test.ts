import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * robots.txt pointed crawlers at https://dead-set-harmony.lovable.app/sitemap.xml,
 * a Lovable preview host that now answers "Project not found". dead-set.org had
 * no sitemap of its own. Both are pinned here: robots.txt names a sitemap on
 * dead-set.org that ships in public/, and every page the sitemap lists is a
 * route the app actually has. A route deleted later fails this test instead of
 * leaving a crawler a dead link.
 */
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const SITE = "https://dead-set.org";

describe("robots.txt sitemap", () => {
  const robots = read("public/robots.txt");
  const sitemaps = Array.from(robots.matchAll(/^Sitemap:\s*(\S+)\s*$/gim)).map((m) => m[1]);

  it("names exactly one sitemap, on dead-set.org", () => {
    expect(sitemaps).toEqual([`${SITE}/sitemap.xml`]);
  });

  it("names a file that ships with the site", () => {
    expect(existsSync(join(process.cwd(), "public/sitemap.xml"))).toBe(true);
  });
});

describe("sitemap.xml", () => {
  const locs = Array.from(read("public/sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1]);
  const routes = new Set(
    Array.from(read("src/App.tsx").matchAll(/<Route\s+path="([^"]+)"/g)).map((m) => m[1]),
  );

  it("lists the homepage and at least the Songbook", () => {
    expect(locs).toEqual(expect.arrayContaining([`${SITE}/`, `${SITE}/songbook`]));
  });

  it("lists only dead-set.org pages that are routes in App.tsx", () => {
    const dangling = locs.filter((loc) => !loc.startsWith(SITE) || !routes.has(loc.slice(SITE.length) || "/"));
    expect(dangling).toEqual([]);
  });

  it("lists no signed-in or admin page", () => {
    const privatePaths = /^\/(admin|auth|builder|my-setlists|profile|messages|unsubscribe|reset-password|join|audio-diag)\b/;
    expect(locs.map((loc) => loc.slice(SITE.length)).filter((p) => privatePaths.test(p))).toEqual([]);
  });
});
