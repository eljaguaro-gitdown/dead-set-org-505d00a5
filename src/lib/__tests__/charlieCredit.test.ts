import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  CHARLIE_ABOUT_PATH,
  descriptionBy,
  suggestedNotesBy,
  withCharlieCredit,
} from "@/lib/charlieCredit";
import { METHOD_LINE, NO_VOTES_LINE } from "@/lib/sleeperMath";

/**
 * The credit rule (src/lib/charlieCredit.ts): Charlie's words carry
 * "*Cosmic Charlie" and a link to /about#cosmic-charlie wherever they go, and
 * words are credited by where they came from.
 */

const ROOT = join(__dirname, "../../..");
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (name === "node_modules" || name === "__tests__" || name.endsWith(".test.ts") || name.endsWith(".test.tsx")) return [];
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(name) ? [p] : [];
  });

describe("descriptionBy", () => {
  it("credits Charlie with a setlist's liner notes", () => {
    expect(descriptionBy("Opens hot, then the second set never comes back down.")).toBe("charlie");
  });

  it("knows the version picker's own lines are the site's", () => {
    expect(descriptionBy(NO_VOTES_LINE)).toBe("dead_set");
    expect(descriptionBy(`3 of these 15 poll under 30% of the leader. ${METHOD_LINE}`)).toBe("dead_set");
  });

  it("credits nobody with nothing", () => {
    expect(descriptionBy(null)).toBeNull();
    expect(descriptionBy("   ")).toBeNull();
  });
});

describe("withCharlieCredit", () => {
  it("puts the asterisk on his words and names him", () => {
    expect(withCharlieCredit("A Bertha that never lets up.")).toBe("A Bertha that never lets up.* *Cosmic Charlie");
  });

  it("can carry the link where there is room", () => {
    expect(withCharlieCredit("x", { withUrl: true })).toContain(`https://dead-set.org${CHARLIE_ABOUT_PATH}`);
  });

  it("points at the About section", () => {
    expect(CHARLIE_ABOUT_PATH).toBe("/about#cosmic-charlie");
  });
});

describe("suggestedNotesBy", () => {
  it("a suggestion's notes are Charlie's unless it says otherwise", () => {
    expect(suggestedNotesBy({ notes: "Patient opener." })).toBe("charlie");
    expect(suggestedNotesBy({ notes: "First time played: 1971-02-19", notesBy: "dead_set" })).toBe("dead_set");
    expect(suggestedNotesBy({ notes: "" })).toBeNull();
  });
});

describe("who writes setlists.description", () => {
  /**
   * descriptionBy() calls everything Charlie's except the version picker's two
   * lines. That holds only while the writers are the ones below. A new writer
   * needs a decision in charlieCredit.ts first, then a line here.
   */
  const KNOWN = [
    "src/pages/Builder.tsx", // Charlie's explanation when he builds a night
    "src/pages/VersionPicker.tsx", // METHOD_LINE / NO_VOTES_LINE on a saved guide
    "supabase/functions/generate-setlist-description/index.ts", // Charlie's liner notes on request
  ].sort();

  it("has no writer the credit rule doesn't know about", () => {
    const files = [...walk(join(ROOT, "src")), ...walk(join(ROOT, "supabase/functions"))];
    const writers = new Set<string>();
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/from\(\s*"setlists"\s*\)/g)) {
        const window = src.slice(m.index!, m.index! + 700);
        const call = window.match(/\.(insert|update|upsert)\(([\s\S]*?)\)\s*[.;\n]/);
        if (call && /\bdescription\b/.test(call[2])) writers.add(relative(ROOT, f));
      }
    }
    expect([...writers].sort()).toEqual(KNOWN);
  });
});
