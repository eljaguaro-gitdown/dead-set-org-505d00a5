import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

/**
 * The Songbook numbers its entries "Vol. N", never "Issue 001".
 *
 * The 2026-10-04 redesign renamed the label on `Songbook.tsx` and missed the
 * three other surfaces that print the same `issue_number`: the cross-link card
 * on `/versions/:slug`, the issue masthead on `SongFeature.tsx`, and the
 * landing hero's takeover eyebrow. A visitor tapped "Issue 001" on the front
 * page and landed on a page calling it "Vol. 1".
 *
 * The hero carried the worse half of it — `read Issue 001 →` was a *hardcoded*
 * string beside a `takeover.issueNumber` that already held the real number, so
 * it would have kept saying 001 after Vol. 2 shipped. That is the case this
 * file exists for: a drifting label is visible, a frozen one is not.
 *
 * WHAT THIS CAN AND CANNOT SEE. It scans source text for the *label* — the
 * word "issue" in any case, optionally followed by `#`, `:`, `.`, `-` or
 * "No.", then a number or an interpolation. It deliberately does NOT ban the
 * bare noun: "Back issues" is the section heading on `Songbook.tsx` and "Read
 * the whole issue →" is the link on the picker, both correct, because only
 * the numbering changed.
 *
 * The first version of this file was case-sensitive and anchored tight to the
 * digit. The gate defeated it in six ways — `read issue ${n}`, `Issue #${n}`,
 * `Issue No. 1`, `Issue: 1`, `Issue-001`, `"Issue " + n` — and proved each by
 * mutating a real file and watching this test stay green. Lowercase was the
 * plausible one: the hero's own hint copy is lowercase. The pattern below
 * covers all but the concatenation form, which is caught separately.
 *
 * It still cannot see a label built from variables at runtime, one split
 * across lines (the scan is line by line), an HTML entity (`Issue&nbsp;1`),
 * or one that lives in the database rather than the source — a `headline` row
 * reading "Issue 001" would pass here. It scans only `src`, so
 * `supabase/functions` is out of scope; `dispatch_004.ts` keeps its "Read
 * Issue 001" on purpose, as the record of an email already sent.
 */
const LABEL = /\bissue\s*(?:no\.?\s*)?[#:.\-]?\s*(?:\$\{|\{|\d)/i;

/** `"Issue " + n` — the concatenation form the pattern above cannot reach. */
const CONCAT = /\bissue\s*["'`]\s*\+/i;

const root = resolve(__dirname, "../../..");
const files = execSync("git ls-files 'src/**/*.tsx' 'src/**/*.ts'", { cwd: root, encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .filter((f) => !/\.test\.|\/__tests__\//.test(f));

describe("the Songbook numbers its entries Vol. N", () => {
  it("scans a real list of files (guards against the glob going empty)", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("still finds the surfaces that print an issue number", () => {
    const printers = files.filter((rel) =>
      /issue_number|issueNumber/.test(readFileSync(resolve(root, rel), "utf8")),
    );
    // Songbook, SongFeature, VersionPicker, HeroSection today. If a refactor
    // drops below this, the sweep below is passing over nothing.
    expect(printers.length).toBeGreaterThanOrEqual(4);
  });

  it("no surface labels an entry 'Issue <number>'", () => {
    const offenders: string[] = [];
    for (const rel of files) {
      readFileSync(resolve(root, rel), "utf8")
        .split("\n")
        .forEach((line, n) => {
          if (LABEL.test(line) || CONCAT.test(line))
            offenders.push(`${rel}:${n + 1}: ${line.trim().slice(0, 100)}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});
