import { describe, it, expect } from "vitest";
import { archiveKey, archiveKeyDate } from "@/lib/archiveOrg";

/**
 * Keying a map of resolved recordings by song title alone is correct only when
 * no two slots of the same song want different nights. A listening guide is
 * precisely that case: the Althea guide of 2026-10-04 had four slots of one
 * song, the map deduped them to a single entry, and every row was handed the
 * same tape — or, with no night recorded at all, none.
 */
describe("archiveKeyDate", () => {
  it("takes the day out of a date", () => {
    expect(archiveKeyDate("1980-05-16")).toBe("1980-05-16");
    expect(archiveKeyDate("1980-05-16T00:00:00Z")).toBe("1980-05-16");
  });

  it("returns null for the absent dates decodeArchiveNotes writes", () => {
    expect(archiveKeyDate("")).toBeNull();
    expect(archiveKeyDate(null)).toBeNull();
    expect(archiveKeyDate(undefined)).toBeNull();
  });

  it("returns null for a date it cannot resolve a single night from", () => {
    expect(archiveKeyDate("1980")).toBeNull();
    expect(archiveKeyDate("1980-05")).toBeNull();
    expect(archiveKeyDate("unknown")).toBeNull();
  });
});

describe("archiveKey", () => {
  it("separates the same song on different nights", () => {
    const a = archiveKey("Althea", "1980-05-16");
    const b = archiveKey("Althea", "1981-03-28");
    expect(a).not.toBe(b);
  });

  it("collapses the same song on the same night, however it is cased", () => {
    expect(archiveKey("Althea", "1980-05-16")).toBe(archiveKey("  althea ", "1980-05-16"));
  });

  it("keeps a night-less key distinct from any night of the same song", () => {
    const undated = archiveKey("Althea", null);
    expect(undated).toBe("althea");
    expect(undated).not.toBe(archiveKey("Althea", "1980-05-16"));
  });
});
