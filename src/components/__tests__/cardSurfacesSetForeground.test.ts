import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

/**
 * Any overlay painted on `bg-card` must also set `text-card-foreground`.
 *
 * `--foreground` is cream and so is `--card`, so a title that inherits the
 * page colour measures 1.19:1 on the card, and Radix's close "X" inherits it
 * too, at 70% opacity. CLAUDE.md has carried this correction since the
 * 2026-10-02 gate blocked on it in four dialogs.
 *
 * It has now been missed three separate times — most recently Cosmic Charlie's
 * own dialog, found by another session on 2026-10-05, two days after the rule
 * was written down. A rule in prose does not survive a codebase; this does the
 * same job mechanically, across every file at once, so the fourth instance
 * fails here instead of shipping.
 *
 * Buttons set their own colours and are unaffected, which is why this looks
 * only at the Content wrappers.
 */
const CONTENT = /<(Dialog|Sheet|AlertDialog|Drawer)Content[^>]*className="([^"]*)"/g;

/** Every .tsx under src/, straight from git so the list cannot go stale. */
const files = execSync("git ls-files 'src/**/*.tsx'", {
  cwd: resolve(__dirname, "../../.."),
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean);

describe("overlays on the cream card set their own foreground", () => {
  it("scans a real list of files (guards against the glob going empty)", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("no Dialog/Sheet/AlertDialog/Drawer on bg-card inherits the page colour", () => {
    const offenders: string[] = [];
    for (const rel of files) {
      const src = readFileSync(resolve(__dirname, "../../..", rel), "utf8");
      for (const m of src.matchAll(CONTENT)) {
        const classes = m[2];
        if (/\bbg-card\b/.test(classes) && !/\btext-card-foreground\b/.test(classes)) {
          offenders.push(`${rel}: <${m[1]}Content className="${classes}">`);
        }
      }
    }
    // Name the file and the class list — a bare count sends the next reader hunting.
    expect(offenders).toEqual([]);
  });
});
