import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { OBJECTIONABLE_TERMS } from "@/lib/contentFilter";

// The filter runs twice: in the app (src/lib/contentFilter.ts) and in the
// database triggers (public.objectionable_terms()). If the lists drift, the
// app lets through text the database then refuses with a bare error — or the
// database accepts, via a direct API write, what the app claims to filter.
// This reads the NEWEST migration that defines the function, so a later
// migration that changes the list is what gets compared.

const MIGRATIONS = resolve(__dirname, "../../../supabase/migrations");

const latestTermsMigration = (): string => {
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const defining = files.filter((f) =>
    readFileSync(resolve(MIGRATIONS, f), "utf8").includes(
      "FUNCTION public.objectionable_terms()",
    ),
  );
  expect(defining.length, "no migration defines public.objectionable_terms()").toBeGreaterThan(0);
  return readFileSync(resolve(MIGRATIONS, defining[defining.length - 1]), "utf8");
};

describe("objectionable terms: app and database agree", () => {
  it("lists the same terms in the same order", () => {
    const sql = latestTermsMigration();
    const body = sql.match(/SELECT ARRAY\[([\s\S]*?)\]::text\[\]/);
    expect(body, "could not find the ARRAY[...] literal").not.toBeNull();
    const sqlTerms = [...body![1].matchAll(/'([^']*)'/g)].map((m) => m[1]);
    expect(sqlTerms).toEqual([...OBJECTIONABLE_TERMS]);
  });

  it("applies the same leetspeak table", () => {
    const sql = latestTermsMigration();
    expect(sql).toContain("translate(lower(p_text), '013457@$!', 'oieastasi')");
    const src = readFileSync(resolve(__dirname, "../contentFilter.ts"), "utf8");
    expect(src).toContain('const LEET_FROM = "013457@$!"');
    expect(src).toContain('const LEET_TO = "oieastasi"');
  });
});
