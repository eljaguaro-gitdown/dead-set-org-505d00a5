import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Two surfaces the .tsx brand sweep cannot see.
 *
 * index.html's meta is what every unfurl of a dead-set.org link shows. Every
 * route is client-rendered and a crawler does not run JS, so a shared setlist,
 * a Songbook issue and the homepage all unfurl as this copy. Until 2026-10-07
 * it called Dead Set "a discovery tool" and credited the card to `@Lovable`
 * (the scaffold's twitter:site, never changed). "Nobody here is using a tool"
 * is the field guide's closing line, and the builder's name is the machinery
 * the brand rule keeps out of the room.
 *
 * The beta-nudge email is HTML in a .ts file, and it said Charlie "generates"
 * setlists.
 */
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

// `generat\w*` covers generate/generated/generator. `tool` is banned for what
// Dead Set and Charlie are.
const BANNED = /\b(ai|a\.i\.|algorithm|algorithms|model|generat\w*|tool|tools|gemini|posthog|lovable|recommendation engine)\b/i;

/** The copy a person sees in an unfurl: <title> and every meta `content`. */
const metaCopy = (html: string): Array<{ name: string; content: string }> => {
  const out: Array<{ name: string; content: string }> = [];
  const title = html.match(/<title>([^<]*)<\/title>/);
  if (title) out.push({ name: "title", content: title[1] });
  for (const m of html.matchAll(/<meta\s+(?:name|property)="([^"]+)"\s+content="([^"]*)"/g)) {
    out.push({ name: m[1], content: m[2] });
  }
  return out;
};

/** Visible text of an HTML template: styles and tags removed, text between them kept. */
const visibleText = (html: string): string[] =>
  Array.from(
    html.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").matchAll(/>([^<>]+)</g),
  )
    .map((m) => m[1].replace(/\s+/g, " ").trim())
    .filter((t) => t.length > 0);

describe("index.html link-preview copy", () => {
  const meta = metaCopy(read("index.html"));

  it("finds the description and social tags, or the sweep is vacuous", () => {
    const names = meta.map((m) => m.name);
    expect(names).toEqual(
      expect.arrayContaining(["title", "description", "og:title", "og:description", "twitter:title", "twitter:description"]),
    );
  });

  it("carries no banned word", () => {
    const offenders = meta.filter((m) => BANNED.test(m.content)).map((m) => `${m.name}: ${m.content}`);
    expect(offenders).toEqual([]);
  });

  it("credits the card to no one else's account", () => {
    // twitter:site names the account the card belongs to. It said @Lovable.
    // Nothing here names a Dead Set account on X, so the tag stays out rather
    // than guessing one. If Dead Set gets an account, change this test with it.
    expect(meta.find((m) => m.name === "twitter:site")).toBeUndefined();
  });

  it("puts the Internet Archive credit in every description", () => {
    for (const name of ["description", "og:description", "twitter:description"]) {
      const tag = meta.find((m) => m.name === name);
      expect(tag?.content, name).toMatch(/tapers, the traders, and the Internet Archive/);
    }
  });
});

describe("beta-nudge email copy", () => {
  it("carries no banned word in its visible text", () => {
    const text = visibleText(read("supabase/functions/send-beta-nudge/template.ts"));
    expect(text.length).toBeGreaterThan(20);
    expect(text.filter((t) => BANNED.test(t))).toEqual([]);
  });
});
