import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

/**
 * The runtime half of build attribution: when the define is missing or
 * "unknown" (Lovable's git-less build), the committed stamp is the answer.
 */
const CODE = "0be14ccd7618edfc5d371f7293eab3c4cc9b987f";
const DEFINED = "1111111111111111111111111111111111111111";

const stamped = vi.hoisted(() => ({ sha: "" }));
vi.mock("@/buildInfo", () => ({ BUILD_INFO: stamped }));

beforeEach(() => {
  stamped.sha = "";
  vi.resetModules();
});
afterEach(() => vi.unstubAllGlobals());

const load = () => import("@/lib/buildSha");

describe("buildSha", () => {
  it("prefers the define when it is a real sha", async () => {
    vi.stubGlobal("__BUILD_SHA__", DEFINED);
    stamped.sha = CODE;
    expect((await load()).buildSha()).toBe(DEFINED);
  });
  it("falls back to the stamped file when the define says unknown", async () => {
    vi.stubGlobal("__BUILD_SHA__", "unknown");
    stamped.sha = CODE;
    expect((await load()).buildSha()).toBe(CODE);
  });
  it("falls back to the stamped file when the define does not exist", async () => {
    stamped.sha = CODE;
    expect((await load()).buildSha()).toBe(CODE);
  });
  it("says unknown only when neither knows", async () => {
    vi.stubGlobal("__BUILD_SHA__", "unknown");
    const m = await load();
    expect(m.buildSha()).toBe("unknown");
    expect(m.buildShaShort()).toBe("unknown");
  });
  it("shortens a real sha to seven characters", async () => {
    stamped.sha = CODE;
    expect((await load()).buildShaShort()).toBe(CODE.slice(0, 7));
  });
});
