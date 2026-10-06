import { describe, it, expect, vi, beforeEach } from "vitest";
// fireEvent, not user-event: that package is not installed, and bun.lock cannot
// be regenerated outside Lovable's registry, so adding one is a real cost.
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  stripNightPreamble,
  communityPlaylist,
  nightFromSlot,
  venueForDate,
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
  // Eyes' guide happens to include both its first and last night, so a real
  // issue carries venues here — see venueForDate.
  firstPlayedVenue: "Roscoe Maples Pavilion, Stanford U.",
  lastPlayedVenue: "Riverport Amphitheatre",
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

describe("the lifespan block earns its venues the way a curated issue has them", () => {
  /**
   * A curated issue carries ftp_venue/ftp_city as columns; `songs` stores
   * first_played/last_played as bare dates, so a community issue had a date
   * with nothing under it where Crazy Fingers shows a venue. The guide's own
   * nights are the only source: same date, same show, same venue. Across the
   * six issues it fills 7 of the 12 slots.
   */
  it("prints the venue under the date when the guide includes that night", async () => {
    renderIssue(EYES);
    expect(await screen.findByText("Roscoe Maples Pavilion, Stanford U.")).toBeInTheDocument();
    expect(await screen.findByText("Riverport Amphitheatre")).toBeInTheDocument();
  });

  it("prints the date alone when it does not — never a guessed venue", () => {
    renderIssue({ ...EYES, firstPlayedVenue: null, lastPlayedVenue: null });
    expect(screen.queryByText("Roscoe Maples Pavilion, Stanford U.")).toBeNull();
    // The date itself is still there; only the venue line is absent. getAllBy,
    // because Feb 9, 1973 is BOTH the first-played date and one of the nights
    // in the list below it — getBy throws on the second match.
    expect(screen.getAllByText("Feb 9, 1973").length).toBeGreaterThan(0);
  });
});

describe("venueForDate", () => {
  const nights = [
    { position: 1, showDate: "1973-02-09", venue: "Roscoe Maples Pavilion", archiveUrl: null, note: "" },
    { position: 2, showDate: "1995-07-06", venue: "Riverport Amphitheatre", archiveUrl: null, note: "" },
    { position: 3, showDate: "1990-03-29", venue: null, archiveUrl: null, note: "" },
  ];

  it("finds the venue of the night on that date", () => {
    expect(venueForDate(nights, "1995-07-06")).toBe("Riverport Amphitheatre");
  });

  it("returns null when no night falls on that date", () => {
    // Althea and Bird Song are both in this position — their guides do not
    // include their first or last night, so they render the date alone.
    expect(venueForDate(nights, "1979-08-04")).toBeNull();
  });

  it("returns null when the matching night has no venue", () => {
    expect(venueForDate(nights, "1990-03-29")).toBeNull();
  });

  it("is a no-op without a date", () => {
    expect(venueForDate(nights, null)).toBeNull();
  });
});

describe("the busy state survives a rejection, and a second tap cannot restart it", () => {
  /**
   * Three mutations survived the pre-release gate on these handlers: dropping
   * the `finally` that clears `cueing`, dropping the error toast, and dropping
   * the double-tap guard. The banked rule is that every player-path change
   * needs a rejection test beside its null-result test — a null means "nothing
   * there" and a throw means "could not ask", and a suite whose mocks only ever
   * resolve cannot tell you which one you broke.
   */
  it("clears the busy state when playSetlist rejects, instead of spinning forever", async () => {
    mocks.playSetlist.mockRejectedValueOnce(new Error("archive unreachable"));
    renderIssue(EYES);
    const button = await screen.findByRole("button", { name: /play all/i });
    fireEvent.click(button);
    // A rejection that skipped the reset left the control disabled under its
    // busy label with no toast — the reader's tap simply stopped the page.
    await waitFor(() => expect(button).toHaveAttribute("aria-disabled", "false"));
  });

  it("says it could not REACH the Archive — not that no tape exists", async () => {
    mocks.playSetlist.mockRejectedValueOnce(new Error("archive unreachable"));
    renderIssue(EYES);
    fireEvent.click(await screen.findByRole("button", { name: /play all/i }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    // The two must not collapse: one is an admission about the network, the
    // other an answer about the music.
    expect(String(mocks.error.mock.calls[0][0])).toMatch(/reach the Archive/i);
    expect(mocks.info).not.toHaveBeenCalled();
  });

  it("a second tap while cueing does not start a second run", async () => {
    let release: () => void = () => {};
    mocks.playSetlist.mockImplementationOnce(
      () => new Promise<void>((res) => { release = () => res(); }),
    );
    renderIssue(EYES);
    const button = await screen.findByRole("button", { name: /play all/i });
    fireEvent.click(button);
    await waitFor(() => expect(button).toHaveAttribute("aria-disabled", "true"));
    // playSetlist abandons any run whose sequence number is stale, so a second
    // tap discards the work in flight and restarts the wait.
    fireEvent.click(button);
    fireEvent.click(button);
    expect(mocks.playSetlist).toHaveBeenCalledTimes(1);
    release();
  });
});

describe("stripNightPreamble handles a bullet with no space after it", () => {
  it("keeps the first letter of the prose", () => {
    // `\s` inside a TEMPLATE literal is the letter "s", not whitespace, so the
    // pattern ended (?:•s*|$) and ate a leading "s". Real notes put a space
    // after the bullet, which .trim() hid — found by ESLint no-useless-escape.
    expect(
      stripNightPreamble("1977-05-08 Barton Hall •soaring jam", "1977-05-08"),
    ).toBe("soaring jam");
  });

  it("still collapses the usual space after the bullet", () => {
    expect(
      stripNightPreamble("1977-05-08 Barton Hall •   soaring jam", "1977-05-08"),
    ).toBe("soaring jam");
  });
});

describe("what the page shows and what Play all plays are the same, in the same order", () => {
  /**
   * Found by rendering, not by reading: the nights were listed in the author's
   * slot order while communityPlaylist sorted by date, so Eyes showed
   * Jun 15 1993 above Jun 17 1991 and would have played them the other way
   * round. A list and a queue that disagree is the same family of defect as a
   * count that disagrees with its rows.
   */
  const OUT_OF_ORDER: CommunityIssue = {
    ...EYES,
    nights: [
      night(1, "1993-06-15", null),
      night(2, "1973-02-09", "https://archive.org/details/a"),
      night(3, "1991-06-17", null),
    ],
  };

  it("lists the nights oldest first, whatever order the slots are in", async () => {
    renderIssue(OUT_OF_ORDER);
    const headings = await screen.findAllByRole("button", { name: /^Play Eyes of the World/i });
    expect(headings.map((h) => h.getAttribute("aria-label"))).toEqual([
      "Play Eyes of the World, Feb 9, 1973",
      "Play Eyes of the World, Jun 17, 1991",
      "Play Eyes of the World, Jun 15, 1993",
    ]);
  });

  it("plays them in exactly the order it listed them", async () => {
    renderIssue(OUT_OF_ORDER);
    const listed = (await screen.findAllByRole("button", { name: /^Play Eyes of the World/i }))
      // Non-greedy on the title only: /^.*, / is greedy and eats through the
      // LAST comma, which left bare years.
      .map((h) => h.getAttribute("aria-label")!.replace(/^Play [^,]+, /, ""));
    fireEvent.click(await screen.findByRole("button", { name: /play all/i }));
    await waitFor(() => expect(mocks.playSetlist).toHaveBeenCalled());
    const queued = (mocks.playSetlist.mock.calls[0][0] as { version?: { show_date?: string } }[])
      .map((s) => formatIssueDateLike(s.version?.show_date));
    expect(queued).toEqual(listed);
  });
});

/** Mirrors the card's date formatting so the two lists are comparable. */
function formatIssueDateLike(iso?: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  });
}
