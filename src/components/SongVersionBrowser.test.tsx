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

/**
 * The quiet-gem signal is the ranking for the 232 songs no poll covers, so it
 * has to actually reach the screen. A banked correction from an earlier gate:
 * "defined but never called" is its own finding — a pure module with passing
 * unit tests proves the arithmetic, not the wiring. These tests render.
 */
const rated = (
  identifier: string,
  date: string,
  rating: number,
  reviews: number,
  downloads: number,
) => ({
  identifier,
  url: `https://archive.org/details/${identifier}`,
  date,
  venue: "Winterland",
  avgRating: rating,
  reviews,
  downloads,
});

/** One famous tape, one equally-loved tape nobody pulls, two also-rans. */
const COHORT = [
  rated("gd-famous", "1977-05-08", 4.8, 40, 90_000),
  rated("gd-quiet", "1973-11-10", 4.9, 22, 1_200),
  rated("gd-middling", "1980-09-02", 4.2, 12, 20_000),
  rated("gd-rough", "1985-06-14", 3.4, 8, 6_000),
];

describe("SongVersionBrowser — quiet gems", () => {
  it("marks the loved tape nobody pulls, and says how it decided", async () => {
    findManyArchiveRecordings.mockResolvedValue(COHORT);

    renderBrowser();

    expect(await screen.findByText("Quiet gem")).toBeInTheDocument();
    expect(
      screen.getByText(/4\.9 across 22 reviews, and pulled less than the other tapes here/),
    ).toBeInTheDocument();
    expect(screen.getByText(/the ones held highest and pulled least/)).toBeInTheDocument();
  });

  it("marks only the quiet one — a chip on every card says nothing", async () => {
    findManyArchiveRecordings.mockResolvedValue(COHORT);

    renderBrowser();

    await screen.findByText("Quiet gem");
    expect(screen.getAllByText("Quiet gem")).toHaveLength(1);
  });

  it("stays silent when the tapes carry no ratings to compare", async () => {
    findManyArchiveRecordings.mockResolvedValue(
      COHORT.map((v) => ({ ...v, avgRating: null, reviews: 0 })),
    );

    renderBrowser();

    await waitFor(() => expect(findManyArchiveRecordings).toHaveBeenCalled());
    expect(screen.queryByText("Quiet gem")).not.toBeInTheDocument();
    expect(screen.queryByText(/the ones held highest and pulled least/)).not.toBeInTheDocument();
  });

  it("stays silent when too few tapes circulate to rank anything", async () => {
    findManyArchiveRecordings.mockResolvedValue(COHORT.slice(0, 2));

    renderBrowser();

    await waitFor(() => expect(findManyArchiveRecordings).toHaveBeenCalled());
    expect(screen.queryByText("Quiet gem")).not.toBeInTheDocument();
  });
});

describe("SongVersionBrowser — one row per night", () => {
  /**
   * Cornell 1977-05-08 circulates as several transfers. Scored as separate
   * tapes, the quieter transfers look overlooked beside the 1.46M-download one
   * and the signal calls the most famous tape in the catalog a hidden gem.
   * Found by running the real Archive data through it.
   */
  const CORNELL = [
    rated("gd77-05-08.famous", "1977-05-08", 4.78, 300, 1_460_546),
    rated("gd77-05-08.transfer2", "1977-05-08", 4.93, 29, 143_936),
    rated("gd77-05-08.transfer3", "1977-05-08", 4.91, 35, 137_657),
    rated("gd73-06-10", "1973-06-10", 4.62, 217, 1_280_004),
    rated("gd72-05-03", "1972-05-03", 4.94, 36, 126_858),
    rated("gd72-09-21", "1972-09-21", 4.87, 66, 112_605),
  ];

  it("does not call Cornell a quiet gem because a second transfer is quieter", async () => {
    findManyArchiveRecordings.mockResolvedValue(CORNELL);

    renderBrowser();

    await waitFor(() => expect(findManyArchiveRecordings).toHaveBeenCalled());
    // Whatever it marks, no 1977-05-08 card may carry the chip.
    const chips = screen.queryAllByText("Quiet gem");
    for (const chip of chips) {
      expect(chip.closest("button")?.textContent).not.toContain("1977-05-08");
    }
  });

  it("never marks more than a few, or the mark means nothing", async () => {
    findManyArchiveRecordings.mockResolvedValue(CORNELL);

    renderBrowser();

    await waitFor(() => expect(findManyArchiveRecordings).toHaveBeenCalled());
    expect(screen.queryAllByText("Quiet gem").length).toBeLessThanOrEqual(3);
  });
});
