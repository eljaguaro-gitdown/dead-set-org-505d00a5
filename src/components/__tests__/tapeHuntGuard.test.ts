import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Pressing Play All must change the screen, and pressing it twice must not
 * restart the work.
 *
 * Reported 2026-10-05: "I hit play all. Nothing. Hit it again. Nothing."
 * Cueing a guide costs one Archive round trip per night, which on a phone is
 * seconds, and nothing on screen said so. The second tap was the worse half —
 * `playSetlist` does `const seq = ++playSetlistSeqRef.current` and abandons any
 * run whose number has gone stale, so tapping again threw away the work in
 * flight and started the wait over. The silence taught the exact behaviour
 * that lengthened the silence.
 *
 * Both halves have to hold together: a guard with no feedback looks broken,
 * and feedback with no guard still lets the second tap restart everything. So
 * this asserts them as one claim, the way the gem badge and its reason are
 * asserted together.
 */
const read = (rel: string) => readFileSync(resolve(__dirname, rel), "utf8");

const SURFACES: { name: string; src: string; state: string }[] = [
  { name: "SetlistPoster (a saved guide)", src: read("../../pages/SetlistPoster.tsx"), state: "cueing" },
  { name: "VersionPicker (the sleepers queue)", src: read("../../pages/VersionPicker.tsx"), state: "cueingAll" },
];

describe("Play All says it is working, and ignores a second tap", () => {
  for (const { name, src, state } of SURFACES) {
    it(`${name} — bails out while already cueing`, () => {
      // The guard: an early return keyed on the pending flag.
      expect(src).toMatch(new RegExp(`if \\([^)]*${state}\\)\\s*return`));
    });

    it(`${name} — clears the flag even if cueing throws`, () => {
      // Without the finally, one failed cue disables the button for good.
      expect(src).toMatch(new RegExp(`finally\\s*\\{\\s*set${state[0].toUpperCase()}${state.slice(1)}\\(false\\)`));
    });

    it(`${name} — shows TapeHunt while it waits`, () => {
      expect(src).toContain("TapeHunt");
      // Rendered off the same flag that guards the tap, so the two cannot
      // drift — either `flag && <TapeHunt` or `flag ? <TapeHunt`.
      expect(src).toMatch(new RegExp(`${state}\\s*(\\?|&&)[\\s\\S]{0,80}TapeHunt`));
    });
  }

  it("TapeHunt never spins Charlie — a rotating portrait reads as a mistake", () => {
    const hunt = read("../TapeHunt.tsx");
    // The reel rotates; the breathe keyframe must not.
    expect(hunt).toMatch(/ds-tapehunt-spin[\s\S]*rotate\(360deg\)/);
    const breathe = hunt.slice(hunt.indexOf("@keyframes ds-tapehunt-breathe"));
    expect(breathe.slice(0, 200)).not.toMatch(/rotate\(/);
  });

  it("TapeHunt speaks in tape, not machinery", () => {
    const hunt = read("../TapeHunt.tsx");
    const lines = hunt.slice(hunt.indexOf("const LINES"), hunt.indexOf("const LINE_MS"));
    expect(lines).not.toMatch(/\b(AI|algorithm|model|engine|database|server|loading|processing)\b/i);
    expect(lines).toMatch(/tape|crate|reel|cue/i);
  });
});
