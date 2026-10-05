import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Two different places build a "<Song> — Listening Guide": the Version Picker
 * and Cosmic Charlie's Version Explorer. Both produce the same artifact, and
 * the first guide for a song is supposed to become that song's Songbook entry,
 * credited to whoever made it.
 *
 * Only one of them did. VersionPicker called contributeToSongbook; the Charlie
 * path handed its suggestion to Builder's onCreateNewSetlist and walked away,
 * so a guide made through Charlie saved perfectly and the shelf never heard
 * about it. ric neil's Eyes of the World guide on 2026-10-05 is the one that
 * exposed it — the feature looked wired because the path anyone checked was.
 *
 * Same family as the two archive-notes encoders and the two player bars: when
 * two implementations produce one thing, assert they AGREE, because each is
 * independently "working" and no test of either can see the divergence.
 */

const SRC = join(__dirname, "..", "..");

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === "__tests__" ? [] : walk(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });

/**
 * Comments are stripped before scanning. Without that, any file that merely
 * MENTIONS a guide by name in prose counts as one that creates a guide —
 * lib/listeningGuide.ts documents "Ramble On Rose — Listening Guide" in a
 * comment and was flagged on the first run. Stripping also keeps the check
 * honest about how the title is built: an interpolation, a concatenation or a
 * plain literal all still match, so a future edit cannot slip past by changing
 * the quoting style.
 */
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

/** Files that mint a listening-guide title, i.e. that create one. */
const guideMakers = () =>
  walk(SRC).filter((f) =>
    /—\s*Listening Guide/.test(stripComments(readFileSync(f, "utf8"))),
  );

describe("every path that creates a listening guide files it in the Songbook", () => {
  const makers = guideMakers();

  it("found the guide-creating files (guards a silently empty match)", () => {
    expect(makers.length).toBeGreaterThanOrEqual(2);
  });

  it.each(guideMakers().map((f) => f.slice(SRC.length + 1)))(
    "%s reaches contributeToSongbook",
    (rel) => {
      // Stripped here too, not just when finding the files. Without it the
      // JSDoc above the onCreateNewSetlist prop — which names songbookSongId —
      // satisfied the delegation check on its own, and reverting the entire
      // Charlie fix left this test green. Verified by doing exactly that.
      const src = stripComments(readFileSync(join(SRC, rel), "utf8"));
      // Either it files the entry itself, or it hands the song id to the
      // caller that does. Passing neither is the defect this test exists for.
      const filesItself = /contributeToSongbook\s*\(/.test(src);
      const delegates = /songbookSongId/.test(src);
      expect(
        filesItself || delegates,
        `${rel} creates a listening guide but neither calls contributeToSongbook nor passes songbookSongId`,
      ).toBe(true);
    },
  );

  it("Builder actually files what the dialog delegates to it", () => {
    // The delegation above is only worth anything if the receiving end uses it.
    const builder = stripComments(
      readFileSync(join(SRC, "pages", "Builder.tsx"), "utf8"),
    );
    expect(builder).toMatch(/songbookSongId/);
    expect(builder).toMatch(/contributeToSongbook\s*\(/);
    // And it must pass the delegated id, not some other song.
    expect(builder).toMatch(/songId:\s*songbookSongId/);
  });
});
