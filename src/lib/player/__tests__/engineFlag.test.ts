import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getPlayerEngineFlag,
  isGaplessSupported,
  resolvePlayerEngine,
  PLAYER_ENGINE_STORAGE_KEY,
} from "../engineFlag";

describe("player engine flag", () => {
  beforeEach(() => {
    window.localStorage.removeItem(PLAYER_ENGINE_STORAGE_KEY);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to gapless", () => {
    expect(getPlayerEngineFlag()).toBe("gapless");
  });

  it("respects the legacy rollback flag", () => {
    window.localStorage.setItem(PLAYER_ENGINE_STORAGE_KEY, "legacy");
    expect(getPlayerEngineFlag()).toBe("legacy");
  });

  it("ignores unknown flag values", () => {
    window.localStorage.setItem(PLAYER_ENGINE_STORAGE_KEY, "quadraphonic");
    expect(getPlayerEngineFlag()).toBe("gapless");
  });

  it("resolves to legacy when Web Audio is unavailable (jsdom has no AudioContext)", () => {
    expect(isGaplessSupported()).toBe(false);
    expect(resolvePlayerEngine()).toBe("legacy");
  });

  it("resolves to gapless when Web Audio exists and the flag allows it", () => {
    vi.stubGlobal("AudioContext", class {});
    expect(isGaplessSupported()).toBe(true);
    expect(resolvePlayerEngine()).toBe("gapless");

    window.localStorage.setItem(PLAYER_ENGINE_STORAGE_KEY, "legacy");
    expect(resolvePlayerEngine()).toBe("legacy");
  });
});
