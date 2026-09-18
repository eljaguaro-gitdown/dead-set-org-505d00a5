import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

/**
 * The failure this file exists to prevent: the notes request used to slice the
 * *global* top 10 by rating. Narrow to 1974–76 and the described versions might
 * not include a single version in range, so the feature rendered with no liner
 * notes and looked broken rather than empty.
 */

const findManyArchiveRecordings = vi.fn();
const invoke = vi.fn();
let mockUser: { id: string } | null = { id: "user-1" };

vi.mock("@/lib/archiveOrg", () => ({
  findManyArchiveRecordings: (...args: unknown[]) => findManyArchiveRecordings(...args),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: mockUser, loading: false, signOut: vi.fn() }),
}));

vi.mock("@/lib/shareSong", () => ({ shareSong: vi.fn() }));

import SongVersionBrowser from "@/components/SongVersionBrowser";

const song = { id: "song-1", title: "Crazy Fingers" } as never;

const ERAS = [
  { id: "era-74", name: "Wall of Sound", year_start: 1974, year_end: 1976 },
] as never[];

const version = (identifier: string, date: string, rating: number) => ({
  identifier,
  url: `https://archive.org/details/${identifier}`,
  date,
  venue: "Winterland",
  avgRating: rating,
});

/** Versions the stub returns for a given window — mirrors a real windowed query. */
const IN_WINDOW = [
  version("gd1975-a", "1975-06-17", 4.2),
  version("gd1974-b", "1974-06-18", 4.0),
];
const ALL_YEARS_TOP = [
  version("gd1989-a", "1989-07-07", 5.0),
  version("gd1990-b", "1990-03-29", 4.9),
];

beforeEach(() => {
  mockUser = { id: "user-1" };
  findManyArchiveRecordings.mockReset();
  invoke.mockReset();
  invoke.mockResolvedValue({ data: { descriptions: {} }, error: null });
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(cleanup);

const renderBrowser = (props: Record<string, unknown> = {}) =>
  render(
    <SongVersionBrowser
      song={song}
      curatedVersions={[]}
      onSelectSong={vi.fn()}
      {...props}
    />,
  );

describe("SongVersionBrowser — dig deep by year", () => {
  it("asks for notes about the versions in the window, not the global top", async () => {
    // Seeded from the era, so the very first fetch is windowed.
    findManyArchiveRecordings.mockResolvedValue(IN_WINDOW);

    renderBrowser({ eras: ERAS, eraId: "era-74" });

    await waitFor(() => expect(invoke).toHaveBeenCalled());

    const [fnName, options] = invoke.mock.calls[0];
    expect(fnName).toBe("describe-versions");

    const sent = (options.body.versions as { identifier: string }[]).map((v) => v.identifier);
    expect(sent).toEqual(["gd1975-a", "gd1974-b"]);
    // The out-of-window crowd-pleasers must not be what we describe.
    expect(sent).not.toContain("gd1989-a");
  });

  it("passes the seeded era window down to the archive query", async () => {
    findManyArchiveRecordings.mockResolvedValue(IN_WINDOW);

    renderBrowser({ eras: ERAS, eraId: "era-74" });

    await waitFor(() => expect(findManyArchiveRecordings).toHaveBeenCalled());
    expect(findManyArchiveRecordings).toHaveBeenCalledWith("Crazy Fingers", 50, 1974, 1976);
  });

  it("queries without a window when no era is selected", async () => {
    findManyArchiveRecordings.mockResolvedValue(ALL_YEARS_TOP);

    renderBrowser();

    await waitFor(() => expect(findManyArchiveRecordings).toHaveBeenCalled());
    expect(findManyArchiveRecordings).toHaveBeenCalledWith("Crazy Fingers", 50, undefined, undefined);
  });

  it("renders the note Charlie wrote for an in-window version", async () => {
    findManyArchiveRecordings.mockResolvedValue(IN_WINDOW);
    invoke.mockResolvedValue({
      data: { descriptions: { "gd1975-a": "Twenty minutes of patient, liquid exploration." } },
      error: null,
    });

    renderBrowser({ eras: ERAS, eraId: "era-74" });

    expect(
      await screen.findByText(/Twenty minutes of patient, liquid exploration/),
    ).toBeInTheDocument();
  });

  it("excludes curated picks from the versions it asks notes about", async () => {
    findManyArchiveRecordings.mockResolvedValue(IN_WINDOW);
    const curated = [
      { id: "cur-1", show_date: "1975-06-17", venue: "Winterland", city: null, rating: 5, description: null, archive_org_url: null, era_id: null, song_id: "song-1" },
    ] as never[];

    renderBrowser({ eras: ERAS, eraId: "era-74", curatedVersions: curated });

    await waitFor(() => expect(invoke).toHaveBeenCalled());
    const sent = (invoke.mock.calls[0][1].body.versions as { identifier: string }[]).map((v) => v.identifier);
    expect(sent).toEqual(["gd1974-b"]);
  });

  it("says nothing circulates rather than showing an empty list", async () => {
    findManyArchiveRecordings.mockResolvedValue([]);

    renderBrowser({ eras: ERAS, eraId: "era-74" });

    expect(
      await screen.findByText(/Nothing from 1974–76 circulating for Crazy Fingers/),
    ).toBeInTheDocument();
  });

  it("tells Charlie which window he is judging, and names the era when there is one", async () => {
    findManyArchiveRecordings.mockResolvedValue(IN_WINDOW);

    renderBrowser({ eras: ERAS, eraId: "era-74" });

    await waitFor(() => expect(invoke).toHaveBeenCalled());
    const [, options] = invoke.mock.calls[0];
    expect(options.body.yearRange).toEqual({
      start: 1974,
      end: 1976,
      eraName: "Wall of Sound",
    });
  });

  it("sends no window when the visitor is browsing every year", async () => {
    findManyArchiveRecordings.mockResolvedValue(ALL_YEARS_TOP);

    renderBrowser();

    await waitFor(() => expect(invoke).toHaveBeenCalled());
    expect(invoke.mock.calls[0][1].body.yearRange).toBeNull();
  });

  it("does not reuse a window's notes under a different window", async () => {
    // A note written about the standout of 1974-76 would read as a lie once the
    // window is every year, so the same recording has to be asked about again.
    findManyArchiveRecordings.mockResolvedValue(IN_WINDOW);
    invoke.mockResolvedValue({
      data: { descriptions: { "gd1975-a": "Patient, unhurried, and it never lands where you expect." } },
      error: null,
    });

    const { rerender } = renderBrowser({ eras: ERAS, eraId: "era-74" });
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText(/Patient, unhurried, and it never lands where you expect/),
    ).toBeInTheDocument();

    // Toolbar moves off the era: same recordings, wider window.
    findManyArchiveRecordings.mockResolvedValue(IN_WINDOW);
    rerender(
      <SongVersionBrowser
        song={song}
        curatedVersions={[]}
        onSelectSong={vi.fn()}
        eras={ERAS}
        eraId={null}
      />,
    );

    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(2));
    const [, second] = invoke.mock.calls[1];
    expect(second.body.yearRange).toBeNull();
    expect((second.body.versions as { identifier: string }[]).map((v) => v.identifier))
      .toContain("gd1975-a");
  });

  it("never writes notes about the window the visitor just left", async () => {
    // Changing window re-queries, but `loading` has not flipped in that first
    // render — so the previous window's recordings are still in state. Asking
    // about them would file 1974-76 versions under "all years".
    findManyArchiveRecordings.mockResolvedValue(IN_WINDOW);

    const { rerender } = renderBrowser({ eras: ERAS, eraId: "era-74" });
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));

    findManyArchiveRecordings.mockResolvedValue(ALL_YEARS_TOP);
    rerender(
      <SongVersionBrowser
        song={song}
        curatedVersions={[]}
        onSelectSong={vi.fn()}
        eras={ERAS}
        eraId={null}
      />,
    );

    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(2));

    const allYearsCalls = invoke.mock.calls.filter(([, o]) => o.body.yearRange === null);
    expect(allYearsCalls.length).toBeGreaterThan(0);
    for (const [, options] of allYearsCalls) {
      const sent = (options.body.versions as { identifier: string }[]).map((v) => v.identifier);
      // Every one of these must come from the all-years query, not the era one.
      expect(sent).not.toContain("gd1975-a");
      expect(sent).not.toContain("gd1974-b");
    }
  });

  it("never fires a doomed notes request for a signed-out visitor", async () => {
    mockUser = null;
    findManyArchiveRecordings.mockResolvedValue(IN_WINDOW);

    renderBrowser({ eras: ERAS, eraId: "era-74" });

    await waitFor(() => expect(findManyArchiveRecordings).toHaveBeenCalled());
    await screen.findByText(/Cosmic Charlie will tell you what makes each of these worth the hunt/);
    expect(invoke).not.toHaveBeenCalled();
  });
});
