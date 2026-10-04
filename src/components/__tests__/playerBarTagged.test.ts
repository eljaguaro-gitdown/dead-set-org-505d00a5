import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Both player implementations must carry `data-global-player`.
 *
 * GlobalAudioPlayer mounts GaplessPlayerBar by default and only falls back to
 * AudioPlayer when localStorage player_engine is "legacy". A page-level bottom
 * bar measures the tagged element to sit above it, so tagging one of the two
 * produces a fix that works on the engine almost nobody runs — which is what
 * shipped to a release gate and was caught in a browser, not in code.
 *
 * This is the same invariant as encodeArchiveNotesSingleSource: when two
 * implementations of one thing exist, the thing worth asserting is that they
 * agree, not that either one works.
 */
const read = (p: string) => readFileSync(p, "utf8");

describe("every player bar is measurable", () => {
  const players = [
    "src/components/GaplessPlayerBar.tsx",
    "src/components/AudioPlayer.tsx",
  ];

  for (const file of players) {
    it(`${file} carries data-global-player`, () => {
      expect(read(file)).toContain("data-global-player");
    });
  }

  it("GlobalAudioPlayer mounts only these two, so none can be missed", () => {
    const src = read("src/components/GlobalAudioPlayer.tsx");
    // Match the opening tag whether or not props follow on later lines —
    // <AudioPlayer\n  key={…} is the shape that actually appears here.
    const mounted = [...src.matchAll(/<([A-Z][A-Za-z]*)[\s/>]/g)].map((m) => m[1]);
    const unique = [...new Set(mounted)];
    expect(unique.sort()).toEqual(["AudioPlayer", "GaplessPlayerBar"]);
  });
});
