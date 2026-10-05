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
/** Reconfigurable per test: a night can resolve, miss, or be unaskable. */
const findRecordingForDate = vi.fn(async (..._a: unknown[]) => null as unknown);
vi.mock("@/lib/archiveOrg", () => ({
  findRecordingForDate: (...a: unknown[]) => findRecordingForDate(...a),
  findManyArchiveRecordings: (...a: unknown[]) => findManyArchiveRecordings(...a),
}));

const toastError = vi.fn();
const toastInfo = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (m: string) => toastError(m), info: (m: string) => toastInfo(m), success: vi.fn() } }));

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
  findRecordingForDate.mockReset();
  findRecordingForDate.mockResolvedValue(null);
  toastError.mockReset();
  toastInfo.mockReset();
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

/**
 * findRecordingForDate throws when the Archive could not be ASKED, which is a
 * different thing from a night with no tape. That throw used to be reachable
 * only from the search leg; once the metadata leg began counting unreadable
 * candidates, any one of ten requests could raise it — and this page awaited
 * it in three places with no guard.
 *
 * The worst was playVersion: `setResolving(null)` sat AFTER the await, so a
 * rejection skipped it and left the button disabled under "Looking for the
 * tape…" forever, with no toast and an unhandled rejection. A reader tapped
 * play and the page simply stopped.
 */
describe("VersionPicker — when the Archive cannot be asked", () => {
  const unaskable = () => findRecordingForDate.mockRejectedValue(new Error("archive.org unreadable"));

  /** v2 carries no archive_org_url, so playing it must resolve by night. */
  const playUnstoredVersion = async () => {
    await openPage();
    const buttons = await screen.findAllByRole("button", { name: /play this version/i });
    const target = buttons[buttons.length - 1];
    fireEvent.click(target);
    return target;
  };

  it("clears the busy state instead of freezing the button", async () => {
    unaskable();
    const button = await playUnstoredVersion();
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(button).not.toBeDisabled();
    expect(screen.queryByText(/Looking for the tape/i)).not.toBeInTheDocument();
  });

  it("says it could not reach the Archive, NOT that no tape circulates", async () => {
    unaskable();
    await playUnstoredVersion();
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/couldn't reach the archive/i)));
    // The two are different claims and must never be collapsed.
    expect(toastInfo).not.toHaveBeenCalledWith(expect.stringMatching(/no tape/i));
  });

  it("does not try to play anything", async () => {
    unaskable();
    await playUnstoredVersion();
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(playSingle).not.toHaveBeenCalled();
  });

  it("still says 'no tape circulates' when the night genuinely has none", async () => {
    findRecordingForDate.mockResolvedValue(null);
    await playUnstoredVersion();
    await waitFor(() => expect(toastInfo).toHaveBeenCalledWith(expect.stringMatching(/no tape/i)));
    expect(toastError).not.toHaveBeenCalled();
  });

  /**
   * The hero is the one-tap path the whole front door points at, and it awaits
   * the same resolver. Its `finally` always cleared the spinner, so the button
   * recovered — but the rejection left with nothing said, so the reader tapped
   * the biggest control on the page and got silence.
   */
  it("the hero tap says something when the Archive cannot be asked", async () => {
    unaskable();
    await openPage();
    const hero = await screen.findByRole("button", { name: /^Play Shakedown Street, /i });
    fireEvent.click(hero);
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/couldn't reach the archive/i)));
    expect(hero).not.toBeDisabled();
    expect(screen.queryByText(/Finding the tape/i)).not.toBeInTheDocument();
    // The playVersion test asserted this and the hero test did not, so a hero
    // catch that ALSO claimed "no tape" survived mutation.
    expect(toastInfo).not.toHaveBeenCalledWith(expect.stringMatching(/no tape/i));
  });

  it("renders the page even when a milestone night cannot be asked", async () => {
    unaskable();
    await openPage();
    // One rejected night used to reject the whole Promise.all, so setMilestones
    // never ran and the page silently lost its first/last-played row.
    expect(await screen.findByText("Shakedown Street")).toBeInTheDocument();
    expect((await screen.findAllByText(/June 30, 1985/)).length).toBeGreaterThan(0);
  });

  /**
   * The one that matters, and the one the first two rounds missed. Collecting
   * `unchecked` and passing it to buildMilestones is worth nothing while the
   * card branches on `!m.tapeFound`: the data knew the lookup had failed and
   * the screen still printed "No tape of this night circulates — the date is
   * on record, the music isn't."
   *
   * That is a claim about the tapers, asserted in their own voice, on the
   * evidence of a 503. Assert the SENTENCE, not the field.
   */
  it("never claims no tape circulates when the lookup merely failed", async () => {
    unaskable();
    await openPage();
    await waitFor(() => expect(findRecordingForDate).toHaveBeenCalled());
    expect(screen.queryByText(/No tape of this night circulates/i)).not.toBeInTheDocument();
  });

  it("still says it when the night genuinely has no tape", async () => {
    findRecordingForDate.mockResolvedValue(null);
    await openPage();
    await waitFor(() => expect(findRecordingForDate).toHaveBeenCalled());
    // Both milestones render the line, so this is findAll — a findByText here
    // throws on the second match and reads like the code failed.
    expect((await screen.findAllByText(/No tape of this night circulates/i)).length).toBe(2);
  });
});
