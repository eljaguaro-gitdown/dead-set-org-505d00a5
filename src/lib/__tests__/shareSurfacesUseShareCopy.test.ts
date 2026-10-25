import { describe, it, expect } from "vitest";
import { listSourceFiles, readSource } from "@/test/sourceFiles";
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
const CAPTION_MODULE = "src/lib/instagramShare.ts";

/** Repo paths ("src/lib/shareSong.ts"), forward slashes on every platform. */
const files = listSourceFiles("src", { skipDirs: ["__tests__", "ui"] }).filter(
  (f) => !f.endsWith("shareCopy.ts") && f !== CAPTION_MODULE,
);

it("the caption exemption still points at a file that exists", () => {
  // An exemption whose target was renamed silently stops exempting anything,
  // and worse, silently stops being reviewed.
  expect(files.some((f) => f.endsWith("lib/instagramShare.ts"))).toBe(false);
  expect(() => readSource(CAPTION_MODULE)).not.toThrow();
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
    files.filter((f) => literals(readSource(f)).some(pred));

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
    const offenders = files.filter((f) => {
      const lits = literals(readSource(f)).map(unescapeEmoji);
      return lits.some((l) => l.includes("🌹")) && lits.some((l) => l.includes("⚡"));
    });
    expect(offenders).toEqual([]);
  });

  /**
   * The shape of the defect the gate blocked on: a template literal that
   * interpolates a payload's TEXT (which ends in the url) and then a url. Both
   * real cases looked like this — SendToFriendDialog's DM body and ShareFlow's
   * tweet — and a test on the builders' output cannot see either.
   *
   * The first draft of THIS test was itself blind to the defect: its regex
   * captured only the first segment of `${share.text}` and did not match
   * `SHARE_TEXT` at all, so the re-gate reinstated the original defect in the
   * very file that had been de-duplicated and the suite stayed green. The
   * identifier match below covers all three spellings a person actually
   * writes, and the concatenated form as well.
   */
  /**
   * Split an identifier into words, so one rule covers every spelling:
   * shareText, SHARE_TEXT, share.text and p.body all normalise the same way.
   * "someContext" becomes ["some","context"], which is NOT a text identifier —
   * the word has to be "text", not merely end in those letters.
   */
  const words = (e: string) =>
    e.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase().split(/[._]+/).filter(Boolean);

  const isTextIdent = (e: string) => words(e).at(-1) === "text";
  /** `linkToShare` and `socialUrl` are both the link — match the word anywhere. */
  const isUrlIdent = (e: string) =>
    words(e).some((w) => w === "url" || w === "link" || w === "href");

  it("no surface appends a url to a payload's text", () => {
    const offenders: string[] = [];
    for (const file of files) {
      for (const lit of literals(readSource(file))) {
        if (!lit.startsWith("`")) continue;
        // The whole expression inside ${...}, not just its first identifier.
        const exprs = [...lit.matchAll(/\$\{([^}]*)\}/g)].map((m) => m[1].trim());
        if (exprs.some(isTextIdent) && exprs.some(isUrlIdent)) {
          offenders.push(`${file}  ${lit}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("no surface concatenates a payload's text with a url", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const src = stripComments(readSource(file));
      // Per statement, not by pairing adjacent identifiers: a lazy regex
      // matched the `n` inside a "\n" separator as the second identifier and
      // never reached `linkToShare`, so the concatenated form walked through.
      for (const stmt of src.split(/[;\n]/)) {
        if (!stmt.includes("+")) continue;
        const idents = stmt.match(/[A-Za-z_$][\w$.]*/g) ?? [];
        if (idents.some(isTextIdent) && idents.some(isUrlIdent)) {
          offenders.push(`${file}  ${stmt.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  /**
   * The other half of the same rule: a native share sheet takes the link in its
   * own field, so the `text` it is given must be the url-less half. Reverting
   * any of the six calls to the url-carrying half stayed green before this.
   */
  it("every navigator.share that passes a url passes the url-less body as text", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const src = stripComments(readSource(file));
      for (const m of src.matchAll(/navigator\.share\(\{([^}]*)\}/g)) {
        const args = m[1];
        // SHORTHAND counts: `navigator.share({ title, text, url })` passes the
        // variable `text`, and two real calls are written exactly that way —
        // they survived a `text\s*:` regex that only saw explicit properties.
        const prop = (name: string): string | null => {
          const explicit = args.match(new RegExp(`\\b${name}\\s*:\\s*([A-Za-z_$][\\w$.]*)`));
          if (explicit) return explicit[1];
          return new RegExp(`(?:^|,)\\s*${name}\\s*(?:,|$)`).test(args) ? name : null;
        };
        if (!prop("url")) continue; // files-only shares are exempt
        const text = prop("text");
        if (text && isTextIdent(text)) {
          offenders.push(`${file}  text: ${text}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("ShareDropdown requires `share` and keeps no fallback", () => {
    const src = readSource("src/components/ShareDropdown.tsx");
    // Typed as SharePayload rather than a structural copy, which could drift
    // from it — and did, once `body` was added.
    expect(src).toMatch(/^\s*share: SharePayload;\s*$/m);
    expect(src).not.toMatch(/share\?\s*:/);
    // No conditional on `share` — a ternary here is a second shape.
    expect(stripComments(src)).not.toMatch(/share\s*\?\s*[^.]/);
  });

  it("every ShareDropdown caller passes share=", () => {
    const callers = files.filter((f) =>
      /<ShareDropdown/.test(readSource(f)),
    );
    expect(callers.length).toBeGreaterThanOrEqual(4);
    for (const file of callers) {
      const src = readSource(file);
      const opens = src.match(/<ShareDropdown/g)?.length ?? 0;
      // Count real prop passes, not the literal string "share=" in a comment.
      const passes = stripComments(src).match(/\bshare=\{/g)?.length ?? 0;
      expect(passes, `${file} passes share=`).toBe(opens);
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

    it(`${kind}: text ends with the url and carries it exactly once`, () => {
      expect(p.text.endsWith(url)).toBe(true);
      expect(p.text.split(url).length - 1).toBe(1);
    });

    it(`${kind}: body carries NO url, so a caller may append one`, () => {
      // The pre-release gate blocked on two surfaces appending the link to a
      // string that already ended in it. `body` is the half that is safe to
      // append to, and this is what makes that true rather than customary.
      expect(p.body).not.toContain(url);
      expect(p.body).not.toMatch(/https?:\/\//);
      expect(p.url).toBe(url);
      expect(p.text).toBe(`${p.body}\n\n${p.url}`);
    });

    it(`${kind}: the body offers no second link to tap`, () => {
      // WhatsApp linkifies a bare "Dead-Set.Org", so a brand stamp in the
      // listen line rendered as a tappable link ABOVE the real url — pointing
      // at the home page rather than the song. The whole message should carry
      // exactly one thing to tap, and it should be the one that plays.
      expect(p.body.toLowerCase()).not.toContain("dead-set.org");
      expect(p.text.toLowerCase().split("dead-set.org").length - 1).toBe(1);
    });

    it(`${kind}: body still names its subject and invites the tap`, () => {
      // Everything the share has to SELL must survive in the half that goes to
      // the native sheet — that is the half most people see.
      expect(p.body).toContain(subject);
      expect(p.body).toMatch(/⚡ .*(play|hear|listen)/i);
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
