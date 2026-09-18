import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { findManyArchiveRecordings } from "@/lib/archiveOrg";

/**
 * Regression cover for "dig deep": narrowing to a year range must narrow the
 * *query*, not post-filter a global top-50. Archive.org sorts by rating and we
 * only take `rows` of them, so a range filter applied after the fetch can come
 * back empty even when plenty of in-window tapes circulate.
 */

type Doc = { identifier: string; date: string; avg_rating?: string; venue?: string };

let requestedUrls: string[] = [];

/** Stub archive.org's advancedsearch endpoint with a fixed set of docs. */
function stubArchive(docs: Doc[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      requestedUrls.push(String(url));
      return {
        ok: true,
        json: async () => ({ response: { docs } }),
      } as unknown as Response;
    }),
  );
}

beforeEach(() => {
  requestedUrls = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("findManyArchiveRecordings — year window", () => {
  it("adds an inclusive date clause to the archive.org query", async () => {
    stubArchive([{ identifier: "gd1974-06-18", date: "1974-06-18T00:00:00Z" }]);

    await findManyArchiveRecordings("Crazy Fingers Alpha", 50, 1974, 1976);

    const query = decodeURIComponent(requestedUrls[0]);
    expect(query).toContain("date:[1974-01-01 TO 1976-12-31]");
    expect(query).toContain('collection:GratefulDead "Crazy Fingers Alpha"');
  });

  it("omits the date clause when no window is given", async () => {
    stubArchive([{ identifier: "gd1977-05-08", date: "1977-05-08T00:00:00Z" }]);

    await findManyArchiveRecordings("Crazy Fingers Bravo", 50);

    expect(decodeURIComponent(requestedUrls[0])).not.toContain("date:[");
  });

  it("drops out-of-window docs the Archive returns anyway", async () => {
    // archive.org occasionally carries malformed dates or ignores the clause;
    // a version shown under "1974-1976" must actually be from it.
    stubArchive([
      { identifier: "in-window", date: "1975-06-17T00:00:00Z" },
      { identifier: "too-early", date: "1971-04-26T00:00:00Z" },
      { identifier: "too-late", date: "1989-07-07T00:00:00Z" },
      { identifier: "no-date", date: "" },
    ]);

    const results = await findManyArchiveRecordings("Crazy Fingers Charlie", 50, 1974, 1976);

    expect(results.map((r) => r.identifier)).toEqual(["in-window"]);
  });

  it("supports a single year as a one-year window", async () => {
    stubArchive([
      { identifier: "gd1974", date: "1974-09-21T00:00:00Z" },
      { identifier: "gd1975", date: "1975-09-21T00:00:00Z" },
    ]);

    const results = await findManyArchiveRecordings("Crazy Fingers Delta", 50, 1974, 1974);

    expect(decodeURIComponent(requestedUrls[0])).toContain("date:[1974-01-01 TO 1974-12-31]");
    expect(results.map((r) => r.identifier)).toEqual(["gd1974"]);
  });

  it("caches per window, so two ranges of one song do not collide", async () => {
    stubArchive([{ identifier: "gd1974-alpha", date: "1974-06-18T00:00:00Z" }]);
    await findManyArchiveRecordings("Crazy Fingers Echo", 50, 1974, 1974);

    stubArchive([{ identifier: "gd1977-alpha", date: "1977-05-08T00:00:00Z" }]);
    const second = await findManyArchiveRecordings("Crazy Fingers Echo", 50, 1977, 1977);

    // A cache keyed only by title would hand back the 1974 result here.
    expect(second.map((r) => r.identifier)).toEqual(["gd1977-alpha"]);
  });

  it("returns an empty list, not a throw, when the window has nothing", async () => {
    stubArchive([]);

    const results = await findManyArchiveRecordings("Crazy Fingers Foxtrot", 50, 1966, 1967);

    expect(results).toEqual([]);
  });
});
