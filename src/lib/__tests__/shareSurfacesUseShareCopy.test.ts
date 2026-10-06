import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  shareAppCopy,
  shareCollabCopy,
  shareGuideCopy,
  shareSetlistCopy,
  shareSongCopy,
  shareSongbookCopy,
  shareVersionsCopy,
  type SharePayload,
} from "@/lib/shareCopy";

/**
 * The brand rule, asserted: a shared link sells what it is, and the music is
 * one tap away.
 *
 * Two halves, and both need pinning for different reasons.
 *
 * The COPY half is a source sweep, because the failure mode is a new surface
 * assembling its own string — which is how we got five different share texts,
 * one of which ("Dead Set — Every Deadhead knows the feeling") went out for
 * every song. A unit test on shareCopy cannot see that; only a scan of the
 * call sites can.
 *
 * The PAYLOAD half is a behavioural test, because a source sweep proving the
 * builder is CALLED proves nothing about what it returns (banked correction:
 * a test that greps for a string proves the string exists, not that it runs).
 * So every exported builder is invoked and its output checked.
 */

/** The repo's src/, resolved the way the other source-scanning tests here do. */
const SRC = resolve(__dirname, "../..");

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return entry === "__tests__" || entry === "ui" ? [] : walk(full);
    }
    return /\.tsx?$/.test(entry) ? [full] : [];
  });

/** Strip comments so a rule quoted in a docstring cannot satisfy its own test. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

/**
 * instagramShare.ts is the one exemption, and it is a medium exemption rather
 * than a convenience one. An Instagram caption is not a link share: Instagram
 * does not linkify body text, so a caption has no url to end on and no tap to
 * offer — it is long-form copy pasted into a post. It is also already
 * centralised in one module, which is what the rule is really protecting
 * against. If a caption ever starts carrying a shared link, delete this line.
 */
const CAPTION_MODULE = "lib/instagramShare.ts";

const files = walk(SRC).filter(
  (f) => !f.endsWith("shareCopy.ts") && !f.endsWith(CAPTION_MODULE),
);

it("the caption exemption still points at a file that exists", () => {
  // An exemption whose target was renamed silently stops exempting anything,
  // and worse, silently stops being reviewed.
  expect(files.some((f) => f.endsWith("lib/instagramShare.ts"))).toBe(false);
  expect(() => readFileSync(join(SRC, CAPTION_MODULE), "utf8")).not.toThrow();
});

describe("every share surface gets its copy from shareCopy", () => {
  /**
   * Match against EXTRACTED STRING LITERALS, not raw lines (banked correction).
   * The Privacy Policy says "When you create an account on Dead-Set.Org" as JSX
   * text, which is prose and not share copy; a line-oriented grep flags it and
   * a literal-oriented one does not, because JSX text is not quoted.
   */
  const literals = (src: string): string[] =>
    stripComments(src).match(
      /`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g,
    ) ?? [];

  /** Unicode escapes read as the emoji, since \u{1F339} is the same rose. */
  const unescapeEmoji = (s: string) =>
    s
      .replace(/\\u\{1F339\}|\\ud83c\\udf39/gi, "🌹")
      .replace(/\\u\{26A1\}|\\u26a1/gi, "⚡");

  const offendersWhere = (pred: (lit: string) => boolean): string[] =>
    files
      .filter((f) => literals(readFileSync(f, "utf8")).some(pred))
      .map((f) => f.replace(SRC, "src/"));

  /**
   * The brand stamp is shareCopy's to say. This catches a template literal, a
   * concatenated `t + " on Dead-Set.Org"`, and a lowercase `on dead-set.org` —
   * all three of which survived the first draft of this test.
   */
  it("no file outside shareCopy writes the 'on Dead-Set.Org' share stamp", () => {
    expect(offendersWhere((lit) => /on\s+dead-?set\.org/i.test(lit))).toEqual([]);
  });

  /** The rose/bolt skeleton retyped at a call site, escaped emoji included. */
  it("no file outside shareCopy retypes the rose/bolt share skeleton", () => {
    const offenders = files
      .filter((f) => {
        const lits = literals(readFileSync(f, "utf8")).map(unescapeEmoji);
        return lits.some((l) => l.includes("🌹")) && lits.some((l) => l.includes("⚡"));
      })
      .map((f) => f.replace(SRC, "src/"));
    expect(offenders).toEqual([]);
  });

  it("ShareDropdown requires `share` and keeps no fallback", () => {
    const src = readFileSync(join(SRC, "components/ShareDropdown.tsx"), "utf8");
    expect(src).toMatch(/^\s*share: \{ title: string; text: string \};\s*$/m);
    expect(src).not.toMatch(/share\?\s*:/);
    // No conditional on `share` — a ternary here is a second shape.
    expect(stripComments(src)).not.toMatch(/share\s*\?\s*[^.]/);
  });

  it("every ShareDropdown caller passes share=", () => {
    const callers = files.filter((f) =>
      /<ShareDropdown/.test(readFileSync(f, "utf8")),
    );
    expect(callers.length).toBeGreaterThanOrEqual(4);
    for (const file of callers) {
      const src = readFileSync(file, "utf8");
      const opens = src.match(/<ShareDropdown/g)?.length ?? 0;
      // Count real prop passes, not the literal string "share=" in a comment.
      const passes = stripComments(src).match(/\bshare=\{/g)?.length ?? 0;
      expect(passes, `${file.replace(SRC, "src/")} passes share=`).toBe(opens);
    }
  });
});

describe("every payload sells the thing and invites the tap", () => {
  const url = "https://dead-set.org/x/y";
  const cases: [string, SharePayload, string][] = [
    ["app", shareAppCopy({ url }), "Dead Set"],
    ["collab", shareCollabCopy({ setlistName: "Spring 77", url }), "Spring 77"],
    ["setlist", shareSetlistCopy({ setlistName: "Spring 77", url }), "Spring 77"],
    ["song", shareSongCopy({ songTitle: "Eyes of the World", url }), "Eyes of the World"],
    ["songbook", shareSongbookCopy({ songTitle: "Ramble On Rose", url }), "Ramble On Rose"],
    ["versions", shareVersionsCopy({ songTitle: "Althea", url }), "Althea"],
    ["guide", shareGuideCopy({ songTitle: "Bertha", url }), "Bertha"],
  ];

  for (const [kind, p, subject] of cases) {
    it(`${kind}: names its subject in both title and text`, () => {
      expect(p.title).toContain(subject);
      expect(p.text).toContain(subject);
    });

    it(`${kind}: ends with the url and carries it exactly once`, () => {
      expect(p.text.endsWith(url)).toBe(true);
      expect(p.text.split(url).length - 1).toBe(1);
    });

    it(`${kind}: invites a press of play, not just a brand stamp`, () => {
      // The second half of the rule. A payload whose closing line is only
      // "⚡ Dead-Set.Org" sells the site and asks for nothing.
      expect(p.text).toMatch(/⚡ .*(play|hear|listen)/i);
      expect(p.text).not.toMatch(/⚡ Dead-Set\.Org\s*$/m);
    });

    it(`${kind}: is not the generic app card unless it IS the app`, () => {
      if (kind !== "app") {
        expect(p.title).not.toContain("Every Deadhead knows the feeling");
      }
    });
  }

  it("names the sender when we know them, and does not when we do not", () => {
    expect(shareSongCopy({ songTitle: "Bertha", url, senderName: " ric neil " }).text)
      .toContain("ric neil sent you Bertha");
    expect(shareSongCopy({ songTitle: "Bertha", url, senderName: "  " }).text)
      .toContain("🌹 Bertha");
  });

  it("a song share carries the night when it has one", () => {
    const p = shareSongCopy({
      songTitle: "Scarlet Begonias",
      url,
      showDate: "1977-05-08",
      venue: "Barton Hall",
    });
    expect(p.title).toContain("1977-05-08 · Barton Hall");
    expect(p.text).toContain("1977-05-08 · Barton Hall");
  });

  it("a songbook share leads with the lifespan, which is the line people quote", () => {
    const p = shareSongbookCopy({
      songTitle: "Ramble On Rose",
      url,
      timesPlayed: 319,
      firstPlayed: "1971-10-19",
      lastPlayed: "1995-07-02",
      nightCount: 4,
      mappedBy: "ric neil",
    });
    expect(p.text).toContain("319 times · 1971 to 1995");
    expect(p.text).toContain("4 nights worth knowing");
    expect(p.text).toContain("mapped by ric neil");
  });
});
