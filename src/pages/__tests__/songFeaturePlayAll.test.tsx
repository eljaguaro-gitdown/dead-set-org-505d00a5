import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { LadderVersion } from "@/components/SongEraLadder";

/**
 * The CURATED Songbook issue's masthead control, rendered.
 *
 * This page had no test of any kind, which is why a mutation narrowing the
 * queue it hands the button survived a full suite run: a page nothing imports
 * is invisible to vitest by construction, so the typecheck and the build were
 * the only things that could see it — and neither can see a wrong filter.
 *
 * The shape under test is Shakedown Street's real one, read off production on
 * 2026-10-06: 15 notable_versions rows, ONE with an archive_org_url. Gating on
 * the stored url offered a single night above a ladder of fifteen.
 */

const mocks = vi.hoisted(() => ({
  playSetlist: vi.fn(async (_s: unknown[]) => {}),
  playSingle: vi.fn(async () => {}),
  maybeSingle: vi.fn(),
  onVersionsLoaded: null as ((v: LadderVersion[]) => void) | null,
}));

vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useParams: () => ({ slug: "shakedown-street" }),
}));

vi.mock("@/lib/songbookDb", () => ({
  songbookDb: {
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }) }),
    }),
  },
}));

vi.mock("@/contexts/AudioPlayerContext", () => ({
  useAudioPlayer: () => ({
    playSingle: mocks.playSingle,
    playSetlist: mocks.playSetlist,
    playingSlot: null,
  }),
}));

/** Stand in for the ladder, reporting its rows up the way the real one does. */
vi.mock("@/components/SongEraLadder", () => ({
  default: ({ onVersionsLoaded }: { onVersionsLoaded?: (v: LadderVersion[]) => void }) => {
    mocks.onVersionsLoaded = onVersionsLoaded ?? null;
    return <div data-testid="ladder" />;
  },
}));

vi.mock("@/components/PageLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/SiteHeader", () => ({ default: () => null }));
vi.mock("@/components/ShareDropdown", () => ({ default: () => null }));
vi.mock("@/lib/posthog", () => ({ captureEvent: vi.fn() }));
vi.mock("sonner", () => ({ toast: { info: vi.fn(), error: vi.fn() } }));

import SongFeature from "@/pages/SongFeature";

/** Shakedown's real shape: 15 rows, 1 with a url, all dated. */
const SHAKEDOWN_ROWS: LadderVersion[] = Array.from({ length: 15 }, (_, i) =>
  ({
    id: `v${i}`,
    show_date: `19${78 + i}-08-31`,
    venue: "Red Rocks",
    city: null,
    era_id: null,
    archive_org_url: i === 0 ? "https://archive.org/details/a" : null,
    blurb: null,
    is_benchmark: false,
    source_url: null,
    vote_source: null,
    votes: null,
  }) as LadderVersion,
);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.onVersionsLoaded = null;
  mocks.maybeSingle.mockResolvedValue({
    data: {
      id: "f1",
      song_id: "song-1",
      slug: "shakedown-street",
      title: "Shakedown Street",
      week_of: "2026-10-06",
      issue_number: 2,
      published: true,
    },
  });
});

const renderPage = async () => {
  render(
    <MemoryRouter>
      <SongFeature />
    </MemoryRouter>,
  );
  await screen.findByTestId("ladder");
  await waitFor(() => expect(mocks.onVersionsLoaded).toBeTruthy());
  mocks.onVersionsLoaded!(SHAKEDOWN_ROWS);
};

const label = async () =>
  (await screen.findByRole("button", { name: /play all/i })).textContent
    ?.replace(/\s+/g, " ")
    .trim();

describe("the curated issue's masthead offers the whole ladder", () => {
  it("offers all 15 nights, not the 1 with a stored url", async () => {
    await renderPage();
    expect(await label()).toBe("Play all 15 nights");
  });

  it("queues all 15 when tapped", async () => {
    await renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /play all/i }));
    await waitFor(() => expect(mocks.playSetlist).toHaveBeenCalledTimes(1));
    expect(mocks.playSetlist.mock.calls[0][0]).toHaveLength(15);
  });

  it("the label and the queue are the same set", async () => {
    await renderPage();
    const shown = Number((await label())!.match(/\d+/)![0]);
    fireEvent.click(await screen.findByRole("button", { name: /play all/i }));
    await waitFor(() => expect(mocks.playSetlist).toHaveBeenCalled());
    expect(mocks.playSetlist.mock.calls[0][0]).toHaveLength(shown);
  });

  it("shows no control before the ladder has reported anything", async () => {
    render(
      <MemoryRouter>
        <SongFeature />
      </MemoryRouter>,
    );
    await screen.findByTestId("ladder");
    expect(screen.queryByRole("button", { name: /play all/i })).toBeNull();
  });
});
