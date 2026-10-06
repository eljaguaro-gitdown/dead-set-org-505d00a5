import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The ONLY access-control branch in the community-issue path: a guide whose
 * author has made it private must stop having an issue page.
 *
 * It had no test. The 2026-10-05 gate deleted `|| !setlist.is_public` from the
 * loader and every one of the 22 tests then covering this feature stayed
 * green — the happy path was pinned and the branch that matters was not. So
 * this file drives the real loader with a stubbed client and asserts the
 * refusal, rather than reading the source for the string.
 */

const SONG = "song-1";
const SET = "set-1";

/** What each table answers with, per test. */
let tables: Record<string, unknown>;

const builder = (table: string) => {
  const result = () => tables[table];
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    order: () => Promise.resolve({ data: result(), error: null }),
    maybeSingle: () =>
      Promise.resolve({ data: (result() as unknown[])?.[0] ?? null, error: null }),
    then: (res: (v: unknown) => unknown) =>
      Promise.resolve({ data: result(), error: null }).then(res),
  };
  return chain;
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (t: string) => builder(t) },
}));
vi.mock("@/lib/songbookDb", () => ({
  songbookDb: { from: (t: string) => builder(t) },
}));

import { loadCommunityIssue } from "@/lib/communityIssue";

const archiveSlot = (pos: number, date: string) => ({
  id: `slot-${pos}`,
  position: pos,
  notes:
    JSON.stringify({
      __archive: true,
      show_date: date,
      venue: "Winterland",
      archive_org_url: `https://archive.org/details/gd${date}`,
      note: "A night.",
    }) + "\n",
});

beforeEach(() => {
  tables = {
    songs: [
      {
        id: SONG,
        title: "Eyes of the World",
        first_played: "1973-02-09",
        last_played: "1995-07-06",
        times_played: 382,
      },
    ],
    songbook_entries: [{ setlist_id: SET, creator_id: "user-1" }],
    setlists: [{ id: SET, is_public: true }],
    setlist_slots: [archiveSlot(1, "1974-06-18")],
    profiles: [{ display_name: "ric neil" }],
  };
});

describe("loadCommunityIssue refuses what the reader may not see", () => {
  it("loads the issue while the guide is public", async () => {
    const issue = await loadCommunityIssue("eyes-of-the-world");
    expect(issue).not.toBeNull();
    expect(issue!.mappedBy).toBe("ric neil");
    expect(issue!.nights).toHaveLength(1);
  });

  it("refuses once the author makes the guide private", async () => {
    // The assertion the gate's mutation proved was missing.
    tables.setlists = [{ id: SET, is_public: false }];
    expect(await loadCommunityIssue("eyes-of-the-world")).toBeNull();
  });

  it("refuses when the guide has been deleted outright", async () => {
    tables.setlists = [];
    expect(await loadCommunityIssue("eyes-of-the-world")).toBeNull();
  });

  it("refuses when no song matches the slug", async () => {
    expect(await loadCommunityIssue("a-song-nobody-wrote")).toBeNull();
  });

  it("refuses when the song has no community entry", async () => {
    tables.songbook_entries = [];
    expect(await loadCommunityIssue("eyes-of-the-world")).toBeNull();
  });

  it("reads the author's note from the field the decoder actually fills", () => {
    // `decoded.notes` is the trailing free text; the per-tape note lives in
    // `version.description`. Reading the wrong one renders every night blank,
    // which is what shipped in the first draft and only a browser caught.
    return loadCommunityIssue("eyes-of-the-world").then((issue) => {
      expect(issue!.nights[0].note).toBe("A night.");
      expect(issue!.nights[0].venue).toBe("Winterland");
      expect(issue!.nights[0].showDate).toBe("1974-06-18");
    });
  });
});
