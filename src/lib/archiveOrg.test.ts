import { describe, it, expect } from "vitest";
import { matchScore, isYearInWindow } from "@/lib/archiveOrg";

describe("matchScore — strict song matching for archive.org titles", () => {
  it("returns 100 for exact matches ignoring punctuation/case", () => {
    expect(matchScore("Picasso Moon", "Picasso Moon")).toBe(100);
    expect(matchScore("Truckin'", "Truckin'")).toBe(100);
  });

  it("treats hyphen / space variants as identical", () => {
    expect(matchScore("Mississippi Half Step", "Mississippi Half-Step")).toBe(100);
    expect(matchScore("We Bid You Good Night", "We Bid You Goodnight")).toBe(100);
  });

  it("handles 'playin'' vs 'Playing' through stemming", () => {
    expect(matchScore("Playin' In The Band", "Playing in the Band")).toBeGreaterThanOrEqual(90);
  });

  it("scores extras-on-the-track as a strong song-subset match", () => {
    expect(matchScore("Playin' In The Band Jam", "Playing in the Band")).toBeGreaterThanOrEqual(70);
    expect(matchScore("Memphis Blues", "Stuck Inside of Mobile with the Memphis Blues Again"))
      .toBeGreaterThanOrEqual(60);
  });

  it("does NOT match unrelated songs that share a substring", () => {
    // 'step' ⊂ 'stephen' used to give a 70 — must be 0 now.
    expect(matchScore("Mississippi Half Step", "St. Stephen")).toBe(0);
    expect(matchScore("Playin' In The Band", "Truckin'")).toBe(0);
    expect(matchScore("We Bid You Good Night", "West L.A. Fadeaway")).toBe(0);
    expect(matchScore("I Will Take You Home", "Truckin'")).toBe(0);
  });
});

describe("isYearInWindow — the belt-and-suspenders date guard", () => {
  it("accepts dates inside an inclusive window", () => {
    expect(isYearInWindow("1974-06-18", 1974, 1976)).toBe(true);
    expect(isYearInWindow("1976-12-31", 1974, 1976)).toBe(true);
    expect(isYearInWindow("1974-01-01", 1974, 1976)).toBe(true);
  });

  it("rejects dates outside the window", () => {
    expect(isYearInWindow("1973-12-31", 1974, 1976)).toBe(false);
    expect(isYearInWindow("1977-01-01", 1974, 1976)).toBe(false);
  });

  it("handles a single-year window", () => {
    expect(isYearInWindow("1974-06-18", 1974, 1974)).toBe(true);
    expect(isYearInWindow("1975-06-18", 1974, 1974)).toBe(false);
  });

  it("rejects missing or malformed dates rather than letting them through", () => {
    expect(isYearInWindow(null, 1974, 1976)).toBe(false);
    expect(isYearInWindow(undefined, 1974, 1976)).toBe(false);
    expect(isYearInWindow("", 1974, 1976)).toBe(false);
    expect(isYearInWindow("not-a-date", 1974, 1976)).toBe(false);
  });

  it("tolerates a full archive.org timestamp", () => {
    expect(isYearInWindow("1974-06-18T00:00:00Z", 1974, 1976)).toBe(true);
  });
});
