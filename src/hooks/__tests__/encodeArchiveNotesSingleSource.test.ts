import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The slot-notes blob is a string format, and it had two encoders.
 *
 * Builder.tsx kept its own copy of encodeArchiveNotes. When the blob gained
 * Charlie's per-version note, only the exported one in useSetlist.ts was
 * updated — so setlists saved through the autosave path carried the note and
 * setlists saved through Builder's guest-save path silently dropped it. Both
 * were "working"; they just disagreed.
 *
 * A round-trip test on the exported function cannot catch that, because the
 * copy is what ran. The invariant that actually matters is that there is only
 * one encoder, so this asserts it directly.
 */

const SRC = join(process.cwd(), "src");
const DEFINITION = /(?:export\s+)?const\s+encodeArchiveNotes\s*=/g;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

describe("encodeArchiveNotes has a single source of truth", () => {
  it("is defined exactly once across src/", () => {
    const defining = walk(SRC).filter((file) => {
      const matches = readFileSync(file, "utf-8").match(DEFINITION);
      return matches !== null && matches.length > 0;
    });

    expect(defining.map((f) => f.replace(SRC, "src").replace(/\\/g, "/"))).toEqual([
      "src/hooks/useSetlist.ts",
    ]);
  });
});
