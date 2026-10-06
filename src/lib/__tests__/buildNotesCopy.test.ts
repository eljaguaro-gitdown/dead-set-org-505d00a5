import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

/**
 * Build Notes copy lives in the DATABASE, not in the repo, so the usual brand
 * sweep over .tsx cannot see it — and "Cosmic Charlie — AI setlist generator"
 * sat published on /updates from April until it was found by accident while
 * re-dating the entries. This pins the two things a repo-side test CAN see: the
 * migration that fixed it, and any entry copy written into a migration later.
 *
 * It is not a substitute for checking the table. The admin editor is the other
 * way in, and nothing here can reach that.
 */
const MIGRATIONS = join(process.cwd(), "supabase/migrations");
const BANNED = /\b(ai|algorithm|algorithms|gemini|posthog|lovable|recommendation engine)\b/i;

/**
 * Quoted string contents only — a path like ai-deadhead/index.ts is not copy.
 *
 * Comments are stripped FIRST. An apostrophe inside a `--` comment ("the
 * repo's history") opens a string as far as naive quote-pairing is concerned,
 * and everything up to the next apostrophe becomes one enormous phantom
 * literal — which is how this sweep first reported a whole comment block as
 * banned copy. Same family as matching raw grep lines instead of the strings
 * inside them.
 */
const literals = (sql: string): string[] => {
  const bare = sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
  return Array.from(bare.matchAll(/'((?:[^']|'')*)'/g)).map((m) => m[1].replace(/''/g, "'"));
};

describe("changelog copy written in migrations stays in brand", () => {
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql"));

  it("reads some migrations, or the sweep is vacuous", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("no migration writes changelog copy containing a banned word", () => {
    /**
     * Every string literal in any migration that touches changelog_entries,
     * not just the ones after `set`. The first draft parsed `set ... where`
     * positions and an INSERT walked straight past it — and a seed migration
     * is the likeliest way new copy ever arrives. Scanning everything and
     * allow-listing the one string that NAMES the defect is both simpler and
     * harder to slip by: a new banned word cannot be on the allow-list.
     */
    const ALLOWED = new Set([
      // The predicate of the fix itself. It has to stay readable, or the
      // repair stops saying what it repaired.
      "Cosmic Charlie — AI setlist generator",
    ]);
    const offenders: string[] = [];
    for (const f of files) {
      const sql = readFileSync(join(MIGRATIONS, f), "utf8");
      if (!/changelog_entries/i.test(sql)) continue;
      for (const lit of literals(sql)) {
        if (ALLOWED.has(lit)) continue;
        if (BANNED.test(lit)) offenders.push(`${f}: ${lit.slice(0, 60)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the April entry that said it was fixed", () => {
    // Pins the repair itself: if someone reverts the migration line, this goes
    // red rather than the banned copy quietly returning to the page.
    const all = files.map((f) => readFileSync(join(MIGRATIONS, f), "utf8")).join("\n");
    expect(all).toMatch(/Cosmic Charlie builds you a night/);
  });
});
