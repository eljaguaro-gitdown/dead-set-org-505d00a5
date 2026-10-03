import { describe, it, expect } from "vitest";
import { buildGuideSongs, guideNotes, type GuideVersion } from "@/lib/listeningGuide";
import { decodeArchiveNotes } from "@/hooks/useSetlist";
import { buildMilestones, NO_TAPE_LINE } from "@/lib/firstLastPlayed";

/**
 * The failure this file exists to prevent, observed in production on
 * 2026-10-03: "Ramble On Rose — Listening Guide" saved six slots, none of them
 * carrying a version or an archive blob. Its first card's prose described the
 * 1971 debut while the player played a 1989 Charlotte tape, because an unbound
 * slot falls back to whatever recording the song resolves to by default.
 *
 * Every assertion here is a round trip: what the guide writes must decode back
 * to the same night it is talking about.
 */

const song = { title: "Ramble On Rose", first_played: "1971-10-19", last_played: "1995-07-09" };

const v = (showDate: string, over: Partial<GuideVersion> = {}): GuideVersion => ({
  showDate,
  venue: "Winterland Arena",
  archiveUrl: `https://archive.org/details/gd${showDate}`,
  rating: 4,
  whyThisVersion: "Jerry leans into it.",
  ...over,
});

const decodeSlot = (notes: string) => decodeArchiveNotes("slot-1", "song-1", notes);

describe("buildGuideSongs — every slot binds its own tape", () => {
  const versions = [v("1972-05-04"), v("1977-05-08")];

  it("round-trips each slot back to the night its prose describes", () => {
    const songs = buildGuideSongs("song-1", song.title, versions, []);
    expect(songs).toHaveLength(2);
    songs.forEach((s, i) => {
      const decoded = decodeSlot(s.notes);
      expect(decoded.version?.show_date).toBe(versions[i].showDate);
      expect(decoded.version?.archive_org_url).toBe(versions[i].archiveUrl);
      // The prose survives underneath the blob, and names the same night.
      expect(decoded.notes).toContain(versions[i].showDate);
    });
  });

  it("numbers positions from 1, in reading order", () => {
    const songs = buildGuideSongs("song-1", song.title, versions, []);
    expect(songs.map((s) => s.position)).toEqual([1, 2]);
  });

  it("leaves prose unbound rather than inventing a tape when there is none", () => {
    const songs = buildGuideSongs("song-1", song.title, [v("1972-05-04", { archiveUrl: null })], []);
    expect(decodeSlot(songs[0].notes).version).toBeNull();
    expect(songs[0].notes).toContain("1972-05-04");
  });
});

describe("buildGuideSongs — first and last played", () => {
  const versions = [v("1972-05-04"), v("1977-05-08")];

  it("opens with the debut and closes with the farewell", () => {
    const milestones = buildMilestones(
      song,
      versions,
      new Map([
        ["1971-10-19", { url: "https://archive.org/details/gd71-10-19", venue: "Auditorium Theatre" }],
        ["1995-07-09", { url: "https://archive.org/details/gd95-07-09", venue: "Soldier Field" }],
      ]),
    );
    const songs = buildGuideSongs("song-1", song.title, versions, milestones);

    expect(songs).toHaveLength(4);
    expect(songs[0].notes).toContain("First time played");
    expect(songs[0].notes).toContain("1971-10-19");
    expect(songs[3].notes).toContain("Last time played");
    expect(songs[3].notes).toContain("1995-07-09");
    expect(songs.map((s) => s.position)).toEqual([1, 2, 3, 4]);

    // And they are bound to their own nights, not to the song's default tape.
    expect(decodeSlot(songs[0].notes).version?.show_date).toBe("1971-10-19");
    expect(decodeSlot(songs[3].notes).version?.show_date).toBe("1995-07-09");
  });

  it("keeps a milestone with no circulating tape, and says so in the slot", () => {
    const milestones = buildMilestones(song, versions, new Map([["1971-10-19", null]]));
    const songs = buildGuideSongs("song-1", song.title, versions, milestones);

    const debut = songs[0];
    expect(debut.notes).toContain("1971-10-19");
    expect(debut.notes).toContain(NO_TAPE_LINE);
    // No tape means no binding — but the night is still in the guide.
    expect(decodeSlot(debut.notes).version).toBeNull();
  });

  it("labels a milestone Charlie already picked instead of adding a second slot", () => {
    const withDebut = [v("1971-10-19"), v("1977-05-08")];
    const milestones = buildMilestones(song, withDebut, new Map([["1995-07-09", null]]));
    const songs = buildGuideSongs("song-1", song.title, withDebut, milestones);

    // Two picks + the LTP night = three slots, not four.
    expect(songs).toHaveLength(3);
    expect(songs[0].notes).toContain("First time played");
    expect(songs[0].notes).toContain("1971-10-19");
    expect(songs.filter((s) => s.notes.includes("1971-10-19"))).toHaveLength(1);
    expect(decodeSlot(songs[0].notes).version?.show_date).toBe("1971-10-19");
  });
});

describe("guideNotes", () => {
  it("puts the blob first so decodeArchiveNotes finds it", () => {
    const notes = guideNotes("1971-10-19", "Auditorium Theatre", "https://archive.org/details/x", 5, "prose");
    expect(notes.startsWith('{"__archive":true')).toBe(true);
    expect(decodeSlot(notes).notes).toBe("prose");
    expect(decodeSlot(notes).version?.venue).toBe("Auditorium Theatre");
  });
});
