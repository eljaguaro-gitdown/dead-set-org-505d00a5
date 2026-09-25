import { describe, it, expect } from "vitest";
import { decideAutoplay, type PendingAutoplay } from "@/lib/autoplayArm";

const armed: PendingAutoplay = { setlistId: "set-1", armedAt: 1_000, expectedSlots: 14 };
const ready = {
  at: 5_000,
  ttlMs: 20_000,
  creating: false,
  slotCount: 14,
  currentSetlistId: "set-1",
  somethingPlaying: false,
};

describe("decideAutoplay", () => {
  // 2026-09-24: Charlie's fourteen songs arrived one realtime insert at a
  // time and playback started on the second — "Song 1 of 2" for good.
  it("waits while the show is still arriving", () => {
    for (const slotCount of [1, 2, 13]) {
      expect(decideAutoplay(armed, { ...ready, slotCount })).toBe("wait");
    }
  });

  it("plays once every song is on the page", () => {
    expect(decideAutoplay(armed, ready)).toBe("play");
  });

  it("waits for the new setlist, and while Charlie's skeleton is up", () => {
    expect(decideAutoplay(armed, { ...ready, currentSetlistId: "old-set" })).toBe("wait");
    expect(decideAutoplay(armed, { ...ready, creating: true })).toBe("wait");
    expect(decideAutoplay(armed, { ...ready, slotCount: 0 })).toBe("wait");
  });

  it("does not talk over a tape that's already rolling", () => {
    expect(decideAutoplay(armed, { ...ready, somethingPlaying: true })).toBe("skip");
  });

  it("lapses if the show never lands", () => {
    expect(decideAutoplay(armed, { ...ready, at: 1_000 + 20_001, slotCount: 3 })).toBe("lapse");
  });

  it("guest builds (no setlist row) play when their songs are there", () => {
    expect(decideAutoplay({ ...armed, setlistId: null }, { ...ready, currentSetlistId: null })).toBe("play");
  });
});
