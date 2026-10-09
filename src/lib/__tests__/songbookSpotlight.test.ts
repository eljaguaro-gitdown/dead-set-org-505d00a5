import { describe, it, expect } from "vitest";
import {
  communitySpotlight,
  formatNight,
  isLaunchWeek,
  issueSpotlight,
  parseIssueDate,
  preferredEnd,
  shelfOrder,
  spotlightForWeek,
  spotlightSlot,
  type CommunityEntry,
  type IssueEntry,
  type RankedVersion,
  type ShelfEntry,
} from "@/lib/songbookSpotlight";
import { sleepers } from "@/lib/sleeperMath";
import type { CommunityNight } from "@/lib/communityIssue";

/**
 * The home page's Songbook card: which song it carries, and what it says.
 *
 * Fixtures are the production shelf as of 2026-10-08: two editorial issues
 * and six community entries, with their real dates, vote counts and urls.
 */

const issue = (
  slug: string,
  title: string,
  weekOf: string,
  n: number,
  fields: Partial<IssueEntry["issue"]> = {},
): IssueEntry => ({
  kind: "issue",
  slug,
  title,
  songId: `song-${slug}`,
  since: weekOf,
  issueNumber: n,
  issue: {
    headline: null,
    ftp_date: null, ftp_venue: null, ftp_city: null,
    ltp_date: null, ltp_venue: null, ltp_city: null, ltp_note: null,
    times_played: null,
    ...fields,
  },
});

const community = (slug: string, title: string, createdAt: string, extra: Partial<CommunityEntry> = {}): CommunityEntry => ({
  kind: "community",
  slug,
  title,
  songId: `song-${slug}`,
  since: createdAt,
  setlistId: `set-${slug}`,
  firstPlayed: null,
  lastPlayed: null,
  timesPlayed: null,
  ...extra,
});

const CRAZY_FINGERS = issue("crazy-fingers", "Crazy Fingers", "2026-09-14", 2, {
  headline: "They put it down for 417 shows. It came back a different song.",
  ftp_date: "June 17, 1975", ftp_venue: "Winterland Arena", ftp_city: "San Francisco, CA",
  ltp_date: "July 5, 1995", ltp_venue: "Riverport Amphitheatre", ltp_city: "Maryland Heights, MO",
  ltp_note: "three shows before the band's last night",
  times_played: 145,
});
const SHAKEDOWN = issue("shakedown-street", "Shakedown Street", "2026-08-24", 1, {
  headline: "One night is a moment. Seventeen years is a life.",
  ftp_date: "Aug 31, 1978", ftp_venue: "Red Rocks Amphitheatre", ftp_city: "Morrison, CO",
  ltp_date: "July 9, 1995", ltp_venue: "Soldier Field", ltp_city: "Chicago, IL",
  ltp_note: "the last night the Grateful Dead ever played",
  times_played: 163,
});

/**
 * Deliberately NOT in shelf order. loadShelf's query has no ORDER BY, so the
 * rows can arrive any way round, and the schedule must not depend on it.
 */
const SHELF: ShelfEntry[] = [
  community("stella-blue", "Stella Blue", "2026-10-06 00:36:33+00"),
  SHAKEDOWN,
  community("ripple", "Ripple", "2026-10-05 00:38:41+00"),
  community("eyes-of-the-world", "Eyes of the World", "2026-10-05 21:17:15+00"),
  CRAZY_FINGERS,
  community("althea", "Althea", "2026-10-04 23:03:08+00"),
  community("viola-lee-blues", "Viola Lee Blues", "2026-10-05 17:42:12+00"),
  community("bird-song", "Bird Song", "2026-10-05 05:46:15+00"),
];

/** Crazy Fingers' fifteen ranked versions, as migrated. */
const CF_VOTES: Array<[string, number, string | null]> = [
  ["1975-06-17", 32, "https://archive.org/details/gd1975-06-17.sbd.GEMS.96125.flac16"],
  ["1975-08-13", 79, "u"], ["1976-06-03", 28, "u"], ["1976-06-09", 92, "u"],
  ["1976-06-14", 76, "u"], ["1976-06-18", 17, "u"], ["1976-06-22", 24, "u"],
  ["1976-07-13", 37, "u"], ["1976-09-30", 19, "u"], ["1982-10-10", 41, "u"],
  ["1989-07-02", 24, "u"], ["1990-09-15", 20, "u"], ["1991-09-25", 32, "u"],
  ["1993-03-24", 20, "u"], ["1993-05-26", 20, "u"],
];
const CF_VERSIONS: RankedVersion[] = CF_VOTES.map(([d, votes, url], i) => ({
  id: `cf-${i}`,
  show_date: d,
  votes,
  archive_org_url: url,
}));

/** Shakedown's fifteen: one url on file, on neither end of its life. */
const SS_VERSIONS: RankedVersion[] = [
  58, 47, 71, 168, 40, 53, 39, 42, 89, 51, 73, 181, 40, 37, 48,
].map((votes, i) => ({
  id: `ss-${i}`,
  show_date: `19${79 + (i % 10)}-01-0${(i % 9) + 1}`,
  votes,
  archive_org_url: i === 11 ? "https://archive.org/details/gd85-06-30" : null,
}));

const at = (iso: string) => new Date(iso);

describe("parseIssueDate", () => {
  it("reads the lifespan dates the issues are actually written with", () => {
    expect(parseIssueDate("June 17, 1975")).toBe("1975-06-17");
    expect(parseIssueDate("Aug 31, 1978")).toBe("1978-08-31");
    expect(parseIssueDate("July 9, 1995")).toBe("1995-07-09");
    expect(parseIssueDate("Sept 5, 1980")).toBe("1980-09-05");
    expect(parseIssueDate("Dec. 31, 1984")).toBe("1984-12-31");
    expect(parseIssueDate("1975-06-17")).toBe("1975-06-17");
  });

  it("refuses what is not a real night, rather than rolling it into the next month", () => {
    expect(parseIssueDate("Feb 30, 1980")).toBeNull();
    expect(parseIssueDate("1980-02-30")).toBeNull();
    expect(parseIssueDate("Summer 1975")).toBeNull();
    expect(parseIssueDate("1975")).toBeNull();
    expect(parseIssueDate("Smarch 3, 1975")).toBeNull();
    expect(parseIssueDate("")).toBeNull();
    expect(parseIssueDate(null)).toBeNull();
  });
});

describe("formatNight", () => {
  it("writes a date the way the issues do", () => {
    expect(formatNight("1979-08-04")).toBe("August 4, 1979");
    expect(formatNight("1995-07-06")).toBe("July 6, 1995");
    expect(formatNight(null)).toBeNull();
    expect(formatNight("1979")).toBeNull();
  });
});

describe("shelfOrder", () => {
  it("puts issues newest first, then the community in the order it was mapped", () => {
    expect(shelfOrder(SHELF).map((e) => e.slug)).toEqual([
      "crazy-fingers",
      "shakedown-street",
      "althea",
      "ripple",
      "bird-song",
      "viola-lee-blues",
      "eyes-of-the-world",
      "stella-blue",
    ]);
  });

  it("lists a song with both an issue and a community entry once, as the issue", () => {
    const dup = community("crazy-fingers", "Crazy Fingers", "2026-10-01 00:00:00+00", {
      songId: CRAZY_FINGERS.songId,
    });
    const ordered = shelfOrder([dup, ...SHELF]);
    expect(ordered.filter((e) => e.songId === CRAZY_FINGERS.songId)).toEqual([CRAZY_FINGERS]);
    expect(ordered).toHaveLength(SHELF.length);
  });
});

describe("spotlightForWeek", () => {
  it("follows the real shelf through a full cycle, one song per Monday", () => {
    const schedule = [
      ["2026-10-08T12:00:00Z", "crazy-fingers"], // the rotation's first week: the song the card already had
      ["2026-10-12T12:00:00Z", "shakedown-street"],
      ["2026-10-19T12:00:00Z", "althea"],
      ["2026-10-26T12:00:00Z", "ripple"],
      ["2026-11-02T12:00:00Z", "bird-song"],
      ["2026-11-09T12:00:00Z", "viola-lee-blues"],
      ["2026-11-16T12:00:00Z", "eyes-of-the-world"],
      ["2026-11-23T12:00:00Z", "stella-blue"],
      ["2026-11-30T12:00:00Z", "crazy-fingers"],
    ] as const;
    for (const [when, slug] of schedule) {
      expect(spotlightForWeek(SHELF, at(when))?.slug, when).toBe(slug);
    }
  });

  it("holds one song for the whole ISO week and turns over at Monday 00:00 UTC", () => {
    const monday = spotlightForWeek(SHELF, at("2026-10-12T00:00:00Z"))?.slug;
    expect(spotlightForWeek(SHELF, at("2026-10-15T09:30:00Z"))?.slug).toBe(monday);
    expect(spotlightForWeek(SHELF, at("2026-10-18T23:59:59Z"))?.slug).toBe(monday);
    expect(spotlightForWeek(SHELF, at("2026-10-11T23:59:59Z"))?.slug).not.toBe(monday);
    expect(spotlightForWeek(SHELF, at("2026-10-19T00:00:00Z"))?.slug).not.toBe(monday);
  });

  it("still picks a song for weeks before the rotation began", () => {
    // A clock set wrong on a device must not index out of the shelf. Pinned to
    // the exact song: an out-of-range index returns undefined, which a
    // `not.toBeNull()` here once let through.
    expect(spotlightForWeek(SHELF, at("2026-09-28T12:00:00Z"))?.slug).toBe("stella-blue");
    const longAgo = spotlightForWeek(SHELF, at("2020-01-01T12:00:00Z"));
    expect(SHELF).toContain(longAgo);
  });

  it("lets a newly published issue take its launch week, whatever the rotation says", () => {
    const vol3 = issue("dark-star", "Dark Star", "2026-11-16", 3);
    const shelf = [...SHELF, vol3];
    expect(spotlightForWeek(shelf, at("2026-11-16T08:00:00Z"))?.slug).toBe("dark-star");
    expect(spotlightForWeek(shelf, at("2026-11-22T23:00:00Z"))?.slug).toBe("dark-star");
    // Then it joins the shelf like any other issue.
    expect(isLaunchWeek(vol3, at("2026-11-23T00:00:00Z"))).toBe(false);
  });

  it("does not lead with an issue dated in the future", () => {
    const early = issue("dark-star", "Dark Star", "2026-12-07", 3);
    expect(isLaunchWeek(early, at("2026-11-30T12:00:00Z"))).toBe(false);
  });

  it("never gives a community entry a launch week: the front door rotates fan work, it does not jump it", () => {
    const fresh = community("china-cat", "China Cat Sunflower", "2026-10-08 10:00:00+00");
    expect(isLaunchWeek(fresh, at("2026-10-08T12:00:00Z"))).toBe(false);
  });

  it("returns null for an empty shelf", () => {
    expect(spotlightForWeek([], at("2026-10-08T12:00:00Z"))).toBeNull();
  });
});

describe("issueSpotlight", () => {
  const cf = issueSpotlight(CRAZY_FINGERS, CF_VERSIONS);

  it("counts the sleepers by the same rule as the issue's own ladder", () => {
    expect(cf.finding).toEqual({ kind: "sleepers", count: 7 });
    expect(cf.finding?.count).toBe(sleepers(CF_VERSIONS).length);
    expect(issueSpotlight(SHAKEDOWN, SS_VERSIONS).finding).toEqual({ kind: "sleepers", count: 9 });
  });

  it("claims no sleepers for an issue with no vote data", () => {
    const unvoted = CF_VERSIONS.map((v) => ({ ...v, votes: null }));
    expect(issueSpotlight(CRAZY_FINGERS, unvoted).finding).toBeNull();
    expect(issueSpotlight(CRAZY_FINGERS, []).finding).toBeNull();
  });

  it("prints the issue's own lifespan text and plays the night it names", () => {
    expect(cf.first).toMatchObject({
      date: "1975-06-17",
      label: "June 17, 1975",
      year: "1975",
      venue: "Winterland Arena",
      archiveUrl: "https://archive.org/details/gd1975-06-17.sbd.GEMS.96125.flac16",
      versionId: "cf-0",
    });
    expect(cf.last).toMatchObject({
      date: "1995-07-05",
      label: "July 5, 1995",
      venue: "Riverport Amphitheatre",
      archiveUrl: null,
      note: "three shows before the band's last night",
    });
    expect(cf.headline).toBe(CRAZY_FINGERS.issue.headline);
    expect(cf.timesPlayed).toBe(145);
  });

  it("still shows the year when an issue's date cannot be read as a night", () => {
    const loose = issueSpotlight(
      issue("x", "X", "2026-09-01", 9, { ftp_date: "Summer 1975", ltp_date: "July 5, 1995" }),
      [],
    );
    expect(loose.first).toMatchObject({ date: null, year: "1975", label: "Summer 1975" });
    expect(preferredEnd(loose)).toBe("last");
  });
});

describe("communitySpotlight", () => {
  const night = (position: number, showDate: string | null, venue: string | null, archiveUrl: string | null): CommunityNight => ({
    position, showDate, venue, archiveUrl, note: "",
  });

  const stella = communitySpotlight(
    community("stella-blue", "Stella Blue", "2026-10-06", {
      firstPlayed: "1972-06-17",
      lastPlayed: "1995-07-06",
      timesPlayed: 330,
    }),
    [
      night(1, "1972-06-17", "Hollywood Bowl", null),
      night(2, "1974-10-18", "Winterland", "https://archive.org/details/a"),
      night(3, null, null, null),
      night(6, "1995-07-06", "Riverport Amphitheatre", "https://archive.org/details/gd95-07-06"),
    ],
  );

  it("invents no headline and carries no name: the guide's page credits its mapper, the front door does not", () => {
    expect(stella.headline).toBeNull();
    expect(stella.issueNumber).toBeNull();
    expect(Object.keys(stella).sort()).toEqual(
      ["finding", "first", "headline", "issueNumber", "kind", "last", "slug", "songId", "timesPlayed", "title"],
    );
  });

  it("counts the nights that name a date, as the issue page's Play all does", () => {
    expect(stella.finding).toEqual({ kind: "nights", count: 3 });
  });

  it("learns a venue and a tape for an end only from the guide's own night", () => {
    expect(stella.first).toMatchObject({ date: "1972-06-17", venue: "Hollywood Bowl", archiveUrl: null });
    expect(stella.last).toMatchObject({
      date: "1995-07-06",
      label: "July 6, 1995",
      venue: "Riverport Amphitheatre",
      archiveUrl: "https://archive.org/details/gd95-07-06",
    });
  });

  it("offers the end that has a tape on file", () => {
    expect(preferredEnd(stella)).toBe("last");
  });

  it("claims nothing when the guide has no dated nights", () => {
    const empty = communitySpotlight(community("x", "X", "2026-10-06"), [night(1, null, null, null)]);
    expect(empty.finding).toBeNull();
    expect(preferredEnd(empty)).toBeNull();
  });
});

describe("preferredEnd", () => {
  const end = (which: "first" | "last", date: string | null, archiveUrl: string | null) => ({
    which, date, archiveUrl, label: null, year: null, venue: null, city: null, versionId: null, note: null,
  });

  it("prefers a night with a tape on file, first before last", () => {
    expect(preferredEnd({ first: end("first", "1975-06-17", "u"), last: end("last", "1995-07-05", null) })).toBe("first");
    expect(preferredEnd({ first: end("first", "1975-06-17", null), last: end("last", "1995-07-05", "u") })).toBe("last");
    expect(preferredEnd({ first: end("first", "1975-06-17", "u"), last: end("last", "1995-07-05", "u") })).toBe("first");
  });

  it("falls back to the first dated night, and offers nothing undated", () => {
    expect(preferredEnd({ first: end("first", "1978-08-31", null), last: end("last", "1995-07-09", null) })).toBe("first");
    expect(preferredEnd({ first: end("first", null, "u"), last: end("last", null, null) })).toBeNull();
  });
});

describe("spotlightSlot", () => {
  const cf = issueSpotlight(CRAZY_FINGERS, CF_VERSIONS);
  const ss = issueSpotlight(SHAKEDOWN, SS_VERSIONS);

  it("carries the ranked version's tape and id when the night is on the ladder", () => {
    const slot = spotlightSlot(cf, cf.first);
    expect(slot.id).toBe("hero-songbook-crazy-fingers-first");
    expect(slot.version).toMatchObject({
      id: "cf-0",
      show_date: "1975-06-17",
      venue: "Winterland Arena",
      archive_org_url: "https://archive.org/details/gd1975-06-17.sbd.GEMS.96125.flac16",
    });
    expect(slot.directTrackUrl).toBeNull();
  });

  it("names the night and nothing else when no tape is known, so the player looks THAT night up", () => {
    const slot = spotlightSlot(ss, ss.first);
    expect(slot.version?.show_date).toBe("1978-08-31");
    expect(slot.version?.archive_org_url).toBeNull();
  });

  it("takes BOTH the url and the track from a lookup already made", () => {
    const slot = spotlightSlot(ss, ss.first, {
      url: "https://archive.org/details/gd78-08-31.aud-sbd.miller.20726.sbeok.shnf",
      directTrackUrl: "https://archive.org/download/gd78-08-31.aud-sbd.miller.20726.sbeok.shnf/gd78-08-31d1t07.mp3",
      venue: "Red Rocks Amphitheatre",
    });
    expect(slot.version?.archive_org_url).toBe("https://archive.org/details/gd78-08-31.aud-sbd.miller.20726.sbeok.shnf");
    expect(slot.directTrackUrl).toBe(
      "https://archive.org/download/gd78-08-31.aud-sbd.miller.20726.sbeok.shnf/gd78-08-31d1t07.mp3",
    );
  });

  it("ignores a lookup that found the night but not the song on it", () => {
    const slot = spotlightSlot(ss, ss.first, { url: "https://archive.org/details/partial", directTrackUrl: null });
    expect(slot.version?.archive_org_url).toBeNull();
    expect(slot.directTrackUrl).toBeNull();
  });
});
