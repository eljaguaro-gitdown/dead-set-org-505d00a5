import { describe, it, expect } from "vitest";
import { normalize, matchScore } from "@/lib/archiveOrg";

/**
 * Regression cover for the two corrupt rows found in the `songs` catalog:
 * "C.C" and "U.S", sitting alongside a healthy "U.S. Blues".
 *
 * Both came from an extension strip written as /\.[^.]+$/ — "drop the last dot
 * and everything after it" — which does strip ".flac" and ".mp3", and also
 * eats the second half of any title containing an abbreviation. The same regex
 * existed here and in supabase/functions/fetch-show-setlist, where unmatched
 * titles are inserted into `songs`, so every mangled name became a catalog row.
 */

describe("title normalization keeps abbreviations", () => {
  it("does not truncate a title at an abbreviation's period", () => {
    expect(normalize("C.C. Rider")).toBe("c c rider");
    expect(normalize("U.S. Blues")).toBe("u s blues");
    expect(normalize("St. Stephen")).toBe("st stephen");
    expect(normalize("Mr. Charlie")).toBe("mr charlie");
  });

  it("still strips real audio file extensions", () => {
    expect(normalize("gd77-05-08d1t04.flac")).toBe("gd77 05 08d1t04");
    expect(normalize("Scarlet Begonias.mp3")).toBe("scarlet begonias");
    expect(normalize("Fire On The Mountain.ogg")).toBe("fire on the mountain");
    expect(normalize("Dark Star.shn")).toBe("dark star");
  });

  it("leaves titles without a period alone", () => {
    expect(normalize("Dark Star")).toBe("dark star");
    expect(normalize("Me and My Uncle")).toBe("me and my uncle");
  });

  it("matches abbreviated song titles against their tracks", () => {
    // Before the fix these scored 100 only because both sides were mangled to
    // the same stub ("st"), which is agreement by coincidence, not matching.
    expect(matchScore("C.C. Rider", "C.C. Rider")).toBe(100);
    expect(matchScore("U.S. Blues", "U.S. Blues")).toBe(100);
    expect(matchScore("St. Stephen", "St. Stephen")).toBe(100);
    expect(matchScore("St. Stephen >", "St. Stephen")).toBe(100);
  });

  it("does not match different songs that share an abbreviation", () => {
    // The stub behaviour made every "U.S ..." title collapse to "u s".
    expect(matchScore("U.S. Blues", "U.S. Male")).toBeLessThan(60);
  });
});
