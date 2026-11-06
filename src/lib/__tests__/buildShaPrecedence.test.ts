import { describe, it, expect } from "vitest";
import {
  resolveBuildSha,
  renderBuildInfo,
  parseBuildInfo,
  STAMP_SUBJECT_PREFIX,
} from "../../../scripts/build-sha/resolve.mjs";

/**
 * vite.config.ts decides the sha with this function, so the rules are pinned
 * here rather than read off the config by eye. Each case is a builder:
 * Lovable's publish (no git at all), CI and the iOS workflow (git, HEAD is the
 * stamp commit), a developer's checkout (git, HEAD is their own commit).
 */
const CODE = "0be14ccd7618edfc5d371f7293eab3c4cc9b987f";
const STAMP = "9b1f2d3e4a5b6c7d8e9f0a1b2c3d4e5f60718293";
const DEV = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const noGit = { gitHead: "", gitHeadSubject: "", gitParent: "" };

describe("resolveBuildSha", () => {
  it("Lovable: no git at all, the stamped file names the code commit", () => {
    expect(resolveBuildSha({ env: undefined, ...noGit, stamped: CODE })).toBe(CODE);
  });

  it("Lovable before any stamp has landed: unknown, never a made-up value", () => {
    expect(resolveBuildSha({ env: undefined, ...noGit, stamped: "" })).toBe("unknown");
  });

  it("CI building main at the stamp commit reports the CODE commit, same as Lovable", () => {
    expect(
      resolveBuildSha({
        env: undefined,
        gitHead: STAMP,
        gitHeadSubject: `${STAMP_SUBJECT_PREFIX} ${CODE} [skip ci]`,
        gitParent: CODE,
        stamped: CODE,
      }),
    ).toBe(CODE);
  });

  it("a stamp-looking subject whose file disagrees with the parent is NOT trusted", () => {
    // Someone hand-edited the file, or a rebase moved the stamp onto other
    // code. The file is then a claim about a commit that is not HEAD's parent.
    expect(
      resolveBuildSha({
        env: undefined,
        gitHead: STAMP,
        gitHeadSubject: `${STAMP_SUBJECT_PREFIX} ${CODE}`,
        gitParent: DEV,
        stamped: CODE,
      }),
    ).toBe(STAMP);
  });

  it("a developer's own commit wins over a stale stamped file", () => {
    expect(
      resolveBuildSha({ env: undefined, gitHead: DEV, gitHeadSubject: "Player: fix", gitParent: CODE, stamped: CODE }),
    ).toBe(DEV);
  });

  it("VITE_BUILD_SHA beats everything", () => {
    expect(
      resolveBuildSha({ env: DEV, gitHead: STAMP, gitHeadSubject: `${STAMP_SUBJECT_PREFIX} x`, gitParent: CODE, stamped: CODE }),
    ).toBe(DEV);
  });

  it("ignores a malformed VITE_BUILD_SHA rather than stamping junk on every event", () => {
    expect(resolveBuildSha({ env: "main", ...noGit, stamped: CODE })).toBe(CODE);
  });
});

describe("the stamped file round-trips", () => {
  it("renders one line of data that parses back", () => {
    const text = renderBuildInfo(CODE, "2026-11-06T00:00:00.000Z");
    expect(parseBuildInfo(text)).toBe(CODE);
    expect(text).toContain(`sha: "${CODE}"`);
  });
  it("parses nothing out of an empty or hand-broken file", () => {
    expect(parseBuildInfo("")).toBe("");
    expect(parseBuildInfo('export const BUILD_INFO = { sha: "unknown" }')).toBe("");
  });
});
