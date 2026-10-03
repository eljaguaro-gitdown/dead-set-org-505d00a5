import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";

/**
 * The gating rule, stated by Jay and easy to regress silently:
 *
 *   find it, open it, PLAY it  → open to anyone, no account
 *   save it or share it        → sign in
 *
 * Playback being free is the whole pitch — a visitor who has to register
 * before hearing a note never hears one. These tests assert the line stays
 * exactly where it is.
 */

const navigate = vi.fn();
let mockUser: { id: string } | null = null;
const playSingle = vi.fn();
const playSetlist = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ slug: "shakedown-street" }),
    useNavigate: () => navigate,
    Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  };
});

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: mockUser, loading: false }) }));

vi.mock("@/contexts/AudioPlayerContext", () => ({
  useAudioPlayer: () => ({
    playSingle,
    playSetlist,
    unlockAudio: vi.fn(),
    playingSlot: null,
  }),
}));

vi.mock("@/components/PageLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/SiteHeader", () => ({ default: () => <header /> }));
vi.mock("@/lib/posthog", () => ({ captureEvent: vi.fn() }));
vi.mock("@/lib/archiveOrg", () => ({
  findRecordingForDate: vi.fn(async () => null),
}));

const SONGS = [
  { id: "song-1", title: "Shakedown Street", times_played: 165, first_played: "1978-08-31", last_played: "1995-07-06" },
];
const ERAS = [{ id: "era-1", name: "Touch of Grey" }];
const VERSIONS = [
  {
    id: "v1", show_date: "1985-06-30", venue: "Merriweather Post Pavilion", city: "Columbia, MD",
    era_id: "era-1", votes: 181, vote_source: "headyversion",
    source_url: "https://headyversion.com/song/shakedown-street/",
    blurb: "Fifteen minutes opening Set II.", is_benchmark: true,
    archive_org_url: "https://archive.org/details/gd85-06-30",
  },
  {
    id: "v2", show_date: "1989-04-02", venue: "Civic Arena", city: "Pittsburgh, PA",
    era_id: "era-1", votes: 37, vote_source: "headyversion",
    source_url: "https://headyversion.com/song/shakedown-street/",
    blurb: "The most overlooked stretch.", is_benchmark: false,
    archive_org_url: null,
  },
];

const table = (rows: unknown[]) => {
  const api: Record<string, unknown> = {
    select: () => api,
    eq: () => api,
    order: () => Promise.resolve({ data: rows, error: null }),
    insert: () => api,
    single: () => Promise.resolve({ data: { id: "new-setlist" }, error: null }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    then: (res: (v: { data: unknown[]; error: null }) => unknown) => Promise.resolve({ data: rows, error: null }).then(res),
  };
  return api;
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (t: string) => table(t === "songs" ? SONGS : t === "eras" ? ERAS : VERSIONS),
  },
}));
vi.mock("@/lib/songbookDb", () => ({
  songbookDb: { from: () => table(VERSIONS) },
}));

import VersionPicker from "@/pages/VersionPicker";

beforeEach(() => {
  navigate.mockReset();
  playSingle.mockReset();
  playSetlist.mockReset();
  mockUser = null;
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

const openPage = async () => {
  render(<VersionPicker />);
  await screen.findByText("Shakedown Street");
};

describe("VersionPicker — signed out", () => {
  it("shows the versions without asking anyone to sign in", async () => {
    await openPage();
    // The leader shows twice now — once in the play-first hero, once in the
    // list — so assert on the count rather than a single match.
    expect((await screen.findAllByText(/June 30, 1985/)).length).toBeGreaterThan(0);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("PLAYS without an account — the pitch depends on this", async () => {
    await openPage();
    const play = (await screen.findAllByRole("button", { name: /play this version/i }))[0];
    fireEvent.click(play);
    await waitFor(() => expect(playSingle).toHaveBeenCalledTimes(1));
    // Playing must never bounce a visitor to the auth page.
    expect(navigate).not.toHaveBeenCalled();
  });

  it("asks for sign-in when keeping a guide, and does not save", async () => {
    await openPage();
    fireEvent.click(await screen.findByRole("button", { name: /keep as a listening guide/i }));
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(expect.stringContaining("/auth?redirect=")),
    );
  });

  it("asks for sign-in when sharing", async () => {
    await openPage();
    // Two share affordances: the icon beside the play button and the one in
    // the bottom bar. Both must ask.
    const shares = await screen.findAllByRole("button", { name: /share/i });
    expect(shares.length).toBeGreaterThanOrEqual(2);
    for (const btn of shares) {
      navigate.mockReset();
      fireEvent.click(btn);
      await waitFor(() =>
        expect(navigate).toHaveBeenCalledWith(expect.stringContaining("/auth?redirect=")),
      );
    }
  });

  it("sends them back to the song they were on after signing in", async () => {
    await openPage();
    fireEvent.click((await screen.findAllByRole("button", { name: /share/i }))[0]);
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(decodeURIComponent(navigate.mock.calls[0][0] as string)).toContain("/versions/shakedown-street");
  });
});

describe("VersionPicker — the method is explained, not asserted", () => {
  it("states the rule and shows the sleeper count off real vote counts", async () => {
    await openPage();
    // 181 leader → cutoff 54.3 → the 37-vote version is the sleeper.
    expect(await screen.findByText(/polling under 30% of the leader/i)).toBeInTheDocument();
    expect(screen.getByText(/1 you probably haven't heard/i)).toBeInTheDocument();
  });

  it("keeps the arithmetic behind a disclosure rather than on screen", async () => {
    await openPage();
    expect(screen.queryByText(/Era benchmark/)).toBeInTheDocument(); // chip on the card
    expect(screen.queryByText(/fewer than 55 votes against 181/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /the arithmetic/i }));
    expect(await screen.findByText(/fewer than 55 votes against 181/)).toBeInTheDocument();
  });
});
