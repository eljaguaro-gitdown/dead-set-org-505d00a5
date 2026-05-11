import { describe, it, expect } from "vitest";
import { matchScore } from "@/lib/archiveOrg";

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
