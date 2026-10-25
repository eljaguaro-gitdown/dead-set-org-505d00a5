import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

import {
  asIsoDate,
  asUuid,
  claimPendingFollows,
  fetchCommunityFixes,
  fetchKnownGoodTape,
  isArchiveTrackUrl,
  knownGoodToSlot,
  oopsCopy,
  recordTapeOk,
  rememberPendingFollow,
  reportPlaybackIssue,
  resetPlayedHere,
  shortShowDate,
} from "@/lib/playbackIssues";
import type { PlayableSlot } from "@/contexts/AudioPlayerContext";

const SONG = "51515151-5151-4515-8515-515151515151";
const TRACK = "https://archive.org/download/gd1979-08-04.sbd/gd79-08-04d2t03.mp3";

const slot = (over: Partial<PlayableSlot> = {}): PlayableSlot => ({
  id: "s1",
  song: { id: SONG, title: "Althea" },
  version: { show_date: "1979-08-04", archive_org_url: "https://archive.org/details/gd1979-08-04.sbd" } as PlayableSlot["version"],
  setNumber: 1,
  position: 0,
  segueToNext: false,
  directTrackUrl: TRACK,
  ...over,
});

beforeEach(() => {
  rpc.mockReset();
  resetPlayedHere();
  localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe("what the card says", () => {
  it("names the song and the night, in the house voice", () => {
    expect(oopsCopy({ kind: "not_on_tape", songTitle: "Althea", showDate: "1979-08-04" })).toEqual({
      headline: "Oops. Althea won't play.",
      detail: "We pulled the 8/4/79 tape and couldn't find it on there.",
    });
    expect(oopsCopy({ kind: "no_tape", songTitle: "Althea", showDate: "1979-08-04" }).detail).toBe(
      "We couldn't turn up a tape of 8/4/79.",
    );
    expect(oopsCopy({ kind: "wont_play", songTitle: "Althea", showDate: null }).detail).toBe(
      "The tape's on the Archive, but it won't spin for us.",
    );
    expect(oopsCopy({ kind: "none_in_setlist", songTitle: "Althea", showDate: null }).headline).toBe(
      "Oops. None of these would spin.",
    );
  });

  it("never prints a date it does not have", () => {
    expect(oopsCopy({ kind: "not_on_tape", songTitle: "Althea", showDate: null }).detail).toBe(
      "We pulled the tape and couldn't find it on there.",
    );
    expect(oopsCopy({ kind: "no_tape", songTitle: "Althea", showDate: "" }).detail).toBe("We couldn't turn up a tape of it.");
  });

  it("dates in taper shorthand without shifting a day west of UTC", () => {
    expect(shortShowDate("1977-05-08")).toBe("5/8/77");
    expect(shortShowDate("1995-07-09T00:00:00Z")).toBe("7/9/95");
    expect(shortShowDate("May 8")).toBeNull();
  });

  it("never says AI, tool, or ticket", () => {
    const all = (["not_on_tape", "no_tape", "wont_play", "none_in_setlist"] as const)
      .flatMap((kind) => Object.values(oopsCopy({ kind, songTitle: "X", showDate: "1977-05-08" })))
      .join(" ");
    expect(all).not.toMatch(/\bAI\b|\btool\b|\bticket\b|algorithm/i);
  });
});

describe("only Archive download urls are trusted", () => {
  it.each([
    [TRACK, true],
    ["https://archive.org/details/gd1979-08-04.sbd", false],
    ["http://archive.org/download/gd79/x.mp3", false],
    ["https://archive.org.evil.example/download/gd79/x.mp3", false],
    ["https://archive.org/download/gd79/x.mp3?redirect=https://evil.example", false],
    ["javascript:alert(1)", false],
    [null, false],
  ])("%s → %s", (url, expected) => {
    expect(isArchiveTrackUrl(url)).toBe(expected);
  });
});

describe("filing a report", () => {
  it("sends only what the database can trust", async () => {
    rpc.mockResolvedValue({ data: "issue-1", error: null });
    const id = await reportPlaybackIssue({
      kind: "not_on_tape",
      songId: "archive-not-a-uuid",
      songTitle: "Althea",
      showDate: "1979-08-04T07:00:00Z",
      archiveUrl: "https://archive.org/details/x",
      setlistId: "also-not-a-uuid",
    });
    expect(id).toBe("issue-1");
    expect(rpc).toHaveBeenCalledWith(
      "report_playback_issue",
      expect.objectContaining({ p_kind: "not_on_tape", p_song_id: null, p_setlist_id: null, p_show_date: "1979-08-04", p_notify: true }),
    );
  });

  it("returns null when it could not be filed, so nobody is told it was", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    expect(await reportPlaybackIssue({ kind: "no_tape", songId: SONG, songTitle: "Althea", showDate: null })).toBeNull();
    rpc.mockRejectedValueOnce(new Error("offline"));
    expect(await reportPlaybackIssue({ kind: "no_tape", songId: SONG, songTitle: "Althea", showDate: null })).toBeNull();
  });

  it("asUuid and asIsoDate reject what the database would", () => {
    expect(asUuid("songbook-x-1")).toBeNull();
    expect(asUuid(SONG)).toBe(SONG);
    expect(asIsoDate("")).toBeNull();
    expect(asIsoDate("1979-08-04")).toBe("1979-08-04");
  });
});

describe("a tape we KNOW plays", () => {
  it("takes the database's answer when it is a real Archive track", async () => {
    rpc.mockResolvedValue({
      data: [{ song_id: SONG, song_title: "Althea", show_date: "1977-05-08", archive_url: null, track_url: TRACK }],
      error: null,
    });
    expect(await fetchKnownGoodTape({ songId: SONG, showDate: "1979-08-04", trackUrl: null })).toEqual({
      songId: SONG,
      songTitle: "Althea",
      showDate: "1977-05-08",
      archiveUrl: null,
      trackUrl: TRACK,
    });
  });

  it("refuses a row whose url is not an Archive download, even from the database", async () => {
    rpc.mockResolvedValue({
      data: [{ song_id: SONG, song_title: "Althea", show_date: null, archive_url: null, track_url: "https://evil.example/a.mp3" }],
      error: null,
    });
    expect(await fetchKnownGoodTape({ songId: SONG, showDate: null, trackUrl: null })).toBeNull();
  });

  it("falls back to a tape that played HERE, but never the night that just failed", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    recordTapeOk(slot({ song: { id: SONG, title: "Althea" } }));
    // The failure is this same night: nothing honest to offer.
    expect(await fetchKnownGoodTape({ songId: SONG, showDate: "1979-08-04", trackUrl: null })).toBeNull();
    // A different night of the song failed: the one that played here is offered.
    expect((await fetchKnownGoodTape({ songId: SONG, showDate: "1990-03-29", trackUrl: null }))?.trackUrl).toBe(TRACK);
  });

  it("offers nothing when nothing is known, rather than a guess", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await fetchKnownGoodTape({ songId: SONG, showDate: null, trackUrl: null })).toBeNull();
  });

  it("records a play only for an Archive track, and only tells the database about real songs", () => {
    rpc.mockResolvedValue({ data: null, error: null });
    recordTapeOk(slot({ directTrackUrl: "https://evil.example/x.mp3" }));
    expect(rpc).not.toHaveBeenCalled();
    recordTapeOk(slot({ song: { id: "archive-search-1", title: "Althea" } }));
    expect(rpc).not.toHaveBeenCalled();
    recordTapeOk(slot());
    expect(rpc).toHaveBeenCalledWith("record_tape_ok", {
      p_song_id: SONG,
      p_show_date: "1979-08-04",
      p_archive_url: "https://archive.org/details/gd1979-08-04.sbd",
      p_track_url: TRACK,
    });
  });

  it("becomes a slot the player can start with no Archive lookup", () => {
    const s = knownGoodToSlot({ songId: SONG, songTitle: "Althea", showDate: "1977-05-08", archiveUrl: null, trackUrl: TRACK });
    expect(s.directTrackUrl).toBe(TRACK);
    expect(s.song).toEqual({ id: SONG, title: "Althea" });
    expect(s.version?.show_date).toBe("1977-05-08");
    // Without a recording url the player would RESOLVE the night and could
    // swap the known track for a guess. Derived from the track itself.
    expect(s.version?.archive_org_url).toBe("https://archive.org/details/gd1979-08-04.sbd");
  });
});

describe("signed out at the moment it broke", () => {
  it("remembers the issue and attaches it after sign-in, once", async () => {
    rememberPendingFollow("issue-1");
    rememberPendingFollow("issue-1");
    rememberPendingFollow("issue-2");
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await claimPendingFollows()).toBe(2);
    expect(rpc.mock.calls.map((c) => c[1])).toEqual([{ p_issue_id: "issue-1" }, { p_issue_id: "issue-2" }]);
    expect(await claimPendingFollows()).toBe(0);
  });
});

describe("Build Notes credits", () => {
  it("drops a row with nobody to credit", async () => {
    rpc.mockResolvedValue({
      data: [
        { issue_id: "a", song_title: "Althea", show_date: "1979-08-04", verified_at: "x", credited: ["jaguaro_fan"] },
        { issue_id: "b", song_title: "Bertha", show_date: null, verified_at: "x", credited: [null] },
      ],
      error: null,
    });
    expect((await fetchCommunityFixes()).map((f) => f.issueId)).toEqual(["a"]);
  });
});
