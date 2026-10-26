import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { PlaybackOops } from "@/contexts/AudioPlayerContext";

/**
 * Every sentence on the card is a claim, and each is shown only once true:
 * "it's been noted" needs a filed report (an issue id), "we'll let you know"
 * needs a signed-in fan, and "one we know plays" needs a tape that played.
 * Asserted as exact text: toHaveTextContent is a substring match.
 */

const m = vi.hoisted(() => ({
  oops: null as PlaybackOops | null,
  user: null as { id: string } | null,
  dismiss: vi.fn(),
  playSingle: vi.fn(),
  navigate: vi.fn(),
  setPlaybackCredit: vi.fn(async () => true),
  rememberPendingFollow: vi.fn(),
  capture: vi.fn(),
  location: { pathname: "/versions/althea", search: "?n=1" },
}));

vi.mock("@/contexts/AudioPlayerContext", () => ({
  useAudioPlayer: () => ({ playbackOops: m.oops, dismissPlaybackOops: m.dismiss, playSingle: m.playSingle }),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: m.user, loading: false }) }));
vi.mock("@/hooks/useGlobalPlayerHeight", () => ({ useGlobalPlayerHeight: () => 64 }));
vi.mock("@/lib/posthog", () => ({ captureEvent: m.capture }));
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual<typeof import("react-router-dom")>("react-router-dom")),
  useNavigate: () => m.navigate,
  useLocation: () => m.location,
}));
vi.mock("@/lib/playbackIssues", async () => ({
  ...(await vi.importActual<typeof import("@/lib/playbackIssues")>("@/lib/playbackIssues")),
  setPlaybackCredit: m.setPlaybackCredit,
  rememberPendingFollow: m.rememberPendingFollow,
}));

import PlaybackOopsCard from "@/components/PlaybackOopsCard";
import { useBottomClaimed } from "@/lib/bottomCardClaims";

const asNative = () => Object.assign(window, { Capacitor: { isNativePlatform: () => true } });
const asWeb = () => { delete (window as unknown as { Capacitor?: unknown }).Capacitor; };
const ClaimProbe = () => <span data-testid="claimed">{String(useBottomClaimed())}</span>;

const TRACK = "https://archive.org/download/gd77-05-08.sbd/althea.mp3";
const base: PlaybackOops = {
  key: 1,
  kind: "not_on_tape",
  songId: "song-1",
  songTitle: "Althea",
  showDate: "1979-08-04",
  slotId: "s1",
  issueId: undefined,
  suggestion: undefined,
};

const NOTED = "We're on it, and thanks to you this community project gets a little better. It's been noted.";
const text = (s: string) => screen.queryByText((_, el) => el?.tagName === "P" && el.textContent?.trim() === s);

beforeEach(() => {
  vi.clearAllMocks();
  m.oops = null;
  m.user = null;
  m.location = { pathname: "/versions/althea", search: "?n=1" };
  m.setPlaybackCredit.mockResolvedValue(true);
  asWeb();
});

describe("the oops card", () => {
  it("renders nothing without a failure", () => {
    const { container } = render(<PlaybackOopsCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it("apologises at once, but does not say 'noted' before the report has an id", () => {
    m.oops = { ...base };
    render(<PlaybackOopsCard />);
    expect(text("Well, that's embarrassing")).not.toBeNull();
    expect(text("Oops. Althea won't play.")).not.toBeNull();
    expect(text("We pulled the 8/4/79 tape and couldn't find it on there.")).not.toBeNull();
    expect(text(NOTED)).toBeNull();
  });

  it("never says 'noted' when the report could not be filed", () => {
    m.oops = { ...base, issueId: null, suggestion: null };
    m.user = { id: "u1" };
    render(<PlaybackOopsCard />);
    expect(text(NOTED)).toBeNull();
    expect(text("We'll let you know as soon as it's fixed.")).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("signed in: noted, the promise, and credit asked for — unticked", () => {
    m.oops = { ...base, issueId: "issue-1" };
    m.user = { id: "u1" };
    render(<PlaybackOopsCard />);
    expect(text(NOTED)).not.toBeNull();
    expect(text("We'll let you know as soon as it's fixed.")).not.toBeNull();
    expect(screen.getByRole("checkbox", { name: "Credit me by name on Build Notes when it is" })).not.toBeChecked();
  });

  it("in the iOS app: noted and the promise, but no credit asked for (App Review 1.2)", () => {
    asNative();
    m.oops = { ...base, issueId: "issue-1" };
    m.user = { id: "u1" };
    render(<PlaybackOopsCard />);
    expect(text(NOTED)).not.toBeNull();
    expect(text("We'll let you know as soon as it's fixed.")).not.toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByText(/Credit me/i)).toBeNull();
    asWeb();
  });

  it("ticking credit is the fan's yes, sent for this issue", async () => {
    m.oops = { ...base, issueId: "issue-1" };
    m.user = { id: "u1" };
    render(<PlaybackOopsCard />);
    fireEvent.click(screen.getByRole("checkbox"));
    await waitFor(() => expect(m.setPlaybackCredit).toHaveBeenCalledWith("issue-1", true));
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("a yes on one failure is not carried to the next: credit is asked for each time", async () => {
    m.oops = { ...base, issueId: "issue-1" };
    m.user = { id: "u1" };
    const { rerender } = render(<PlaybackOopsCard />);
    fireEvent.click(screen.getByRole("checkbox"));
    await waitFor(() => expect(screen.getByRole("checkbox")).toBeChecked());
    m.oops = { ...base, key: 2, issueId: "issue-2", songTitle: "Bertha" };
    rerender(<PlaybackOopsCard />);
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("a credit that did not save does not stay ticked", async () => {
    m.setPlaybackCredit.mockResolvedValue(false);
    m.oops = { ...base, issueId: "issue-1" };
    m.user = { id: "u1" };
    render(<PlaybackOopsCard />);
    fireEvent.click(screen.getByRole("checkbox"));
    await waitFor(() => expect(screen.getByRole("checkbox")).not.toBeChecked());
    expect(text("Couldn't save that just now. Try the box again.")).not.toBeNull();
  });

  it("signed out: invites sign-in, remembers the issue, and comes back here", () => {
    m.oops = { ...base, issueId: "issue-1" };
    render(<PlaybackOopsCard />);
    expect(text("Sign in and we'll let you know as soon as it's fixed.")).not.toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(m.rememberPendingFollow).toHaveBeenCalledWith("issue-1");
    expect(m.navigate).toHaveBeenCalledWith(`/auth?redirect=${encodeURIComponent("/versions/althea?n=1")}`);
  });

  it("offers a tape we know plays, and plays exactly that track", () => {
    m.oops = {
      ...base,
      issueId: "issue-1",
      suggestion: { songId: "song-1", songTitle: "Althea", showDate: "1977-05-08", archiveUrl: null, trackUrl: TRACK },
    };
    render(<PlaybackOopsCard />);
    expect(text("One we know plays")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Althea · 5/8/77" }));
    expect(m.playSingle).toHaveBeenCalledWith(expect.objectContaining({ directTrackUrl: TRACK }));
  });

  it("offers nothing when no tape is known to play", () => {
    m.oops = { ...base, issueId: "issue-1", suggestion: null };
    render(<PlaybackOopsCard />);
    expect(text("One we know plays")).toBeNull();
  });

  it("dismisses", () => {
    m.oops = { ...base };
    render(<PlaybackOopsCard />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(m.dismiss).toHaveBeenCalled();
  });

  it("holds the bottom of the screen while it is up, so the install banner yields", () => {
    m.oops = { ...base };
    const { rerender } = render(<><PlaybackOopsCard /><ClaimProbe /></>);
    expect(screen.getByTestId("claimed").textContent).toBe("true");
    m.oops = null;
    rerender(<><PlaybackOopsCard /><ClaimProbe /></>);
    expect(screen.getByTestId("claimed").textContent).toBe("false");
  });

  it("sits above the player bar rather than under it", () => {
    m.oops = { ...base };
    const { container } = render(<PlaybackOopsCard />);
    expect((container.querySelector("[data-playback-oops]") as HTMLElement).style.bottom).toBe("76px");
  });
});

/**
 * Root-mounted, the card followed the fan from the page they tapped on to
 * wherever they went next, and could sit over the landing picker.
 */
describe("the card stays on the page it belongs to", () => {
  it("leaving the page takes it down", () => {
    m.oops = { ...base };
    const { rerender } = render(<PlaybackOopsCard />);
    expect(m.dismiss).not.toHaveBeenCalled();
    m.location = { pathname: "/", search: "" };
    rerender(<PlaybackOopsCard />);
    expect(m.dismiss).toHaveBeenCalledTimes(1);
  });

  it("a query-string change is the same page, and leaves it up", () => {
    m.oops = { ...base };
    const { rerender } = render(<PlaybackOopsCard />);
    m.location = { pathname: "/versions/althea", search: "?n=1&then=share" };
    rerender(<PlaybackOopsCard />);
    expect(m.dismiss).not.toHaveBeenCalled();
  });
});

/**
 * "As soon as it's fixed" is a promise about a fix. For a night no tape of
 * which turned up, the usual end is the admin's "No tape exists", which tells
 * nobody — so the promise there is conditional, and silence keeps it.
 */
describe("what the card promises depends on what a fix can be", () => {
  it.each(["no_tape", "none_in_setlist"] as const)("%s, signed in: if one turns up", (kind) => {
    m.oops = { ...base, kind, issueId: "issue-1" };
    m.user = { id: "u1" };
    render(<PlaybackOopsCard />);
    expect(text("If one turns up, we'll let you know.")).not.toBeNull();
    expect(text("We'll let you know as soon as it's fixed.")).toBeNull();
    expect(screen.getByRole("checkbox", { name: "Credit me by name on Build Notes if it does" })).not.toBeChecked();
  });

  it("no_tape, signed out: the invitation carries the same condition", () => {
    m.oops = { ...base, kind: "no_tape", issueId: "issue-1" };
    render(<PlaybackOopsCard />);
    expect(text("Sign in and we'll let you know if one turns up.")).not.toBeNull();
    expect(text("Sign in and we'll let you know as soon as it's fixed.")).toBeNull();
  });

  it.each(["not_on_tape", "wont_play"] as const)("%s keeps the promise of a fix", (kind) => {
    m.oops = { ...base, kind, issueId: "issue-1" };
    m.user = { id: "u1" };
    render(<PlaybackOopsCard />);
    expect(text("We'll let you know as soon as it's fixed.")).not.toBeNull();
    expect(screen.getByRole("checkbox", { name: "Credit me by name on Build Notes when it is" })).toBeInTheDocument();
  });
});
