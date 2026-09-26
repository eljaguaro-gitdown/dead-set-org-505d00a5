import { describe, it, expect } from "vitest";
import {
  scoreSleepers,
  monthsOnline,
  buildArchiveSearchUrl,
  toRecordings,
  ARCHIVE_FIELDS,
  DEFAULT_THRESHOLDS,
  SLEEPER_RATIO,
  MIN_REVIEWS,
  RATING_TOLERANCE,
  MIN_MONTHS_ONLINE,
  type ArchiveRecording,
} from "../../../supabase/functions/_shared/sleeperScore";

/**
 * The scoring rule lives in supabase/functions/_shared/ because the edge
 * function is what runs it in production, and a second copy in src/ is exactly
 * the divergence this repo has been bitten by twice (encodeArchiveNotes, the
 * synthetic-version defaults). It is pure TypeScript with no imports, so it
 * tests from here across the directory boundary without a Deno runtime.
 */

const NOW = new Date("2026-09-26T00:00:00Z");

/** Twelve months online by default, so downloads and pulls-per-month differ. */
const rec = (over: Partial<ArchiveRecording> & { identifier: string }): ArchiveRecording => ({
  date: "1977-05-08",
  avgRating: 4.8,
  numReviews: 10,
  downloads: 1200,
  publicDate: "2025-09-26T00:00:00Z",
  ...over,
});

describe("monthsOnline", () => {
  it("floors at one month so a fresh upload cannot read as undiscovered", () => {
    // Posted yesterday with 500 downloads would otherwise divide to a huge
    // pulls-per-month and look like the leader, or to a tiny one and look
    // like a sleeper, depending on rounding. Neither is a real signal.
    const m = monthsOnline("2026-09-25T00:00:00Z", NOW);
    expect(m).toBe(1);
  });

  it("returns null for a missing or unparseable date", () => {
    expect(monthsOnline(null, NOW)).toBeNull();
    expect(monthsOnline("not a date", NOW)).toBeNull();
  });

  it("returns null for a future date rather than a negative age", () => {
    expect(monthsOnline("2027-01-01T00:00:00Z", NOW)).toBeNull();
  });
});

describe("scoreSleepers", () => {
  it("finds the well-rated version nobody pulls", () => {
    const report = scoreSleepers(
      [
        rec({ identifier: "famous", downloads: 12000, avgRating: 4.9 }),
        rec({ identifier: "obscure", downloads: 800, avgRating: 4.8 }),
        rec({ identifier: "middling", downloads: 6000, avgRating: 4.7 }),
      ],
      NOW,
    );

    expect(report.sleepers.map((r) => r.identifier)).toEqual(["obscure"]);
    // A month here is 30.44 days, so a year online is 11.99 of them and
    // 12000 downloads lands just over 1000/month rather than exactly on it.
    expect(report.leaderPullsPerMonth).toBeGreaterThan(995);
    expect(report.leaderPullsPerMonth).toBeLessThan(1005);
    expect(report.bestRating).toBe(4.9);
  });

  it("will not crown a recording on a handful of reviews", () => {
    // A 5.0 from one enthusiast is not the song's best version; it is one
    // person. Below MIN_REVIEWS the rating carries no weight at all.
    const report = scoreSleepers(
      [
        rec({ identifier: "famous", downloads: 12000 }),
        rec({ identifier: "one-fan", downloads: 300, avgRating: 5, numReviews: MIN_REVIEWS - 1 }),
      ],
      NOW,
    );

    expect(report.sleepers).toEqual([]);
    expect(report.scored.find((r) => r.identifier === "one-fan")?.verdict).toBe(
      "too-few-reviews",
    );
  });

  it("will not call a badly rated recording a sleeper just because it is obscure", () => {
    const report = scoreSleepers(
      [
        rec({ identifier: "famous", downloads: 12000, avgRating: 4.9 }),
        rec({ identifier: "deservedly-ignored", downloads: 200, avgRating: 2.5 }),
      ],
      NOW,
    );

    expect(report.sleepers).toEqual([]);
    expect(
      report.scored.find((r) => r.identifier === "deservedly-ignored")?.verdict,
    ).toBe("rated-below-peers");
  });

  it("measures obscurity against this song only, never a fixed download floor", () => {
    // The same 800 downloads is a sleeper next to a 12000-download leader and
    // is the leader itself in a quieter song. A catalogue-wide threshold would
    // call every Dark Star version a sleeper and none of Touch of Grey's.
    const loud = scoreSleepers(
      [rec({ identifier: "leader", downloads: 12000 }), rec({ identifier: "x", downloads: 800 })],
      NOW,
    );
    const quiet = scoreSleepers(
      [rec({ identifier: "leader", downloads: 900 }), rec({ identifier: "x", downloads: 800 })],
      NOW,
    );

    expect(loud.sleepers.map((r) => r.identifier)).toEqual(["x"]);
    expect(quiet.sleepers).toEqual([]);
  });

  it("normalises by time online, so an old upload is not obscure for being old", () => {
    // Both have 1000 downloads. One has had ten years to get them, the other
    // one month. Raw counts call them equal; the newer one is plainly the
    // more-pulled recording.
    const report = scoreSleepers(
      [
        rec({ identifier: "old", downloads: 1000, publicDate: "2016-09-26T00:00:00Z" }),
        rec({ identifier: "new", downloads: 1000, publicDate: "2026-08-26T00:00:00Z" }),
      ],
      NOW,
    );

    expect(report.sleepers.map((r) => r.identifier)).toEqual(["old"]);
  });

  it("returns no sleepers when there is nothing to compare against", () => {
    expect(scoreSleepers([], NOW).sleepers).toEqual([]);
    expect(scoreSleepers([rec({ identifier: "only" })], NOW).sleepers).toEqual([]);
  });

  it("leaves an undateable recording unjudged rather than guessing", () => {
    const report = scoreSleepers(
      [
        rec({ identifier: "famous", downloads: 12000 }),
        rec({ identifier: "no-publicdate", downloads: 100, publicDate: null }),
      ],
      NOW,
    );

    expect(report.sleepers).toEqual([]);
    expect(report.scored.find((r) => r.identifier === "no-publicdate")?.verdict).toBe(
      "undateable",
    );
  });

  it("uses SLEEPER_RATIO as the boundary, exclusive", () => {
    // Exactly at the cutoff is not a sleeper. Stated as a test because the
    // vote-based ladder in SongEraLadder.tsx uses the same 0.3 and the same
    // strict comparison; if one ever loosens, this catches the divergence.
    const leaderDownloads = 10000;
    const atCutoff = leaderDownloads * SLEEPER_RATIO;
    const report = scoreSleepers(
      [
        rec({ identifier: "leader", downloads: leaderDownloads }),
        rec({ identifier: "at-cutoff", downloads: atCutoff }),
        rec({ identifier: "just-under", downloads: atCutoff - 1 }),
      ],
      NOW,
    );

    expect(report.sleepers.map((r) => r.identifier)).toEqual(["just-under"]);
  });
});

describe("buildArchiveSearchUrl", () => {
  it("asks for every field the rule reads", () => {
    const url = buildArchiveSearchUrl("Scarlet Begonias");
    for (const f of ARCHIVE_FIELDS) {
      expect(url).toContain(`fl[]=${f}`);
    }
  });

  it("scopes to the Grateful Dead collection and quotes the title", () => {
    const q = decodeURIComponent(buildArchiveSearchUrl("Dark Star"));
    expect(q).toContain('collection:GratefulDead "Dark Star"');
  });

  it("strips punctuation that would break the query", () => {
    const q = decodeURIComponent(buildArchiveSearchUrl('Cryptical "Envelopment" (reprise)?'));
    expect(q).not.toContain('"Envelopment"');
    expect(q).toContain("Cryptical Envelopment reprise");
  });

  it("clamps to an era only when both years are given", () => {
    expect(decodeURIComponent(buildArchiveSearchUrl("Sugaree", { yearStart: 1972, yearEnd: 1974 })))
      .toContain("date:[1972-01-01 TO 1974-12-31]");
    expect(decodeURIComponent(buildArchiveSearchUrl("Sugaree", { yearStart: 1972 })))
      .not.toContain("date:[");
  });
});

describe("toRecordings", () => {
  it("coerces the strings the Archive sends for numbers", () => {
    const [r] = toRecordings({
      response: {
        docs: [
          {
            identifier: "gd1977-05-08",
            date: "1977-05-08T00:00:00Z",
            avg_rating: "4.9",
            num_reviews: "62",
            downloads: "120000",
            publicdate: "2004-01-01T00:00:00Z",
          },
        ],
      },
    });
    expect(r.avgRating).toBe(4.9);
    expect(r.numReviews).toBe(62);
    expect(r.downloads).toBe(120000);
  });

  it("drops rows with no identifier and survives a junk body", () => {
    expect(toRecordings({ response: { docs: [{ date: "1977-05-08" }] } })).toHaveLength(0);
    expect(toRecordings(null)).toEqual([]);
    expect(toRecordings({})).toEqual([]);
  });

  it("leaves absent metrics null rather than zero", () => {
    // Zero would read as "nobody pulls this", which is a sleeper. Absent must not.
    const [r] = toRecordings({
      response: { docs: [{ identifier: "x", avg_rating: "", downloads: null }] },
    });
    expect(r.avgRating).toBeNull();
    expect(r.downloads).toBeNull();
  });
});

describe("threshold overrides", () => {
  const rec = (id: string, rating: number, reviews: number, downloads: number) => ({
    identifier: id,
    date: "1977-05-08",
    avgRating: rating,
    numReviews: reviews,
    downloads,
    publicDate: "2010-01-01T00:00:00Z",
  });

  it("defaults are exactly the shipping constants", () => {
    expect(DEFAULT_THRESHOLDS).toEqual({
      sleeperRatio: SLEEPER_RATIO,
      minReviews: MIN_REVIEWS,
      ratingTolerance: RATING_TOLERANCE,
      minMonthsOnline: MIN_MONTHS_ONLINE,
    });
  });

  it("a stricter ratio promotes fewer recordings", () => {
    const now = new Date("2020-01-01T00:00:00Z");
    const recs = [rec("leader", 4.9, 10, 10000), rec("mid", 4.9, 10, 2500)];
    // 2500/10000 = 0.25 — a sleeper at the default 0.3, not at 0.2.
    expect(scoreSleepers(recs, now).sleepers.map((s) => s.identifier)).toEqual(["mid"]);
    expect(
      scoreSleepers(recs, now, { ...DEFAULT_THRESHOLDS, sleeperRatio: 0.2 }).sleepers,
    ).toHaveLength(0);
  });
});
