import { describe, expect, it } from "vitest";
import { readSource } from "@/test/sourceFiles";

/**
 * A source check, and only that: what this pins is that the poster's
 * page-load prefetch goes through the index helper for undated songs, not the
 * Archive's generic search for every title. The behaviour of findSongDefault
 * itself (index first, Archive on a miss) is covered in tapeIndex.test.ts.
 *
 * Why it matters: the old prefetch filled a Fast-4G link with searches as the
 * page loaded, and a tap in the first seconds waited ~3 s for its first audio
 * request (TapeBench, 2026-11-07).
 */
describe("SetlistPoster prefetch", () => {
  const src = readSource("src/pages/SetlistPoster.tsx");

  it("never calls the generic multi-title Archive search", () => {
    expect(src).not.toMatch(/\bfindArchiveRecordings\s*\(/);
  });

  it("asks findSongDefault for undated songs", () => {
    expect(src).toMatch(/await findSongDefault\(\s*title\s*,\s*songId\s*\)/);
  });
});
