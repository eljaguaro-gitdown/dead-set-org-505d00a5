import { describe, it, expect } from "vitest";
import {
  scoreRecordings,
  isQuietGem,
  quietGems,
  hasRegardData,
  quietGemReason,
  MIN_COHORT,
  MAX_GEMS,
  MIN_GEM_REVIEWS,
  QUIET_GEM_THRESHOLD,
  type RegardInput,
} from "@/lib/regardVsAttention";

/**
 * A plausible cohort: one famous tape everybody pulls, one equally-loved tape
 * nobody does, and filler. The quiet one is the whole point of the signal.
 */
const cohort: RegardInput[] = [
  { identifier: "famous", avgRating: 4.8, reviews: 40, downloads: 90_000 },
  { identifier: "quiet", avgRating: 4.9, reviews: 22, downloads: 1_200 },
  { identifier: "middling", avgRating: 4.2, reviews: 12, downloads: 20_000 },
  { identifier: "rough", avgRating: 3.4, reviews: 8, downloads: 6_000 },
  { identifier: "unrated", avgRating: null, reviews: 0, downloads: 15_000 },
];

const byId = (id: string) => (s: { identifier: string }) => s.identifier === id;

describe("scoreRecordings", () => {
  it("finds the loved tape nobody pulls", () => {
    const gems = quietGems(scoreRecordings(cohort)).map((g) => g.identifier);
    expect(gems).toContain("quiet");
  });

  it("does not call the famous tape a gem — it is pulled as much as it is loved", () => {
    const gems = quietGems(scoreRecordings(cohort)).map((g) => g.identifier);
    expect(gems).not.toContain("famous");
  });

  it("does not call a poorly-rated tape a gem just for being ignored", () => {
    const ignoredAndBad: RegardInput[] = [
      { identifier: "a", avgRating: 4.8, reviews: 30, downloads: 50_000 },
      { identifier: "b", avgRating: 4.7, reviews: 30, downloads: 40_000 },
      { identifier: "c", avgRating: 4.6, reviews: 30, downloads: 30_000 },
      { identifier: "bad", avgRating: 2.1, reviews: 30, downloads: 50 },
    ];
    const gems = quietGems(scoreRecordings(ignoredAndBad)).map((g) => g.identifier);
    expect(gems).not.toContain("bad");
  });

  it("will not let one five-star review outrank forty reviews at 4.7", () => {
    const scores = scoreRecordings([
      { identifier: "oneReview", avgRating: 5, reviews: 1, downloads: 100 },
      { identifier: "manyReviews", avgRating: 4.7, reviews: 40, downloads: 100 },
      { identifier: "c", avgRating: 4.0, reviews: 10, downloads: 100 },
      { identifier: "d", avgRating: 3.9, reviews: 10, downloads: 100 },
    ]);
    const one = scores.find(byId("oneReview"))!;
    const many = scores.find(byId("manyReviews"))!;
    expect(many.regard).toBeGreaterThan(one.regard);
  });

  it("parks an unrated tape mid-pack rather than at zero", () => {
    const scores = scoreRecordings(cohort);
    const unrated = scores.find(byId("unrated"))!;
    const rough = scores.find(byId("rough"))!;
    expect(unrated.regard).toBeGreaterThan(rough.regard);
    expect(unrated.regard).toBeLessThan(scores.find(byId("quiet"))!.regard);
  });

  it("compares downloads by order of magnitude, not raw count", () => {
    const scores = scoreRecordings(cohort);
    const famous = scores.find(byId("famous"))!;
    const quiet = scores.find(byId("quiet"))!;
    // 90,000 vs 1,200 is ~1.9 orders apart, not 75x apart.
    expect(famous.attention - quiet.attention).toBeLessThan(2.5);
    expect(famous.attention).toBeGreaterThan(quiet.attention);
  });

  it("handles zero and missing downloads without producing -Infinity", () => {
    const scores = scoreRecordings([
      { identifier: "zero", avgRating: 4.5, reviews: 5, downloads: 0 },
      { identifier: "missing", avgRating: 4.5, reviews: 5 },
      { identifier: "some", avgRating: 4.5, reviews: 5, downloads: 10 },
      { identifier: "more", avgRating: 4.5, reviews: 5, downloads: 100 },
    ]);
    for (const s of scores) {
      expect(Number.isFinite(s.attention)).toBe(true);
      expect(Number.isFinite(s.regard)).toBe(true);
      expect(Number.isFinite(s.overlooked)).toBe(true);
    }
  });

  it("keeps every rank inside 0..1 and overlooked inside -1..1", () => {
    for (const s of scoreRecordings(cohort)) {
      expect(s.regardRank).toBeGreaterThanOrEqual(0);
      expect(s.regardRank).toBeLessThanOrEqual(1);
      expect(s.attentionRank).toBeGreaterThanOrEqual(0);
      expect(s.attentionRank).toBeLessThanOrEqual(1);
      expect(Math.abs(s.overlooked)).toBeLessThanOrEqual(1);
    }
  });

  it("is relative: the same numbers rank differently in a different cohort", () => {
    const alone = scoreRecordings([
      { identifier: "quiet", avgRating: 4.9, reviews: 22, downloads: 1_200 },
      { identifier: "x", avgRating: 4.95, reviews: 30, downloads: 900 },
      { identifier: "y", avgRating: 4.92, reviews: 30, downloads: 800 },
      { identifier: "z", avgRating: 4.91, reviews: 30, downloads: 700 },
    ]);
    // Among tapes that are all loved and all ignored, "quiet" is no longer
    // the overlooked one — it is the most-pulled of a quiet shelf.
    expect(isQuietGem(alone.find(byId("quiet"))!)).toBe(false);
  });

  it("returns a score for every input, in order", () => {
    const scores = scoreRecordings(cohort);
    expect(scores.map((s) => s.identifier)).toEqual(cohort.map((c) => c.identifier));
  });

  it("holds the gem bar at the documented threshold", () => {
    const scores = scoreRecordings(cohort);
    for (const s of scores) {
      expect(isQuietGem(s)).toBe(s.regardRank >= 0.5 && s.overlooked >= QUIET_GEM_THRESHOLD);
    }
  });
});

describe("hasRegardData", () => {
  it("is false for a cohort too small to rank", () => {
    expect(hasRegardData(cohort.slice(0, MIN_COHORT - 1))).toBe(false);
  });

  it("is false when nothing in the cohort is rated", () => {
    const unrated = cohort.map((c) => ({ ...c, avgRating: null, reviews: 0 }));
    expect(hasRegardData(unrated)).toBe(false);
  });

  it("is false when nothing has been downloaded", () => {
    const undrawn = cohort.map((c) => ({ ...c, downloads: 0 }));
    expect(hasRegardData(undrawn)).toBe(false);
  });

  it("is true for a real cohort", () => {
    expect(hasRegardData(cohort)).toBe(true);
  });

  it("survives an empty cohort", () => {
    expect(hasRegardData([])).toBe(false);
    expect(scoreRecordings([])).toEqual([]);
  });
});

describe("quietGemReason", () => {
  it("cites the rating and the review count", () => {
    const score = scoreRecordings(cohort).find(byId("quiet"))!;
    expect(quietGemReason(score)).toBe(
      "4.9 across 22 reviews, and pulled less than the other tapes here.",
    );
  });

  it("says review, singular, for one", () => {
    const score = scoreRecordings([
      { identifier: "a", avgRating: 4.5, reviews: 1, downloads: 10 },
      { identifier: "b", avgRating: 4.5, reviews: 10, downloads: 10 },
      { identifier: "c", avgRating: 4.5, reviews: 10, downloads: 10 },
      { identifier: "d", avgRating: 4.5, reviews: 10, downloads: 10 },
    ])[0];
    expect(quietGemReason(score)).toContain("1 review,");
  });

  it("cites nothing when there is nothing to cite", () => {
    const score = scoreRecordings(cohort).find(byId("unrated"))!;
    expect(quietGemReason(score)).toBeNull();
  });
});

describe("user-facing copy", () => {
  it("never says the forbidden words", async () => {
    const copy = await import("@/lib/regardVsAttention");
    const strings = [copy.REGARD_METHOD_LINE, copy.QUIET_GEM_CHIP];
    for (const s of strings) {
      expect(s).not.toMatch(/\bAI\b|algorithm|model|engine|pipeline|score\b/i);
    }
  });
});

/**
 * These three came out of running the signal against the live Archive on
 * 2026-10-04, not out of reasoning about it. Each one is a defect the fixture
 * cohort above could never have shown.
 */
describe("what the live Archive taught it", () => {
  /**
   * 20 tapes where regard runs OPPOSITE to draw: the best-rated are the
   * least-pulled. Both ranks are percentiles and percentiles are scale-
   * invariant, so a cohort whose rating and downloads descend together scores
   * `overlooked` of 0 for every row no matter how differently the two
   * magnitudes move — which is exactly what my first attempt at this fixture
   * did, and why it reported no gems at all.
   */
  const many = Array.from({ length: 20 }, (_, i) => ({
    identifier: `tape-${i}`,
    avgRating: 4.9 - i * 0.01,
    reviews: 40,
    downloads: 10_000 + i * 40_000,
  }));

  it("marks at most MAX_GEMS, however many clear the bar", () => {
    const scored = scoreRecordings(many);
    expect(scored.filter(isQuietGem).length).toBeGreaterThan(MAX_GEMS);
    expect(quietGems(scored)).toHaveLength(MAX_GEMS);
  });

  it("marks the most overlooked ones, not the first ones it met", () => {
    const scored = scoreRecordings(many);
    const picked = quietGems(scored);
    const best = [...scored].sort((a, b) => b.overlooked - a.overlooked).slice(0, MAX_GEMS);
    expect(picked.map((g) => g.identifier)).toEqual(best.map((g) => g.identifier));
  });

  it("floors the rating — 4.95 is not a 5.0", () => {
    const score = scoreRecordings([
      { identifier: "near", avgRating: 4.95, reviews: 40, downloads: 100 },
      { identifier: "b", avgRating: 4.5, reviews: 40, downloads: 100 },
      { identifier: "c", avgRating: 4.4, reviews: 40, downloads: 100 },
      { identifier: "d", avgRating: 4.3, reviews: 40, downloads: 100 },
    ])[0];
    expect(quietGemReason(score)).toContain("4.9 across");
    expect(quietGemReason(score)).not.toContain("5.0");
  });
});

/**
 * The release gate blocked on these. Each is reproduced from the real cohort
 * that exposed it, so the test fails against the code that shipped.
 */
describe("what the gate caught", () => {
  /**
   * Crazy Fingers, 1975 window, as archive.org actually returns it: unrated
   * tapes with modest downloads, and enough rated tapes below the cohort mean
   * that an unrated one clears the better half on nothing at all.
   */
  const CRAZY_FINGERS_1975 = [
    { identifier: "1975-06-17", avgRating: 4.44, reviews: 102, downloads: 531_410 },
    { identifier: "1975-08-13", avgRating: 4.92, reviews: 67, downloads: 311_361 },
    { identifier: "1975-02-28", avgRating: 4.57, reviews: 15, downloads: 55_303 },
    { identifier: "1975-06-07", avgRating: 4.57, reviews: 7, downloads: 42_173 },
    { identifier: "1975-06-05", avgRating: 3.75, reviews: 4, downloads: 34_500 },
    { identifier: "1975-07-07", avgRating: 4.0, reviews: 5, downloads: 32_121 },
    { identifier: "1975-04-02", avgRating: 3.71, reviews: 7, downloads: 20_130 },
    { identifier: "1975-01-01", avgRating: 4.5, reviews: 8, downloads: 18_215 },
    // The two the gate named. Unrated, and flagged as gems by the shipped code.
    { identifier: "UNRATED-1975-06-03", avgRating: null, reviews: null, downloads: 4_730 },
    { identifier: "UNRATED-1975-07-07", avgRating: null, reviews: null, downloads: 3_655 },
  ];

  it("never calls a tape nobody rated a gem", () => {
    const gems = quietGems(scoreRecordings(CRAZY_FINGERS_1975)).map((g) => g.identifier);
    expect(gems).not.toContain("UNRATED-1975-06-03");
    expect(gems).not.toContain("UNRATED-1975-07-07");
  });

  it("never marks a tape it cannot produce evidence for", () => {
    // The chip and its evidence line are one claim. A gem with a null reason
    // renders a gold mark with nothing under it.
    for (const gem of quietGems(scoreRecordings(CRAZY_FINGERS_1975))) {
      expect(quietGemReason(gem)).not.toBeNull();
    }
  });

  it("still parks the unrated mid-pack for ranking — it just cannot win", () => {
    // The fix must not turn unrated tapes into zero-regard, which would be a
    // different wrong answer: unknown is not bad.
    const scored = scoreRecordings(CRAZY_FINGERS_1975);
    const unrated = scored.find((s) => s.identifier === "UNRATED-1975-06-03")!;
    const worst = scored.find((s) => s.identifier === "1975-04-02")!;
    expect(unrated.regard).toBeGreaterThan(worst.regard);
    expect(isQuietGem(unrated)).toBe(false);
  });

  it("holds the review floor where it is documented", () => {
    const thin = Array.from({ length: 6 }, (_, i) => ({
      identifier: `t${i}`,
      avgRating: 4.9,
      reviews: MIN_GEM_REVIEWS - 1,
      downloads: 1_000 * (i + 1),
    }));
    expect(quietGems(scoreRecordings(thin))).toHaveLength(0);
  });

  it("does not claim a gem is pulled less than most tapes of the song", () => {
    // It is not: the cohort is already the most-circulated tapes, so a gem sits
    // in the top 1% of the population by downloads. The line may only speak
    // about the tapes actually on screen.
    const gem = scoreRecordings([
      { identifier: "a", avgRating: 4.9, reviews: 40, downloads: 10_000 },
      { identifier: "b", avgRating: 4.5, reviews: 40, downloads: 200_000 },
      { identifier: "c", avgRating: 4.4, reviews: 40, downloads: 300_000 },
      { identifier: "d", avgRating: 4.3, reviews: 40, downloads: 400_000 },
    ])[0];
    const line = quietGemReason(gem)!;
    expect(line).not.toMatch(/most tapes of this song/);
    expect(line).toContain("the other tapes here");
  });
});
