import { describe, it, expect } from "vitest";
import { matchScore } from "@/lib/archiveOrg";

/**
 * Tapers write a suite as one track — "Help > Slipknot > Franklin's Tower",
 * "Scarlet -> Fire" — because that is how it was played. Scored as one string
 * those share too few significant words with any single song and land on 0, so
 * every medley-titled tape looked like it did not contain the song.
 *
 * That was survivable while the score only chose what to play. Once the version
 * browser started filtering on it, it began hiding real tapes — which is how
 * this surfaced: a sweep of saved slots found Help on the Way sitting on a
 * 1991-09-10 MSG tape as "Help > Slipknot > Franklin".
 */

const MATCH = 60; // the threshold both the player and the browser use

describe("medley titles", () => {
  it("matches each song in a suite", () => {
    const suite = "Help > Slipknot > Franklin";
    expect(matchScore(suite, "Help on the Way")).toBeGreaterThanOrEqual(MATCH);
    expect(matchScore(suite, "Slipknot!")).toBeGreaterThanOrEqual(MATCH);
    expect(matchScore(suite, "Franklin's Tower")).toBeGreaterThanOrEqual(MATCH);
  });

  it("handles the arrow spellings tapers actually use", () => {
    expect(matchScore("Scarlet Begonias -> Fire On The Mountain", "Fire on the Mountain"))
      .toBeGreaterThanOrEqual(MATCH);
    expect(matchScore("China Cat Sunflower > I Know You Rider", "I Know You Rider"))
      .toBeGreaterThanOrEqual(MATCH);
    expect(matchScore("Truckin' > Drums", "Truckin'")).toBeGreaterThanOrEqual(MATCH);
  });

  it("does not match a song that is not in the suite", () => {
    expect(matchScore("Help > Slipknot > Franklin", "Dark Star")).toBeLessThan(MATCH);
    expect(matchScore("Scarlet Begonias -> Fire On The Mountain", "Sugar Magnolia"))
      .toBeLessThan(MATCH);
    expect(matchScore("China Cat Sunflower > I Know You Rider", "Cats Under The Stars"))
      .toBeLessThan(MATCH);
  });

  it("still prefers a dedicated track over the suite it appears in", () => {
    // findBestTrack takes the highest score, so a tape that has both an
    // individual cut and the suite must rank the individual cut first.
    const dedicated = matchScore("Franklin's Tower", "Franklin's Tower");
    const withinSuite = matchScore("Help > Slipknot > Franklin", "Franklin's Tower");
    expect(dedicated).toBe(100);
    expect(dedicated).toBeGreaterThan(withinSuite);
  });

  it("leaves a single title with a trailing segue arrow alone", () => {
    expect(matchScore("Viola Lee Blues >", "Viola Lee Blues")).toBe(100);
  });

  it("never scores a medley lower than the whole string would", () => {
    // The split only ever adds candidates; it cannot demote an existing match.
    const whole = "Playing In The Band";
    expect(matchScore(whole, "Playing In The Band")).toBe(100);
    expect(matchScore("Playing In The Band > Drums", "Playing In The Band"))
      .toBeGreaterThanOrEqual(MATCH);
  });
});
