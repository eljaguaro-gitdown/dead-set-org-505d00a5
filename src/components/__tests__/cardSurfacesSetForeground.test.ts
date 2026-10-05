import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

/**
 * Any overlay painted on `bg-card` must also set `text-card-foreground`.
 *
 * `--foreground` is cream and so is `--card`, so a title that inherits the
 * page colour measures 1.19:1 on the card, and Radix's close "X" inherits it
 * at 70% opacity — measured at 1.13:1 before this was fixed, 5.22:1 after.
 * CLAUDE.md has carried the rule since the 2026-10-02 gate; it was missed
 * three more times anyway, most consequentially on `AuthModal`, the sign-in
 * sheet every new visitor meets.
 *
 * WHAT THIS CAN AND CANNOT SEE — read before trusting it.
 *
 * It scans source text, so it catches a class list that is *written down*:
 * a plain string, a `cn(...)` call, or a template literal, including when
 * arrow-function props sit before className. It rejects a variant-prefixed
 * token (`hover:text-card-foreground` does not count, because the colour must
 * apply at rest).
 *
 * It CANNOT see a class name assembled at runtime from variables, a `bg-card`
 * applied to an inner wrapper rather than the Content element, or a surface
 * built from a primitive other than the four below (Popover, DropdownMenu,
 * Select and Tooltip content are not scanned). The first version of this file
 * claimed "the fourth instance fails here instead of shipping"; the gate
 * disproved that in four ways. It fails for the written-down case, which is
 * how all four real offenders were written, and that is the honest claim.
 */
const PRIMITIVES = ["Dialog", "Sheet", "AlertDialog", "Drawer"];

/**
 * The text of one JSX opening tag, from `<XContent` to its closing `>`,
 * tracking brace depth and quotes so a `>` inside an arrow-function prop or a
 * string does not end the tag early — which is how the earlier regex silently
 * skipped a Content whose props happened to contain one.
 */
const openingTag = (src: string, from: number): string => {
  let depth = 0;
  let quote: string | null = null;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === quote && src[i - 1] !== "\\") quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0) return src.slice(from, i + 1);
  }
  return src.slice(from);
};

/** Every quoted run inside the tag — covers plain, cn(...) and template forms. */
const literals = (tag: string): string =>
  (tag.match(/(["'`])(?:\\.|(?!\1)[\s\S])*\1/g) ?? []).join(" ");

/** At rest, not behind a variant: `hover:text-card-foreground` does not count. */
const SETS_FOREGROUND = /(?<![\w:-])text-card-foreground\b/;
const ON_CARD = /(?<![\w:-])bg-card\b/;

const root = resolve(__dirname, "../../..");
const files = execSync("git ls-files 'src/**/*.tsx'", { cwd: root, encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

describe("overlays on the cream card set their own foreground", () => {
  it("scans a real list of files (guards against the glob going empty)", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("finds the Content tags it claims to check", () => {
    let seen = 0;
    for (const rel of files) {
      const src = readFileSync(resolve(root, rel), "utf8");
      for (const p of PRIMITIVES) {
        let i = src.indexOf(`<${p}Content`);
        while (i !== -1) { seen++; i = src.indexOf(`<${p}Content`, i + 1); }
      }
    }
    // ~15 across the app today; a parser change that finds none must fail here
    // rather than report a clean sweep of nothing.
    expect(seen).toBeGreaterThan(8);
  });

  it("no overlay on bg-card inherits the page colour", () => {
    const offenders: string[] = [];
    for (const rel of files) {
      const src = readFileSync(resolve(root, rel), "utf8");
      for (const p of PRIMITIVES) {
        let i = src.indexOf(`<${p}Content`);
        while (i !== -1) {
          const classes = literals(openingTag(src, i));
          if (ON_CARD.test(classes) && !SETS_FOREGROUND.test(classes)) {
            offenders.push(`${rel}: <${p}Content … ${classes.slice(0, 90)}>`);
          }
          i = src.indexOf(`<${p}Content`, i + 1);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
