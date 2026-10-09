/**
 * The Songbook card on the home page.
 *
 * What it promises has to be what it does: the night the stub names is the
 * night handed to the player, the count in the footer is the one the issue
 * shows, and a night the Archive says has no tape is never offered on the
 * front page.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { SongbookSpotlight, LifespanEnd } from "@/lib/songbookSpotlight";

const mocks = vi.hoisted(() => ({
  playSingle: vi.fn(async (_slot: unknown) => {}),
  stopPlayback: vi.fn(),
  playingSlot: null as { id: string } | null,
  findRecordingForDate: vi.fn(),
}));

vi.mock("@/contexts/AudioPlayerContext", () => ({
  useAudioPlayer: () => ({
    playSingle: mocks.playSingle,
    stopPlayback: mocks.stopPlayback,
    playingSlot: mocks.playingSlot,
  }),
}));
vi.mock("@/lib/archiveOrg", () => ({
  findRecordingForDate: (title: string, date: string) => mocks.findRecordingForDate(title, date),
}));
vi.mock("@/lib/trackCtaClick", () => ({ trackCtaClick: vi.fn() }));
vi.mock("@/lib/posthog", () => ({ captureEvent: vi.fn() }));

import SongbookSpotlightCard from "@/components/landing/SongbookSpotlightCard";

const end = (over: Partial<LifespanEnd> & Pick<LifespanEnd, "which">): LifespanEnd => ({
  date: null,
  label: null,
  year: null,
  venue: null,
  city: null,
  archiveUrl: null,
  versionId: null,
  note: null,
  ...over,
});

const CF_TAPE = "https://archive.org/details/gd1975-06-17.sbd.GEMS.96125.flac16";

const crazyFingers = (over: Partial<SongbookSpotlight> = {}): SongbookSpotlight => ({
  kind: "issue",
  slug: "crazy-fingers",
  title: "Crazy Fingers",
  songId: "song-cf",
  issueNumber: 2,
  headline: "They put it down for 417 shows. It came back a different song.",
  timesPlayed: 145,
  first: end({
    which: "first", date: "1975-06-17", label: "June 17, 1975", year: "1975",
    venue: "Winterland Arena", archiveUrl: CF_TAPE, versionId: "cf-0",
  }),
  last: end({
    which: "last", date: "1995-07-05", label: "July 5, 1995", year: "1995",
    venue: "Riverport Amphitheatre", note: "three shows before the band's last night",
  }),
  finding: { kind: "sleepers", count: 7 },
  ...over,
});

/** Shakedown: neither end has a tape on file, so the card asks the Archive first. */
const shakedown = (): SongbookSpotlight => ({
  kind: "issue",
  slug: "shakedown-street",
  title: "Shakedown Street",
  songId: "song-ss",
  issueNumber: 1,
  headline: "One night is a moment. Seventeen years is a life.",
  timesPlayed: 163,
  first: end({ which: "first", date: "1978-08-31", label: "Aug 31, 1978", year: "1978", venue: "Red Rocks Amphitheatre" }),
  last: end({
    which: "last", date: "1995-07-09", label: "July 9, 1995", year: "1995",
    venue: "Soldier Field", note: "the last night the Grateful Dead ever played",
  }),
  finding: { kind: "sleepers", count: 9 },
});

const althea = (nights = 6): SongbookSpotlight => ({
  kind: "community",
  slug: "althea",
  title: "Althea",
  songId: "song-al",
  issueNumber: null,
  headline: null,
  timesPlayed: 269,
  first: end({ which: "first", date: "1979-08-04", label: "August 4, 1979", year: "1979" }),
  last: end({ which: "last", date: "1995-07-08", label: "July 8, 1995", year: "1995" }),
  finding: nights > 0 ? { kind: "nights", count: nights } : null,
});

const renderCard = (s: SongbookSpotlight) =>
  render(
    <MemoryRouter>
      <SongbookSpotlightCard key={s.slug} spotlight={s} />
    </MemoryRouter>,
  );

const stub = () => screen.getByRole("button", { name: /^(Play|Stop) / });
const kicker = () => stub().querySelector(".sb-cue__kicker")?.textContent;
const nightLine = () => stub().querySelector(".sb-cue__night")?.textContent;
const lastSlot = () => mocks.playSingle.mock.calls.at(-1)?.[0] as {
  id: string;
  version: { show_date: string; archive_org_url: string | null; id: string };
  directTrackUrl: string | null;
};
const norm = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

beforeEach(() => {
  mocks.playSingle.mockClear();
  mocks.stopPlayback.mockClear();
  mocks.findRecordingForDate.mockReset();
  mocks.playingSlot = null;
});

describe("SongbookSpotlightCard — what it says", () => {
  it("reads as the issue, compressed: headline, lifespan, one night, what's inside", () => {
    renderCard(crazyFingers());
    expect(screen.getByRole("heading", { name: "Crazy Fingers" })).toBeInTheDocument();
    expect(screen.getByText("They put it down for 417 shows. It came back a different song.")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "First played June 17, 1975, played 145 times, last played July 5, 1995" }))
      .toBeInTheDocument();
    expect(norm(kicker())).toBe("Hear the first one");
    expect(norm(nightLine())).toBe("June 17, 1975 · Winterland Arena");

    const read = screen.getByRole("link");
    expect(read).toHaveAttribute("href", "/songbook/crazy-fingers");
    expect(norm(read.textContent)).toBe(
      "7sleepers you probably haven't heardReal regard, almost no attention.Read Vol. 2 →",
    );
  });

  it("prints the issue's note when it offers the last night", () => {
    mocks.findRecordingForDate.mockResolvedValue({ url: "u", directTrackUrl: "t", venue: "v" });
    renderCard(crazyFingers({ first: end({ which: "first", year: "1975" }) }));
    expect(norm(kicker())).toBe("Hear the last one");
    expect(stub()).toHaveTextContent("three shows before the band's last night");
  });

  it("names nobody on a community entry, counts its nights, and never calls it an issue or claims sleepers", () => {
    mocks.findRecordingForDate.mockResolvedValue(null);
    const { container } = renderCard(althea());
    expect(container.querySelector(".sb-spot__hook")).toBeNull();
    expect(screen.queryByText(/mapped by/i)).toBeNull();
    const read = screen.getByRole("link");
    expect(read).toHaveAttribute("href", "/songbook/althea");
    expect(norm(read.textContent)).toBe("6nights worth knowingRead the guide →");
    expect(screen.queryByText(/sleeper/i)).toBeNull();
    expect(screen.queryByText(/Vol\./)).toBeNull();
  });

  it("says one night in the singular", () => {
    mocks.findRecordingForDate.mockResolvedValue(null);
    renderCard(althea(1));
    expect(norm(screen.getByRole("link").textContent)).toBe("1night worth knowingRead the guide →");
  });

  it("claims nothing in the footer when there is nothing to count", () => {
    mocks.findRecordingForDate.mockResolvedValue(null);
    renderCard(althea(0));
    expect(norm(screen.getByRole("link").textContent)).toBe("Read the guide →");
  });
});

describe("SongbookSpotlightCard — the night it plays", () => {
  it("plays exactly the night it names, from the tape on file, without asking the Archive first", () => {
    renderCard(crazyFingers());
    fireEvent.click(stub());
    expect(mocks.findRecordingForDate).not.toHaveBeenCalled();
    expect(mocks.playSingle).toHaveBeenCalledTimes(1);
    expect(lastSlot()).toMatchObject({
      id: "hero-songbook-crazy-fingers-first",
      version: { id: "cf-0", show_date: "1975-06-17", archive_org_url: CF_TAPE },
    });
  });

  it("looks a night with no tape on file up before anyone taps, and hands the player url AND track", async () => {
    mocks.findRecordingForDate.mockResolvedValue({
      url: "https://archive.org/details/gd78-08-31",
      directTrackUrl: "https://archive.org/download/gd78-08-31/d1t07.mp3",
      venue: "Red Rocks Amphitheatre",
    });
    renderCard(shakedown());
    await waitFor(() => expect(mocks.findRecordingForDate).toHaveBeenCalledWith("Shakedown Street", "1978-08-31"));
    // Let the lookup land before tapping, as it would on a real visit.
    await act(async () => {});
    fireEvent.click(stub());
    expect(lastSlot()).toMatchObject({
      version: { show_date: "1978-08-31", archive_org_url: "https://archive.org/details/gd78-08-31" },
      directTrackUrl: "https://archive.org/download/gd78-08-31/d1t07.mp3",
    });
  });

  it("names the room from the tape it found when the guide did not, and only once it is found", async () => {
    let answer: (v: unknown) => void = () => {};
    mocks.findRecordingForDate.mockReturnValue(new Promise((r) => { answer = r; }));
    renderCard(althea());
    // Before the lookup lands, the night is all we know. No guessed venue.
    expect(norm(nightLine())).toBe("August 4, 1979");
    await act(async () => {
      answer({ url: "https://archive.org/details/gd79-08-04", directTrackUrl: "t", venue: "Oakland Auditorium Arena" });
    });
    expect(norm(nightLine())).toBe("August 4, 1979 · Oakland Auditorium Arena");
  });

  it("offers the last night instead when the Archive says the first has no tape", async () => {
    mocks.findRecordingForDate.mockImplementation(async (_t: string, date: string) =>
      date === "1978-08-31" ? null : { url: "https://archive.org/details/gd95-07-09", directTrackUrl: "t", venue: "Soldier Field" },
    );
    renderCard(shakedown());
    await waitFor(() => expect(norm(kicker())).toBe("Hear the last one"));
    expect(norm(nightLine())).toBe("July 9, 1995 · Soldier Field");
    await waitFor(() => expect(mocks.findRecordingForDate).toHaveBeenCalledWith("Shakedown Street", "1995-07-09"));
    fireEvent.click(stub());
    expect(lastSlot()).toMatchObject({ id: "hero-songbook-shakedown-street-last", version: { show_date: "1995-07-09" } });
  });

  it("treats a night found WITHOUT the song on it as no tape, not as playable", async () => {
    // The search found the night; no readable recording carried the song.
    mocks.findRecordingForDate.mockImplementation(async (_t: string, date: string) =>
      date === "1978-08-31"
        ? { url: "https://archive.org/details/partial", directTrackUrl: null, venue: "Red Rocks" }
        : { url: "https://archive.org/details/gd95-07-09", directTrackUrl: "t", venue: "Soldier Field" },
    );
    renderCard(shakedown());
    await waitFor(() => expect(norm(kicker())).toBe("Hear the last one"));
  });

  it("offers no night at all when neither end is on tape, and keeps the way into the issue", async () => {
    mocks.findRecordingForDate.mockResolvedValue(null);
    renderCard(shakedown());
    await waitFor(() => expect(screen.queryByRole("button")).toBeNull());
    expect(mocks.findRecordingForDate).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/songbook/shakedown-street");
  });

  it("keeps the offer when the Archive could not be ASKED — a failed lookup is not an answer", async () => {
    mocks.findRecordingForDate.mockRejectedValue(new Error("archive.org search 503"));
    renderCard(shakedown());
    await waitFor(() => expect(mocks.findRecordingForDate).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(norm(kicker())).toBe("Hear the first one");
    expect(mocks.findRecordingForDate).toHaveBeenCalledTimes(1);
    // The tap hands over the night alone, so the player asks again and says
    // which failure it was if it fails twice.
    fireEvent.click(stub());
    expect(lastSlot()).toMatchObject({
      version: { show_date: "1978-08-31", archive_org_url: null },
      directTrackUrl: null,
    });
  });

  it("stops rather than restarts when its own night is already spinning", () => {
    mocks.playingSlot = { id: "hero-songbook-crazy-fingers-first" };
    renderCard(crazyFingers());
    expect(stub()).toHaveAccessibleName("Stop Crazy Fingers");
    expect(norm(kicker())).toBe("Now spinning");
    fireEvent.click(stub());
    expect(mocks.stopPlayback).toHaveBeenCalledTimes(1);
    expect(mocks.playSingle).not.toHaveBeenCalled();
  });

  it("does not read another song's playback as its own", () => {
    mocks.playingSlot = { id: "hero-songbook-shakedown-street-first" };
    renderCard(crazyFingers());
    expect(norm(kicker())).toBe("Hear the first one");
    fireEvent.click(stub());
    expect(mocks.stopPlayback).not.toHaveBeenCalled();
    expect(mocks.playSingle).toHaveBeenCalledTimes(1);
  });
});
