import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { contrastRatio, AA_NORMAL_TEXT } from "@/lib/contrast";

/**
 * The share poster's text has to stay legible on its own paper.
 *
 * A caption shipped at 3.79:1 — below AA for the small italic it is set in.
 * The first description of that bug measured it against the app's near-black
 * page background and got 4.18:1, a number that was wrong in the reassuring
 * direction. The text does not sit on the page; it sits on the cream J-card.
 *
 * So this reads the background out of index.css rather than hard-coding it,
 * and checks every hand-written text colour in the poster against it. Every
 * such colour today lives inside the .jcard-paper card. If one is ever added
 * for a different surface — the dark footer block, say — it needs excluding
 * here deliberately, with the background it actually sits on.
 */

const ROOT = process.cwd();
const POSTER = join(ROOT, "src", "pages", "SetlistPoster.tsx");
const CSS = join(ROOT, "src", "index.css");

function jcardPaper(): string {
  const css = readFileSync(CSS, "utf-8");
  const match = css.match(/\.jcard-paper\s*\{[^}]*background-color:\s*(hsl\([^)]*\))/);
  if (!match) throw new Error(".jcard-paper background-color not found in index.css");
  return match[1];
}

function posterTextColors(): string[] {
  const source = readFileSync(POSTER, "utf-8");
  // Literal HSL only. `hsl(var(--token))` resolves at runtime against the
  // theme, and those colours sit on themed surfaces (a primary button), not
  // on the paper — comparing them here would be measuring the wrong pair,
  // which is the exact mistake this file exists to stop repeating.
  return [...source.matchAll(/color:\s*"(hsl\(\s*[\d.][^"]*\))"/g)].map((m) => m[1]);
}

describe("share poster contrast", () => {
  it("reads the paper colour from the stylesheet", () => {
    // Guards the guard: a regex that stopped matching would leave every
    // assertion below comparing against nothing.
    expect(jcardPaper()).toMatch(/^hsl\(/);
  });

  it("finds the poster's hand-written text colours", () => {
    expect(posterTextColors().length).toBeGreaterThan(5);
  });

  it("keeps every poster text colour at AA against the paper", () => {
    const paper = jcardPaper();
    const failures = posterTextColors()
      .map((color) => ({ color, ratio: contrastRatio(color, paper) }))
      .filter(({ ratio }) => ratio < AA_NORMAL_TEXT)
      .map(({ color, ratio }) => `${color} is ${ratio.toFixed(2)}:1 on ${paper}`);

    expect(failures).toEqual([]);
  });

  it("holds the line on the version-note caption specifically", () => {
    // The one that shipped wrong, named so a future edit to it fails loudly
    // rather than sliding back under the threshold unnoticed.
    const ratio = contrastRatio("hsl(28 20% 39%)", jcardPaper());
    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    expect(readFileSync(POSTER, "utf-8")).toContain('color: "hsl(28 20% 39%)"');
  });
});
