import { describe, it, expect } from "vitest";
import { readSource } from "@/test/sourceFiles";

/**
 * A source check of supabase/functions/index-tapes/index.ts (no Deno harness
 * runs edge functions here). It pins that the on-demand path's 6-hour cooldown
 * is not skipped for a named recording: the pre-release gate (2026-11-07)
 * found `&& !ident` on the cached return, which let one public caller loop a
 * valid key and make the function read the Archive on every call.
 */
describe("index-tapes on-demand cooldown", () => {
  const src = readSource("supabase/functions/index-tapes/index.ts")
    .split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");

  it("returns cached for a fresh row whether or not an identifier was named", () => {
    const line = src.split("\n").find((l) => /return json\(\{ cached: true \}\)/.test(l));
    expect(line).toBeDefined();
    expect(line).not.toMatch(/ident/);
  });

  it("checks a named recording's OWN row, not the night's", () => {
    expect(src).toMatch(/if \(ident\) freshQ = freshQ\.eq\("identifier", ident\);/);
  });
});
