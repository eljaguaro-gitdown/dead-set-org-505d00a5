import { describe, it, expect, vi, beforeEach } from "vitest";
// fireEvent, not user-event: that package is not installed, and bun.lock cannot
// be regenerated outside Lovable's registry, so adding one is a real cost.
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  stripNightPreamble,
  communityPlaylist,
  nightFromSlot,
} from "@/lib/communityIssue";
import type { CommunityIssue } from "@/lib/communityIssue";
import { decodeArchiveNotes } from "@/hooks/useSetlist";

/**
 * A community issue's nights mostly carry a DATE and no url.
 *
 * Measured on production 2026-10-06: 21 of the 33 nights across the six
 * community issues have `archive_org_url: null` in their slot blob while
 * naming their night — the Version Explorer's picks arrive that way. The
 * player resolves those through findRecordingForDate, so they are playable;
 * the page was gating on the stored url and hiding them anyway. Viola Lee
 * Blues (0 of 5 with a url) offered no play control at all, Stella Blue 1 of
 * 6, Eyes of the World 2 of 7 — under a list showing all seven.
 */

const mocks = vi.hoisted(() => ({
  playSetlist: vi.fn(async (_slots: unknown[]) => {}),
  playSingle: vi.fn(async () => {}),
  info: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/contexts/AudioPlayerContext", () => ({
  useAudioPlayer: () => ({
    playSetlist: mocks.playSetlist,
    playSingle: mocks.playSingle,
    playingSlot: null,
  }),
}));
vi.mock("sonner", () => ({ toast: { info: mocks.info, error: mocks.error } }));
vi.mock("@/components/ShareDropdown", () => ({ default: () => null }));

import CommunityIssueArticle from "@/components/CommunityIssueArticle";

/** The article links back to the guide, so it needs a router in scope. */
const renderIssue = (issue: CommunityIssue) =>
  render(
    <MemoryRouter>
      <CommunityIssueArticle issue={issue} />
    </MemoryRouter>,
  );

const night = (
  position: number,
  showDate: string | null,
  archiveUrl: string | null,
  note = "A night.",
) => ({ position, showDate, venue: "Freedom Hall", archiveUrl, note });

/** Eyes of the World's real shape: 7 nights, 2 with a stored url. */
const EYES: CommunityIssue = {
  songId: "song-1",
  title: "Eyes of the World",
  slug: "eyes-of-the-world",
  firstPlayed: "1973-02-09",
  lastPlayed: "1995-07-06",
  timesPlayed: 382,
  mappedBy: "ric neil",
  setlistId: "set-1",
  nights: [
    night(1, "1973-02-09", "https://archive.org/details/a"),
    night(2, "1978-11-24", null),
    night(3, "1990-03-29", null),
    night(4, "1991-03-17", null),
    night(5, "1993-06-15", null),
    night(6, "1991-06-17", null),
    night(7, "1995-07-06", "https://archive.org/details/b"),
  ],
};

beforeEach(() => vi.clearAllMocks());

describe("a night is playable when it can be resolved, not when it stores a url", () => {
  it("the playlist carries every dated night, not just the two with urls", () => {
    expect(communityPlaylist(EYES)).toHaveLength(7);
  });

  it("drops a night that can be neither found nor named", () => {
    const orphan = { ...EYES, nights: [...EYES.nights, night(8, null, null)] };
    expect(communityPlaylist(orphan)).toHaveLength(7);
  });

  it("the slot keeps the night so the player can look it up", () => {
    const dateless = communityPlaylist(EYES).find((s) => !s.version?.archive_org_url);
    expect(dateless).toBeDefined();
    expect(dateless!.version?.show_date).toBeTruthy();
  });

  it("the masthead offers all seven, not two", async () => {
    renderIssue(EYES);
    // A count beside a control names a population: it must be the rows the
    // reader can see, or it contradicts the page under it.
    const button = await screen.findByRole("button", { name: /play all/i });
    // Exact, not toHaveTextContent: that is a SUBSTRING match, so
    // "Play all 7 nightsX" would pass and a plural regression at 1 slips by.
    expect(button.textContent?.replace(/\s+/g, " ").trim()).toBe("Play all 7 nights");
    fireEvent.click(button);
    expect(mocks.playSetlist).toHaveBeenCalledTimes(1);
    expect(mocks.playSetlist.mock.calls[0][0]).toHaveLength(7);
  });

  it("says 'night' for a one-night guide", async () => {
    renderIssue({ ...EYES, nights: [EYES.nights[0]] });
    const button = await screen.findByRole("button", { name: /play all/i });
    expect(button.textContent?.replace(/\s+/g, " ").trim()).toBe("Play all 1 night");
  });

  it("a dated night with no url still plays on tap", async () => {
    renderIssue(EYES);
    // 1993-06-15 is one of the five with archive_org_url: null.
    fireEvent.click(await screen.findByRole("button", { name: /Jun 15, 1993/i }));
    expect(mocks.playSingle).toHaveBeenCalledTimes(1);
    // And must NOT claim no tape circulates — nobody has asked the Archive yet.
    expect(mocks.info).not.toHaveBeenCalled();
  });
});

describe("nightFromSlot — the decode-to-night step, through the real decoder", () => {
  /**
   * These two strings are copied verbatim out of production's setlist_slots
   * (Eyes of the World, positions 5 and 7, read 2026-10-06). Three fixtures
   * written by hand for this blob have been wrong before — nested where the
   * real one is flat, or carrying a `note` key the real one does not have — so
   * this one is not written, it is quoted.
   */
  const REAL_NIGHT_NO_TAPE =
    '{"__archive":true,"show_date":"1993-06-15","venue":"Freedom Hall","archive_org_url":null,"rating":8.9}\n' +
    "1993-06-15 — Freedom Hall • A late-career standout that proves the magic was still there.";

  const REAL_NIGHT_RESTATEMENT_ONLY =
    '{"__archive":true,"show_date":"1995-07-06","venue":"Riverport Amphitheatre","archive_org_url":"https://archive.org/details/gd95-07-06.NEWsbd.30888.sbeok.shnf_shn","rating":null}\n' +
    "Last time played: 1995-07-06 — Riverport Amphitheatre";

  const build = (raw: string, position = 1) =>
    nightFromSlot(position, decodeArchiveNotes("slot-1", "song-1", raw));

  it("keeps the night when the blob stores no tape", () => {
    const n = build(REAL_NIGHT_NO_TAPE);
    expect(n.showDate).toBe("1993-06-15");
    expect(n.venue).toBe("Freedom Hall");
    expect(n.archiveUrl).toBeNull();
  });

  it("STRIPS the duplicated date and venue the card prints above the note", () => {
    // The wiring assertion: calling stripNightPreamble directly proves the
    // function works, not that anything runs it.
    expect(build(REAL_NIGHT_NO_TAPE).note).toBe(
      "A late-career standout that proves the magic was still there.",
    );
  });

  it("renders no note when the note was only a restatement", () => {
    expect(build(REAL_NIGHT_RESTATEMENT_ONLY).note).toBe("");
  });

  it("reads the trailing free text, not just version.description", () => {
    // All six community issues put the note after the newline with no `note`
    // key in the blob, so reading description alone blanks every one.
    expect(build(REAL_NIGHT_NO_TAPE).note).not.toBe("");
  });
});

describe("stripNightPreamble", () => {
  it("drops a preamble that restates this night's own date", () => {
    expect(
      stripNightPreamble(
        "1993-06-15 — Freedom Hall • A late-career standout that proves the magic was still there.",
        "1993-06-15",
      ),
    ).toBe("A late-career standout that proves the magic was still there.");
  });

  it("returns empty when the note is nothing but a restatement", () => {
    expect(
      stripNightPreamble("Last time played: 1995-07-06 — Riverport Amphitheatre", "1995-07-06"),
    ).toBe("");
  });

  it("leaves a note that opens on a DIFFERENT date alone", () => {
    const note = "1991-09-10 — MSG • The night everyone compares this one to.";
    expect(stripNightPreamble(note, "1993-06-15")).toBe(note);
  });

  it("leaves prose with no date alone", () => {
    expect(stripNightPreamble("Jerry's tone is crystal clear.", "1980-05-16")).toBe(
      "Jerry's tone is crystal clear.",
    );
  });

  it("does not eat a first clause that merely mentions the date", () => {
    // Guarded on the length of what precedes the date: a label, not prose.
    const note =
      "The best one since the legendary run that ended on 1993-06-15 • and here is why.";
    expect(stripNightPreamble(note, "1993-06-15")).toBe(note);
  });

  it("is a no-op without a date to match against", () => {
    expect(stripNightPreamble("1993-06-15 — Freedom Hall • Prose.", null)).toBe(
      "1993-06-15 — Freedom Hall • Prose.",
    );
  });

  it("handles an absent note", () => {
    expect(stripNightPreamble(null, "1993-06-15")).toBe("");
  });
});
