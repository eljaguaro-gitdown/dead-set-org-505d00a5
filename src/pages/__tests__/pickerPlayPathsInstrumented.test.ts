import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Every way to start audio on the picker must report that a play happened.
 *
 * On 2026-10-05 only one of the four play paths captured anything — the
 * hero's debut-tape branch. `playMilestone`, `playVersion` and `playAll`
 * started audio silently, so a visitor who tapped any night other than the
 * hero's debut counted as "did not play". That number is the numerator of
 * `version_picker_viewed -> played`, the single ratio the song-first front
 * door experiment is graded on, and it was reporting a fraction of reality.
 *
 * Checking the four known paths by name would not have caught it, because the
 * bug was a path nobody thought to check. So this asserts the shape instead:
 * no call that starts audio may stand without a capture near it. A fifth play
 * path added later fails this test until it reports too.
 */
const SOURCE = readFileSync(
  resolve(__dirname, "../VersionPicker.tsx"),
  "utf8",
).split("\n");

/** Calls that actually start audio. */
const STARTS_AUDIO = /\b(playSingle|playSetlist)\s*\(/;
const CAPTURES = /\bcapturePlayed\s*\(/;

/**
 * A play call reports if a capturePlayed appears within the same handler after
 * it. 40 lines clears the longest slot literal on the page with room to spare.
 */
const WINDOW = 40;

describe("every play path on the picker reports a play", () => {
  const playCallLines = SOURCE.flatMap((line, i) =>
    STARTS_AUDIO.test(line) ? [i] : [],
  );

  it("finds the play calls at all (guards against the regex going stale)", () => {
    // playHero, playMilestone, playVersion, playAll — if a rename makes this
    // zero, the test below would pass vacuously and prove nothing.
    expect(playCallLines.length).toBeGreaterThanOrEqual(4);
  });

  it.each([0, 1, 2, 3].slice(0, 4))("play call #%i is followed by a capture", (n) => {
    const start = playCallLines[n];
    expect(start).toBeDefined();
    const after = SOURCE.slice(start, start + WINDOW).join("\n");
    expect(after).toMatch(CAPTURES);
  });

  it("leaves no play call uninstrumented, however many there are", () => {
    const unreported = playCallLines.filter((start) => {
      const after = SOURCE.slice(start, start + WINDOW).join("\n");
      return !CAPTURES.test(after);
    });
    expect(unreported.map((i) => `L${i + 1}: ${SOURCE[i].trim()}`)).toEqual([]);
  });

  it("keeps the debut event, so its history stays comparable", () => {
    expect(SOURCE.join("\n")).toContain('captureEvent("version_picker_played_debut"');
  });
});
