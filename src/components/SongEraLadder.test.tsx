import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";

/**
 * The failure this file exists to prevent: the sleeper card's button reads
 * "▶ Play the 7 sleepers" and used to do nothing but filter the ladder — a
 * ladder that sits a screen and a half below the card on a phone. Tapping a
 * button marked "play" produced no audio and no visible change, so it read as
 * broken. The button must hand its page a queue of the sleepers to play.
 */

const rows = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => rows(table) },
}));
vi.mock("@/lib/songbookDb", () => ({
  songbookDb: { from: (table: string) => rows(table) },
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => true }));

import SongEraLadder, { type LadderVersion } from "@/components/SongEraLadder";
import { ladderPlaylist } from "@/lib/ladderPlayback";

const ERAS = [
  { id: "era-75", name: "Hiatus & Return", year_start: 1975, year_end: 1977, description: "The break." },
  { id: "era-90", name: "Final Run", year_start: 1990, year_end: 1995, description: "The last lap." },
];

/** Crazy Fingers as it actually sits in the table: leader 92, cutoff 27.6. */
const version = (id: string, date: string, votes: number, era: string): LadderVersion => ({
  id,
  show_date: date,
  venue: "Tower Theatre",
  city: "Upper Darby, PA",
  era_id: era,
  votes,
  vote_source: "headyversion",
  source_url: "https://headyversion.com/song/crazy-fingers/",
  blurb: null,
  is_benchmark: false,
  archive_org_url: `https://archive.org/details/${id}`,
});

const VERSIONS = [
  version("gd1976-06-09", "1976-06-09", 92, "era-75"), // leader
  version("gd1976-06-14", "1976-06-14", 76, "era-75"),
  version("gd1976-06-22", "1976-06-22", 24, "era-75"), // sleeper
  version("gd1990-09-15", "1990-09-15", 20, "era-90"), // sleeper
  version("gd1976-06-18", "1976-06-18", 17, "era-75"), // sleeper
];

/** Stub of the two chained SELECTs the ladder issues on mount. */
const chain = (data: unknown[]) => {
  const thenable = Promise.resolve({ data, error: null });
  const api: Record<string, unknown> = {
    select: () => api,
    eq: () => api,
    order: () => thenable,
    then: thenable.then.bind(thenable),
  };
  return api;
};

beforeEach(() => {
  rows.mockReset();
  rows.mockImplementation((table: string) =>
    chain(table === "eras" ? ERAS : VERSIONS),
  );
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(cleanup);

describe("SongEraLadder — the sleeper card", () => {
  it("hands the page every sleeper to play when the play button is tapped", async () => {
    const onPlaySleepers = vi.fn();
    render(<SongEraLadder songId="song-1" songTitle="Crazy Fingers" onPlaySleepers={onPlaySleepers} />);

    const button = await screen.findByRole("button", { name: /play the 3 .*sleepers/i });
    fireEvent.click(button);

    expect(onPlaySleepers).toHaveBeenCalledTimes(1);
    const played = onPlaySleepers.mock.calls[0][0] as LadderVersion[];
    expect(played.map((v) => v.id).sort()).toEqual(
      ["gd1976-06-18", "gd1976-06-22", "gd1990-09-15"],
    );
  });

  it("still filters the ladder to the sleepers it started playing", async () => {
    render(<SongEraLadder songId="song-1" songTitle="Crazy Fingers" onPlaySleepers={vi.fn()} />);

    await screen.findByText("June 9, 1976"); // the leader, before filtering
    fireEvent.click(screen.getByRole("button", { name: /play the 3 .*sleepers/i }));

    await waitFor(() => expect(screen.queryByText("June 9, 1976")).not.toBeInTheDocument());
    expect(screen.getByText("June 22, 1976")).toBeInTheDocument();
  });

  it("marks the version sounding right now, so a running queue shows its place", async () => {
    const { rerender } = render(
      <SongEraLadder songId="song-1" songTitle="Crazy Fingers" playingVersionId={null} />,
    );
    await screen.findByText("June 22, 1976");
    expect(screen.queryByText(/▶ Playing/)).not.toBeInTheDocument();

    rerender(
      <SongEraLadder songId="song-1" songTitle="Crazy Fingers" playingVersionId="gd1976-06-22" />,
    );
    await waitFor(() => expect(screen.getByText(/▶ Playing/)).toBeInTheDocument());
  });

  it("does not throw when no page is listening for the sleepers", async () => {
    render(<SongEraLadder songId="song-1" songTitle="Crazy Fingers" />);
    const button = await screen.findByRole("button", { name: /play the 3 .*sleepers/i });
    fireEvent.click(button);
    expect(button).toBeInTheDocument();
  });
});

describe("ladderPlaylist", () => {
  const song = { id: "song-1", title: "Crazy Fingers" };

  it("queues the sleepers oldest first, so the song walks forward in time", () => {
    const slots = ladderPlaylist(song, [
      version("gd1990-09-15", "1990-09-15", 20, "era-90"),
      version("gd1976-06-22", "1976-06-22", 24, "era-75"),
      version("gd1976-06-18", "1976-06-18", 17, "era-75"),
    ]);
    expect(slots.map((s) => s.version?.show_date)).toEqual([
      "1976-06-18",
      "1976-06-22",
      "1990-09-15",
    ]);
    // position is what the player sorts the queue by — it has to follow.
    expect(slots.map((s) => s.position)).toEqual([0, 1, 2]);
  });

  it("drops versions with no recording behind them rather than queueing a dead slot", () => {
    const noTape = { ...version("gd1980-x", "1980-05-01", 12, "era-75"), archive_org_url: null };
    const slots = ladderPlaylist(song, [noTape, version("gd1976-06-22", "1976-06-22", 24, "era-75")]);
    expect(slots).toHaveLength(1);
    expect(slots[0].version?.archive_org_url).toContain("gd1976-06-22");
  });

  it("carries the columns the player and the now-playing bar read", () => {
    const [slot] = ladderPlaylist(song, [version("gd1976-06-22", "1976-06-22", 24, "era-75")]);
    expect(slot.song).toEqual({ id: "song-1", title: "Crazy Fingers" });
    expect(slot.version?.venue).toBe("Tower Theatre");
    expect(slot.version?.song_id).toBe("song-1");
    expect(slot.version?.show_date).toBe("1976-06-22");
    expect(slot.setNumber).toBe(1);
    expect(slot.segueToNext).toBe(false);
  });
});
