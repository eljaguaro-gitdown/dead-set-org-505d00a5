import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * loadCommunityIssue had no test, which is how a swapped first/last venue
 * wiring survived the gate's mutation run: every other test builds a
 * CommunityIssue by hand and so cannot see how the loader fills it.
 *
 * The slot blobs here are copied verbatim out of production (Eyes of the
 * World, read 2026-10-06) rather than written — hand-made fixtures for this
 * blob have been wrong three times.
 */

const rows = vi.hoisted(() => ({
  songs: [] as unknown[],
  songbook_entries: null as unknown,
  setlists: null as unknown,
  setlist_slots: [] as unknown[],
  profiles: null as unknown,
}));

/** A thenable query builder: every method returns `this`, and awaiting it
 *  yields the table's rows, so chain order does not matter. */
const builder = (table: keyof typeof rows) => {
  const list = () => (Array.isArray(rows[table]) ? rows[table] : []);
  const api: Record<string, unknown> = {
    select: () => api,
    eq: () => api,
    order: () => api,
    maybeSingle: async () => ({ data: rows[table], error: null }),
    then: (res: (v: unknown) => unknown) => res({ data: list(), error: null }),
  };
  return api;
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (t: keyof typeof rows) => builder(t) },
}));
vi.mock("@/lib/songbookDb", () => ({
  songbookDb: { from: (t: keyof typeof rows) => builder(t) },
}));

import { loadCommunityIssue } from "@/lib/communityIssue";

const SONG_ID = "song-1";
const blob = (d: string, v: string, url: string | null, note: string) =>
  JSON.stringify({ __archive: true, show_date: d, venue: v, archive_org_url: url, rating: null }) +
  "\n" + note;

beforeEach(() => {
  rows.songs = [{
    id: SONG_ID, title: "Eyes of the World",
    first_played: "1973-02-09", last_played: "1995-07-06", times_played: 382,
  }];
  rows.songbook_entries = { setlist_id: "set-1", creator_id: "u1" };
  rows.setlists = { id: "set-1", is_public: true };
  rows.profiles = { display_name: "ric neil" };
  rows.setlist_slots = [
    { id: "s1", position: 1, notes: blob("1973-02-09", "Roscoe Maples Pavilion, Stanford U.", "https://archive.org/details/a", "1973-02-09 — Roscoe Maples Pavilion • The debut.") },
    { id: "s2", position: 2, notes: blob("1993-06-15", "Freedom Hall", null, "1993-06-15 — Freedom Hall • A late-career standout.") },
    { id: "s3", position: 3, notes: blob("1995-07-06", "Riverport Amphitheatre", "https://archive.org/details/b", "Last time played: 1995-07-06 — Riverport Amphitheatre") },
  ];
});

describe("loadCommunityIssue", () => {
  it("puts the first-played venue under FIRST played, and last under LAST", async () => {
    const issue = (await loadCommunityIssue("eyes-of-the-world"))!;
    expect(issue).not.toBeNull();
    // Swapping these renders a venue under both dates, so a presence-only
    // assertion cannot tell the wiring apart. Pin each to its own date.
    expect(issue.firstPlayed).toBe("1973-02-09");
    expect(issue.firstPlayedVenue).toBe("Roscoe Maples Pavilion, Stanford U.");
    expect(issue.lastPlayed).toBe("1995-07-06");
    expect(issue.lastPlayedVenue).toBe("Riverport Amphitheatre");
  });

  it("keeps a night whose blob stores no tape, and the url of one that has it", async () => {
    const issue = (await loadCommunityIssue("eyes-of-the-world"))!;
    const freedom = issue.nights.find((n) => n.showDate === "1993-06-15")!;
    expect(freedom.archiveUrl).toBeNull();
    expect(freedom.venue).toBe("Freedom Hall");
    // Asserting only the null half lets "archiveUrl: null" for every night
    // pass — the stored tape has to survive the decode as well.
    expect(issue.nights.find((n) => n.showDate === "1973-02-09")!.archiveUrl)
      .toBe("https://archive.org/details/a");
  });

  it("strips the preamble the card already prints above the note", async () => {
    const issue = (await loadCommunityIssue("eyes-of-the-world"))!;
    expect(issue.nights.find((n) => n.showDate === "1993-06-15")!.note)
      .toBe("A late-career standout.");
    // Pure restatement collapses to nothing rather than repeating the heading.
    expect(issue.nights.find((n) => n.showDate === "1995-07-06")!.note).toBe("");
  });

  it("credits the mapper by display name", async () => {
    expect((await loadCommunityIssue("eyes-of-the-world"))!.mappedBy).toBe("ric neil");
  });

  it("refuses an issue whose guide was made private", async () => {
    rows.setlists = { id: "set-1", is_public: false };
    expect(await loadCommunityIssue("eyes-of-the-world")).toBeNull();
  });

  it("returns null when no song matches the slug", async () => {
    expect(await loadCommunityIssue("not-a-song")).toBeNull();
  });
});
