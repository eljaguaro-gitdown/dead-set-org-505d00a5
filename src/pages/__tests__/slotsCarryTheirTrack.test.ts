import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Every slot handed to the player states whether it has a track.
 *
 * On 2026-10-05 the picker built slots with `archive_org_url` and no
 * `directTrackUrl`, although the lookup that produced the URL had already
 * located the exact file. The player then re-fetched the same 78KB of
 * metadata before it could make a sound — 404ms of the 444ms between tap and
 * audio, and the only network hop in that window. On a good connection it
 * won; on a bad one you got the right song, the right night, and silence.
 *
 * The rule is not "always pass a track" — `playAll` and Charlie's own picks
 * genuinely name a night and nothing more. The rule is that the key is always
 * PRESENT, so "no track known" is written down rather than looking the same as
 * "track forgotten". A new slot literal that omits it fails here.
 */
const FILES = [
  "../VersionPicker.tsx",
  "../../components/CosmicCharlieDialog.tsx",
];

/** Slot object literals, found by the field every one of them carries. */
const slotLiterals = (src: string): string[] => {
  const out: string[] = [];
  const lines = src.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!/\bsegueToNext\s*:/.test(lines[i])) continue;
    // A slot literal's tail: segueToNext is last or near-last, so look at the
    // lines around it for the sibling keys.
    out.push(lines.slice(Math.max(0, i - 24), i + 8).join("\n"));
  }
  return out;
};

describe("every player slot states its track", () => {
  for (const rel of FILES) {
    const src = readFileSync(resolve(__dirname, rel), "utf8");
    const literals = slotLiterals(src);

    it(`${rel} — finds slot literals at all`, () => {
      expect(literals.length).toBeGreaterThan(0);
    });

    it(`${rel} — every slot carrying an archive url also states directTrackUrl`, () => {
      // Accept the ES6 shorthand `directTrackUrl,` as well as `directTrackUrl:`.
      // Requiring the colon flagged playVersion, which passes it correctly as
      // shorthand — a test that fails a correct implementation is worse than
      // no test, because the next person deletes it.
      const missing = literals.filter(
        (lit) =>
          /archive_org_url\s*:/.test(lit) && !/\bdirectTrackUrl\s*[,:}]/.test(lit),
      );
      // Print the offending literal, not just a count — a bare number here
      // sends the next reader hunting through 1300 lines.
      expect(missing).toEqual([]);
    });
  }
});
