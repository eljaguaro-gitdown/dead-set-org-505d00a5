import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * The global player covers the bottom of the viewport on every page, and the
 * amount it covers has to be MEASURED — it is drag-resizable, it has two
 * implementations of different heights, and its error banner hangs above its
 * own box. Pages that anchor something to the bottom (VersionPicker's Keep
 * bar, Messages' composer) each need that number.
 *
 * A second copy of a measurement that fiddly is a silent divergence waiting to
 * happen: the two would drift and one page would quietly stop clearing the
 * player, exactly as the duplicated archive-notes encoder did. So assert there
 * is ONE implementation, the same invariant encodeArchiveNotesSingleSource
 * asserts for the notes blob.
 */

const SRC = join(__dirname, "..", "..");

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === "__tests__" ? [] : walk(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });

describe("the global-player measurement has one home", () => {
  const files = walk(SRC);

  it("only useGlobalPlayerHeight queries [data-global-player]", () => {
    const queriers = files.filter((f) =>
      readFileSync(f, "utf8").includes("[data-global-player]"),
    );
    expect(queriers.map((f) => f.slice(SRC.length + 1))).toEqual([
      join("hooks", "useGlobalPlayerHeight.ts"),
    ]);
  });

  it("every page that offsets for the player uses the hook", () => {
    // A page holding its own playerHeight state is a page that has forked the
    // measurement — the thing this test exists to prevent.
    const forked = files.filter((f) => {
      const src = readFileSync(f, "utf8");
      return (
        /setPlayerHeight/.test(src) &&
        !f.endsWith(join("hooks", "useGlobalPlayerHeight.ts"))
      );
    });
    expect(forked.map((f) => f.slice(SRC.length + 1))).toEqual([]);
  });
});
