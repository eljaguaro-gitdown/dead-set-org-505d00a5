import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Every way to start audio on the picker must report that a play happened.
 *
 * On 2026-10-05 only one of the four play paths captured anything — the
 * hero's debut-tape branch. playMilestone, playVersion and playAll started
 * audio silently, so a visitor who tapped any night other than the hero's
 * debut counted as "did not play". That is the numerator of
 * version_picker_viewed -> played, the one ratio the song-first front door
 * experiment is graded on, and it was reporting a fraction of reality.
 *
 * Two earlier versions of this test were too weak, both found by the gate:
 *
 *   1. "a capturePlayed within 40 lines after the play call" — a new path
 *      placed near another path's capture borrowed it and passed.
 *   2. "a capturePlayed before the next handler begins" — same hole. Two play
 *      calls in ONE handler still share the single capture that follows them.
 *
 * So the rule is a COUNT, per handler: a handler that starts audio N times
 * must report N times. That is the thing a borrowed capture cannot satisfy.
 */
const SOURCE = readFileSync(resolve(__dirname, "../VersionPicker.tsx"), "utf8").split("\n");

const STARTS_AUDIO = /\b(playSingle|playSetlist)\s*\(/;
const CAPTURES = /\bcapturePlayed\s*\(/;
const HANDLER = /^\s*const\s+(play[A-Z]\w*)\s*=/;

/** Each `const playX = …` handler, sliced to the start of the next one. */
const handlers = (): { name: string; body: string[] }[] => {
  const starts: { name: string; line: number }[] = [];
  SOURCE.forEach((l, i) => {
    const m = l.match(HANDLER);
    if (m) starts.push({ name: m[1], line: i });
  });
  return starts.map((s, i) => ({
    name: s.name,
    body: SOURCE.slice(s.line, i + 1 < starts.length ? starts[i + 1].line : SOURCE.length),
  }));
};

const count = (body: string[], re: RegExp) => body.filter((l) => re.test(l)).length;

describe("every play path on the picker reports a play", () => {
  const all = handlers();
  const audioHandlers = all.filter((h) => count(h.body, STARTS_AUDIO) > 0);

  it("finds the handlers at all (so the test cannot pass vacuously)", () => {
    // playHero, playMilestone, playVersion, playAll.
    expect(audioHandlers.map((h) => h.name).sort()).toEqual(
      ["playAll", "playHero", "playMilestone", "playVersion"],
    );
  });

  it("reports once per audio start, in every handler", () => {
    const short = audioHandlers
      .map((h) => ({
        name: h.name,
        starts: count(h.body, STARTS_AUDIO),
        reports: count(h.body, CAPTURES),
      }))
      .filter((h) => h.reports < h.starts);
    // Name the handler and both counts — a bare number sends the next reader
    // hunting through 1300 lines.
    expect(short).toEqual([]);
  });

  it("keeps the debut event, so its history stays comparable", () => {
    expect(SOURCE.join("\n")).toContain('captureEvent("version_picker_played_debut"');
  });
});
