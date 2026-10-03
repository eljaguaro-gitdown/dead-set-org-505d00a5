import { describe, it, expect } from "vitest";
// The backfill script is the thing that will write to production, and it has
// never run — api.setlist.fm is unreachable from CI and from the sandbox it
// was written in. Testing its pure core here means the first live run only
// exercises the network, not the arithmetic.
// @ts-expect-error — plain .mjs script, no types
import { normalise, toIso, deriveStats } from "../../../scripts/backfill-song-stats.mjs";

/** A setlist shaped the way setlist.fm returns them. */
const setlist = (eventDate: string, songs: string[]) => ({
  eventDate,
  sets: { set: [{ song: songs.map((name) => ({ name })) }] },
});

describe("toIso — setlist.fm dates are dd-MM-yyyy", () => {
  it("converts to the ISO form the catalog stores", () => {
    expect(toIso("08-05-1977")).toBe("1977-05-08");
    expect(toIso("19-10-1971")).toBe("1971-10-19");
  });

  it("refuses anything it cannot parse rather than guessing", () => {
    // A mis-parse here would silently rewrite a song's history.
    expect(toIso("1977-05-08")).toBeNull();
    expect(toIso("5-8-1977")).toBeNull();
    expect(toIso("")).toBeNull();
    expect(toIso(undefined)).toBeNull();
  });
});

describe("normalise — matching their song names to ours", () => {
  it("folds the variants the two catalogs actually disagree on", () => {
    expect(normalise("Playin' In The Band")).toBe(normalise("Playing in the Band"));
    expect(normalise("Truckin'")).toBe(normalise("Trucking"));
    expect(normalise("Me & My Uncle")).toBe(normalise("Me and My Uncle"));
    expect(normalise("St. Stephen")).toBe(normalise("St Stephen"));
    expect(normalise("  Dark  Star ")).toBe("dark star");
  });

  it("keeps genuinely different songs apart", () => {
    // The whole point of exact-normalised matching: no false merges.
    expect(normalise("China Cat Sunflower")).not.toBe(normalise("China Doll"));
    expect(normalise("Scarlet Begonias")).not.toBe(normalise("Fire on the Mountain"));
    expect(normalise("Brown Eyed Women")).not.toBe(normalise("Brokedown Palace"));
  });

  it("survives junk without throwing", () => {
    expect(normalise(null)).toBe("");
    expect(normalise("")).toBe("");
    expect(normalise("???")).toBe("");
  });
});

describe("deriveStats — a song's history out of the crawl", () => {
  const crawl = [
    setlist("19-10-1971", ["Ramble On Rose", "Truckin'"]),
    setlist("04-05-1972", ["Ramble On Rose"]),
    setlist("09-07-1995", ["Ramble On Rose", "Playin' In The Band"]),
  ];

  it("counts plays and finds the first and last night", () => {
    const stats = deriveStats(crawl);
    const rose = stats.get(normalise("Ramble On Rose"));
    expect(rose.dates.length).toBe(3);
    expect(rose.dates[0]).toBe("1971-10-19");
    expect(rose.dates[rose.dates.length - 1]).toBe("1995-07-09");
  });

  it("sorts dates, so first and last do not depend on crawl order", () => {
    const shuffled = [crawl[2], crawl[0], crawl[1]];
    const rose = deriveStats(shuffled).get(normalise("Ramble On Rose"));
    expect(rose.dates[0]).toBe("1971-10-19");
    expect(rose.dates[rose.dates.length - 1]).toBe("1995-07-09");
  });

  it("merges name variants into one song", () => {
    const stats = deriveStats([
      setlist("01-01-1980", ["Playin' In The Band"]),
      setlist("02-01-1980", ["Playing in the Band"]),
    ]);
    const playing = stats.get(normalise("Playing in the Band"));
    expect(playing.dates.length).toBe(2);
    // Both spellings are kept so the report can show what it matched on.
    expect([...playing.names].sort()).toEqual(["Playin' In The Band", "Playing in the Band"]);
  });

  it("skips a setlist whose date it cannot parse instead of dating it wrong", () => {
    const stats = deriveStats([setlist("not-a-date", ["Dark Star"]), setlist("14-02-1968", ["Dark Star"])]);
    const ds = stats.get(normalise("Dark Star"));
    expect(ds.dates).toEqual(["1968-02-14"]);
  });

  it("handles empty sets, missing songs and blank names", () => {
    const stats = deriveStats([
      { eventDate: "01-01-1980", sets: { set: [] } },
      { eventDate: "02-01-1980", sets: {} },
      { eventDate: "03-01-1980" },
      { eventDate: "04-01-1980", sets: { set: [{ song: [{ name: "  " }, { name: "Bertha" }] }] } },
    ]);
    expect(stats.get(normalise("Bertha")).dates).toEqual(["1980-01-04"]);
    expect(stats.size).toBe(1);
  });

  it("counts a song played twice in one night twice", () => {
    // Reprises are real: Playing in the Band bookending a set is two entries.
    const stats = deriveStats([
      { eventDate: "08-05-1977", sets: { set: [{ song: [{ name: "Playin' In The Band" }] }, { song: [{ name: "Playin' In The Band" }] }] } },
    ]);
    expect(stats.get(normalise("Playing in the Band")).dates.length).toBe(2);
  });
});
