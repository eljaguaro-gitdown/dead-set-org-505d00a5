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
let searchParams = new URLSearchParams();
const setSearchParams = vi.fn();
const playSingle = vi.fn();
const playSetlist = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ slug: "shakedown-street" }),
    useNavigate: () => navigate,
    useSearchParams: () => [searchParams, setSearchParams],
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
const findManyArchiveRecordings = vi.fn((..._a: unknown[]) => Promise.resolve([]));
vi.mock("@/lib/archiveOrg", () => ({
  findRecordingForDate: vi.fn(async () => null),
  findManyArchiveRecordings: (...a: unknown[]) => findManyArchiveRecordings(...a),
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
  searchParams = new URLSearchParams();
  findManyArchiveRecordings.mockClear();
  setSearchParams.mockReset();
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

  /**
   * The gate is an invitation now, not a trapdoor. The old path fired a toast
   * and navigated to /auth on the next line, so the tape someone had just
   * discovered vanished mid-excitement and a login form took its place. The
   * page has to stay on screen while they decide.
   */
  it("invites rather than redirecting when keeping a guide", async () => {
    await openPage();
    fireEvent.click(await screen.findByRole("button", { name: /keep as a listening guide/i }));
    expect(await screen.findByText(/Keep it on your shelf/i)).toBeInTheDocument();
    // The page is still there behind it.
    expect(screen.getByText("Shakedown Street")).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("invites rather than redirecting when sharing", async () => {
    await openPage();
    fireEvent.click(await screen.findByRole("button", { name: /share/i }));
    expect(await screen.findByText(/Pass it on/i)).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("offers one Share, and it is not in the bottom bar", async () => {
    await openPage();
    // Two identical share buttons is how the wrong one got hit: the labelled
    // copy sat in the fixed bottom bar, under a scrolling thumb.
    expect(await screen.findAllByRole("button", { name: /share/i })).toHaveLength(1);
  });

  it("carries the interrupted action through sign-in", async () => {
    await openPage();
    fireEvent.click(await screen.findByRole("button", { name: /share/i }));
    fireEvent.click(await screen.findByRole("button", { name: /sign in and send it/i }));
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    const href = decodeURIComponent(navigate.mock.calls[0][0] as string);
    expect(href).toContain("/versions/shakedown-street");
    expect(href).toContain("then=share");
  });

  it("lets them take the plain link without an account", async () => {
    // /versions/:slug is a public url — it reads fine signed out and is two
    // taps out of the address bar. Walling it buys nothing and costs goodwill.
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText }, share: undefined });
    await openPage();
    fireEvent.click(await screen.findByRole("button", { name: /share/i }));
    fireEvent.click(await screen.findByRole("button", { name: /just copy the link/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(navigate).not.toHaveBeenCalled();
  });

  it("gives saving no second door — a guide needs an account to exist", async () => {
    await openPage();
    fireEvent.click(await screen.findByRole("button", { name: /keep as a listening guide/i }));
    await screen.findByText(/Keep it on your shelf/i);
    expect(screen.queryByRole("button", { name: /just copy the link/i })).not.toBeInTheDocument();
  });
});

describe("VersionPicker — signed in", () => {
  it("shares straight through, with no sheet in the way", async () => {
    mockUser = { id: "user-1" };
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText }, share: undefined });
    await openPage();
    fireEvent.click(await screen.findByRole("button", { name: /share/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(screen.queryByText(/Pass it on/i)).not.toBeInTheDocument();
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

/**
 * The gem signal on this page. sleeperMath covers 2 songs; this covers the
 * other 232, so it has to actually reach the screen — and it has to stay off
 * the screen for the two that have a real poll, where a second lookup would
 * buy nothing.
 */
describe("VersionPicker — quiet gems where no poll exists", () => {
  it("does not go looking when the song already has votes", async () => {
    await openPage();
    // SONGS/VERSIONS fixtures carry votes, so the archive lookup is pointless.
    await waitFor(() => expect(screen.getByText("Shakedown Street")).toBeInTheDocument());
    expect(findManyArchiveRecordings).not.toHaveBeenCalled();
  });
});
