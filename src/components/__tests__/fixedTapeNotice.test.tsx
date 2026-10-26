import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { FixedTape } from "@/lib/playbackIssues";

const m = vi.hoisted(() => ({
  user: null as { id: string } | null,
  oops: null as unknown,
  playSingle: vi.fn(),
  navigate: vi.fn(),
  order: [] as string[],
  fixed: [] as FixedTape[],
  markFixedTapeSeen: vi.fn(async () => undefined),
}));

vi.mock("@/contexts/AudioPlayerContext", () => ({
  useAudioPlayer: () => ({ playSingle: m.playSingle, playbackOops: m.oops }),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: m.user, loading: false }) }));
vi.mock("@/hooks/useGlobalPlayerHeight", () => ({ useGlobalPlayerHeight: () => 0 }));
vi.mock("@/lib/posthog", () => ({ captureEvent: vi.fn() }));
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual<typeof import("react-router-dom")>("react-router-dom")),
  useNavigate: () => m.navigate,
}));
vi.mock("@/lib/playbackIssues", async () => ({
  ...(await vi.importActual<typeof import("@/lib/playbackIssues")>("@/lib/playbackIssues")),
  claimPendingFollows: vi.fn(async () => {
    m.order.push("claim");
    return 0;
  }),
  fetchMyFixedTapes: vi.fn(async () => {
    m.order.push("fetch");
    return m.fixed;
  }),
  markFixedTapeSeen: m.markFixedTapeSeen,
}));

import FixedTapeNotice from "@/components/FixedTapeNotice";

const asNative = () => Object.assign(window, { Capacitor: { isNativePlatform: () => true } });
const asWeb = () => { delete (window as unknown as { Capacitor?: unknown }).Capacitor; };
const ALTHEA: FixedTape = { issueId: "i1", songId: "song-1", songTitle: "Althea", showDate: "1979-08-04", creditOk: false };
const p = (s: string) => screen.queryByText((_, el) => el?.tagName === "P" && el.textContent?.trim() === s);

beforeEach(() => {
  vi.clearAllMocks();
  m.user = null;
  m.oops = null;
  m.order = [];
  m.fixed = [];
  asWeb();
});

describe("we let you know when it's fixed", () => {
  it("asks nothing for a signed-out visitor", async () => {
    m.fixed = [ALTHEA];
    const { container } = render(<FixedTapeNotice />);
    await new Promise((r) => setTimeout(r, 0));
    expect(m.order).toEqual([]);
    expect(container).toBeEmptyDOMElement();
  });

  it("claims reports filed before sign-in BEFORE asking what is fixed", async () => {
    m.user = { id: "u1" };
    m.fixed = [ALTHEA];
    render(<FixedTapeNotice />);
    await waitFor(() => expect(p("Althea · 8/4/79 plays again.")).not.toBeNull());
    expect(m.order).toEqual(["claim", "fetch"]);
  });

  it("thanks them, and only says their name is on Build Notes when it is", async () => {
    m.user = { id: "u1" };
    m.fixed = [ALTHEA];
    const { unmount } = render(<FixedTapeNotice />);
    await waitFor(() =>
      expect(p("You flagged it, we fixed it, and it's been checked. Thanks for making this better.")).not.toBeNull(),
    );
    unmount();

    m.fixed = [{ ...ALTHEA, creditOk: true }];
    render(<FixedTapeNotice />);
    await waitFor(() =>
      expect(
        p("You flagged it, we fixed it, and it's been checked. Thanks for making this better. Your name's on Build Notes."),
      ).not.toBeNull(),
    );
  });

  it("in the iOS app, never says the name is on Build Notes: the app shows no credits", async () => {
    asNative();
    m.user = { id: "u1" };
    m.fixed = [{ ...ALTHEA, creditOk: true }];
    render(<FixedTapeNotice />);
    await waitFor(() =>
      expect(p("You flagged it, we fixed it, and it's been checked. Thanks for making this better.")).not.toBeNull(),
    );
    expect(screen.queryByText(/on Build Notes/)).toBeNull();
    asWeb();
  });

  it("Spin it plays that night through the normal by-night path, and marks it seen", async () => {
    m.user = { id: "u1" };
    m.fixed = [ALTHEA];
    render(<FixedTapeNotice />);
    fireEvent.click(await screen.findByRole("button", { name: "Spin it" }));
    expect(m.markFixedTapeSeen).toHaveBeenCalledWith("i1");
    const slot = m.playSingle.mock.calls[0][0];
    expect(slot.song).toEqual({ id: "song-1", title: "Althea" });
    expect(slot.version.show_date).toBe("1979-08-04");
    expect(slot.version.archive_org_url).toBeNull();
    expect(slot.directTrackUrl).toBeNull();
  });

  it("Got it marks it seen and moves to the next one", async () => {
    m.user = { id: "u1" };
    m.fixed = [ALTHEA, { ...ALTHEA, issueId: "i2", songTitle: "Bertha", showDate: null }];
    render(<FixedTapeNotice />);
    fireEvent.click(await screen.findByRole("button", { name: "Got it" }));
    expect(m.markFixedTapeSeen).toHaveBeenCalledWith("i1");
    expect(p("Bertha plays again.")).not.toBeNull();
  });

  it("steps aside while a fresh dead tap is being apologised for", async () => {
    m.user = { id: "u1" };
    m.fixed = [ALTHEA];
    m.oops = { key: 1 };
    render(<FixedTapeNotice />);
    await new Promise((r) => setTimeout(r, 0));
    expect(p("Althea · 8/4/79 plays again.")).toBeNull();
  });
});
