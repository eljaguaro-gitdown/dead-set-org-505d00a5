import { describe, it, expect } from "vitest";
import {
  buildMilestones,
  findMilestoneInList,
  milestoneNote,
  milestonePlace,
  MILESTONE_LABEL,
  NO_TAPE_LINE,
  saysNoTape,
  type MilestoneCandidate,
  type MilestoneTape,
} from "@/lib/firstLastPlayed";

/**
 * The guide that prompted this: "Ramble On Rose — Listening Guide" opened with
 * prose calling the debut 1971-10-21 while the catalog says 1971-10-19. The
 * dates here are read, never written, so the two can't drift apart again.
 */
const rambleOnRose = {
  title: "Ramble On Rose",
  first_played: "1971-10-19",
  last_played: "1995-07-09",
};

const version = (showDate: string, over: Partial<MilestoneCandidate> = {}): MilestoneCandidate => ({
  showDate,
  venue: "Winterland Arena",
  city: "San Francisco, CA",
  archiveUrl: `https://archive.org/details/gd${showDate}`,
  ...over,
});

const tape = (url: string, venue: string | null = null): MilestoneTape => ({ url, venue });

describe("buildMilestones", () => {
  it("returns both milestones, first played first and last played last", () => {
    const out = buildMilestones(rambleOnRose, [], new Map());
    expect(out.map((m) => m.kind)).toEqual(["ftp", "ltp"]);
    expect(out[0].date).toBe("1971-10-19");
    expect(out[1].date).toBe("1995-07-09");
  });

  it("labels a night Charlie already picked instead of repeating it", () => {
    const versions = [version("1972-05-04"), version("1971-10-19"), version("1977-05-08")];
    const out = buildMilestones(rambleOnRose, versions, new Map());
    const ftp = out.find((m) => m.kind === "ftp")!;
    expect(ftp.source).toBe("list");
    expect(ftp.listIndex).toBe(1);
    // It is a label on an existing card, so it must not also stand alone.
    expect(out.filter((m) => m.listIndex === null).map((m) => m.kind)).toEqual(["ltp"]);
  });

  it("matches a list entry whose date carries an archive timestamp", () => {
    const out = buildMilestones(rambleOnRose, [version("1971-10-19T00:00:00Z")], new Map());
    expect(out.find((m) => m.kind === "ftp")!.source).toBe("list");
  });

  it("uses a circulating tape when the night is not in the list", () => {
    const tapes = new Map([["1971-10-19", tape("https://archive.org/details/gd71-10-19", "Auditorium Theatre")]]);
    const ftp = buildMilestones(rambleOnRose, [], tapes).find((m) => m.kind === "ftp")!;
    expect(ftp.source).toBe("archive");
    expect(ftp.tapeFound).toBe(true);
    expect(ftp.archiveUrl).toBe("https://archive.org/details/gd71-10-19");
    expect(ftp.venue).toBe("Auditorium Theatre");
  });

  it("KEEPS the milestone when no tape circulates, and says so", () => {
    // The point of the feature: a night nobody taped is still a night, and the
    // date is still worth printing. Dropping it is the failure mode.
    const ftp = buildMilestones(rambleOnRose, [], new Map([["1971-10-19", null]])).find(
      (m) => m.kind === "ftp",
    )!;
    expect(ftp.date).toBe("1971-10-19");
    expect(ftp.tapeFound).toBe(false);
    expect(ftp.archiveUrl).toBeNull();
    expect(ftp.source).toBe("none");
    expect(milestoneNote(ftp)).toContain(NO_TAPE_LINE);
    expect(milestoneNote(ftp)).toContain("1971-10-19");
  });

  it("treats a date the lookup never ran for the same as a miss", () => {
    const ftp = buildMilestones(rambleOnRose, [], new Map()).find((m) => m.kind === "ftp")!;
    expect(ftp.tapeFound).toBe(false);
    expect(ftp.date).toBe("1971-10-19");
  });

  it("says a one-off night once rather than twice under two labels", () => {
    const oneOff = { title: "The Mighty Quinn", first_played: "1985-03-13", last_played: "1985-03-13" };
    const out = buildMilestones(oneOff, [], new Map());
    expect(out.map((m) => m.kind)).toEqual(["ftp"]);
  });

  it("omits a milestone the catalog has no date for", () => {
    const partial = { title: "Untracked", first_played: null, last_played: "1995-07-09" };
    expect(buildMilestones(partial, [], new Map()).map((m) => m.kind)).toEqual(["ltp"]);
    const none = { title: "Untracked", first_played: null, last_played: null };
    expect(buildMilestones(none, [], new Map())).toEqual([]);
  });
});

describe("findMilestoneInList", () => {
  it("is null for a date nobody picked, and for no date at all", () => {
    expect(findMilestoneInList("1971-10-19", [version("1972-05-04")])).toBeNull();
    expect(findMilestoneInList(null, [version("1971-10-19")])).toBeNull();
  });
});

describe("milestone prose", () => {
  it("names the milestone and the place when there is one", () => {
    const m = buildMilestones(rambleOnRose, [version("1971-10-19")], new Map()).find(
      (x) => x.kind === "ftp",
    )!;
    expect(milestonePlace(m)).toBe("Winterland Arena · San Francisco, CA");
    expect(milestoneNote(m)).toContain(MILESTONE_LABEL.ftp);
    expect(milestoneNote(m)).not.toContain(NO_TAPE_LINE);
  });

  it("leaves the place line out rather than printing 'Unknown venue'", () => {
    const m = buildMilestones(rambleOnRose, [], new Map()).find((x) => x.kind === "ftp")!;
    expect(milestonePlace(m)).toBeNull();
    expect(milestoneNote(m)).not.toMatch(/unknown/i);
  });
});

describe("a lookup that failed", () => {
  // The gate on 2026-10-03 caught a 503 from archive.org printing "No tape of
  // this night circulates". A failed request is not a miss: keep the date,
  // claim nothing about the tape.
  it("keeps the date and does not say no tape circulates", () => {
    const out = buildMilestones(rambleOnRose, [], new Map([["1995-07-09", null]]), new Set(["1995-07-09"]));
    const ltp = out.find((m) => m.kind === "ltp")!;
    expect(ltp.date).toBe("1995-07-09");
    expect(ltp.source).toBe("unchecked");
    expect(ltp.tapeFound).toBe(false);
    expect(saysNoTape(ltp)).toBe(false);
    expect(milestoneNote(ltp)).not.toContain(NO_TAPE_LINE);
    expect(milestoneNote(ltp)).toContain("1995-07-09");
  });

  it("only marks the dates that failed", () => {
    const out = buildMilestones(
      rambleOnRose,
      [],
      new Map([["1971-10-19", null], ["1995-07-09", null]]),
      new Set(["1995-07-09"]),
    );
    const ftp = out.find((m) => m.kind === "ftp")!;
    expect(ftp.source).toBe("none");
    expect(saysNoTape(ftp)).toBe(true);
    expect(milestoneNote(ftp)).toContain(NO_TAPE_LINE);
  });

  it("never overrides a tape that was found", () => {
    const tape: MilestoneTape = { url: "https://archive.org/details/gd95-07-09", venue: "Soldier Field" };
    const ltp = buildMilestones(rambleOnRose, [], new Map([["1995-07-09", tape]]), new Set(["1995-07-09"])).find(
      (m) => m.kind === "ltp",
    )!;
    expect(ltp.tapeFound).toBe(true);
    expect(ltp.source).toBe("archive");
  });
});

/**
 * The track url has to survive the trip.
 *
 * findRecordingForDate locates the exact playable file inside a recording, but
 * buildMilestones copied only the recording's address and dropped the track,
 * and the picker's play paths then took only `.url` as well. So the player was
 * handed a details page, had to re-fetch the very metadata that had already
 * been read, and could only make a sound after a second round trip — which on
 * a phone is seconds of nothing after the tap, and another chance to fail.
 *
 * Reported from a phone on 2026-10-05: Bertha's debut, the player bar showing
 * the right song and the right night, sitting at 0:00 / 0:00.
 */
describe("a resolved tape keeps its track url", () => {
  const song = { title: "Bertha", first_played: "1971-02-18", last_played: "1995-07-09" };

  it("carries directTrackUrl from the lookup onto the milestone", () => {
    const milestones = buildMilestones(
      song,
      [],
      new Map([
        ["1971-02-18", {
          url: "https://archive.org/details/gd71-02-18.sbd.orf.107.sbeok.shnf",
          venue: "Capitol Theatre",
          directTrackUrl: "https://archive.org/download/gd71-02-18.sbd.orf.107.sbeok.shnf/gd-1971-02-18-d1-t01.wav.mp3",
        }],
      ]),
    );
    const debut = milestones.find((m) => m.kind === "ftp");
    expect(debut?.archiveUrl).toContain("gd71-02-18");
    // The whole point: not null.
    expect(debut?.directTrackUrl).toContain("d1-t01.wav.mp3");
  });

  it("is null, not undefined, when the lookup found only the night", () => {
    const milestones = buildMilestones(
      song,
      [],
      new Map([["1971-02-18", { url: "https://archive.org/details/x", venue: "Capitol Theatre" }]]),
    );
    expect(milestones.find((m) => m.kind === "ftp")?.directTrackUrl).toBeNull();
  });

  it("is null for a night with no tape at all", () => {
    const milestones = buildMilestones(song, [], new Map([["1971-02-18", null]]));
    expect(milestones.find((m) => m.kind === "ftp")?.directTrackUrl).toBeNull();
  });
});
