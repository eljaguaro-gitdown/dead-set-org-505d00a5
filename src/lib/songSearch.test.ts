import { describe, it, expect } from "vitest";
import { matchesSongQuery, filterSongsByQuery, tokenizeQuery } from "@/lib/songSearch";

const VAULT = [
  { title: "We Bid You Goodnight" },
  { title: "Attics of My Life" },
  { title: "Slipknot!" },
  { title: "Bird Song" },
  { title: "Scarlet Begonias > Fire on the Mountain" },
  { title: "Truckin'" },
  { title: "Cassidy" },
  { title: "Iko Iko" },
];

describe("songSearch — token-based matching", () => {
  it("matches titles even when the query has filler words", () => {
    expect(matchesSongQuery("We Bid You Goodnight", "and we bid you goodnight")).toBe(true);
    expect(matchesSongQuery("Attics of My Life", "attics of my life")).toBe(true);
    expect(matchesSongQuery("Bird Song", "the bird song")).toBe(true);
  });

  it("matches a substring of the title", () => {
    expect(matchesSongQuery("Slipknot!", "slip")).toBe(true);
    expect(matchesSongQuery("Truckin'", "truckin")).toBe(true);
  });

  it("ignores punctuation in titles and queries", () => {
    expect(matchesSongQuery("Slipknot!", "slipknot")).toBe(true);
    expect(matchesSongQuery("Truckin'", "truckin'")).toBe(true);
  });

  it("returns true for an empty query", () => {
    expect(matchesSongQuery("Anything", "")).toBe(true);
    expect(matchesSongQuery("Anything", "   ")).toBe(true);
  });

  it("rejects unrelated queries", () => {
    expect(matchesSongQuery("Bird Song", "ripple")).toBe(false);
    expect(matchesSongQuery("Attics of My Life", "stella blue")).toBe(false);
  });

  it("strips stop words from the query", () => {
    expect(tokenizeQuery("and the of my you")).toEqual([]);
    expect(tokenizeQuery("and we bid you goodnight")).toEqual([
      "we", "bid", "goodnight",
    ]);
  });
});

describe("songSearch — vault filter", () => {
  it("finds Attics of My Life via filler-word query", () => {
    const results = filterSongsByQuery(VAULT, "attics of my life");
    expect(results.map((r) => r.title)).toContain("Attics of My Life");
  });

  it("finds We Bid You Goodnight via 'and we bid you goodnight'", () => {
    const results = filterSongsByQuery(VAULT, "and we bid you goodnight");
    expect(results.map((r) => r.title)).toContain("We Bid You Goodnight");
  });

  it("finds Slipknot! via 'slip'", () => {
    const results = filterSongsByQuery(VAULT, "slip");
    expect(results.map((r) => r.title)).toContain("Slipknot!");
  });

  it("returns the full vault for an empty query", () => {
    expect(filterSongsByQuery(VAULT, "")).toHaveLength(VAULT.length);
  });

  it("can match through punctuation in the title (Scarlet > Fire)", () => {
    const results = filterSongsByQuery(VAULT, "scarlet fire");
    expect(results.map((r) => r.title)).toContain(
      "Scarlet Begonias > Fire on the Mountain",
    );
  });
});
