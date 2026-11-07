import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PlayableSlot } from "@/contexts/AudioPlayerContext";

/**
 * The window between the tap and the sound.
 *
 * Reported from a phone: tap a night, nothing visibly happens, and if you are
 * quick you get told the song was not found — over a tape that starts playing
 * moments later. The only feedback was a 20px spinner inside the play button
 * of the bottom bar.
 *
 * The two things worth pinning are the ones a careless edit breaks: that a
 * FAST resolve shows nothing at all (otherwise every tap flashes a card), and
 * that it goes away the moment there is something real to say.
 */

const state = vi.hoisted(() => ({
  playingSlot: null as PlayableSlot | null,
  error: null as string | null,
  cueingTitle: null as string | null,
  planB: null as unknown,
}));

vi.mock("@/contexts/AudioPlayerContext", () => ({
  useAudioPlayer: () => ({
    planB: state.planB,
    playingSlot: state.playingSlot,
    transport: {
      error: state.error,
      isLoading: false,
      isPlaying: false,
      cueingTitle: state.cueingTitle,
    },
  }),
}));
vi.mock("@/hooks/useGlobalPlayerHeight", () => ({ useGlobalPlayerHeight: () => 96 }));
vi.mock("@/lib/charlieArt", () => ({ charlieArtFor: () => "/charlie.jpg" }));

import CrateDigging, { TapAck, SHOW_AFTER_MS, ESCALATE_AFTER_MS } from "@/components/CrateDigging";
import { beginTap, claimTap, resetTaps, tapFirstSound } from "@/lib/player/tapTelemetry";
import { fireEvent } from "@testing-library/react";

const slot = (over: Partial<PlayableSlot> = {}): PlayableSlot =>
  ({
    id: "slot-1",
    song: { id: "song-1", title: "Eyes of the World" },
    version: { show_date: "1973-02-09" },
    directTrackUrl: null,
    setNumber: 1,
    position: 0,
    segueToNext: false,
    ...over,
  }) as PlayableSlot;

beforeEach(() => {
  vi.useFakeTimers();
  state.playingSlot = null;
  state.error = null;
  state.cueingTitle = null;
  state.planB = null;
  resetTaps();
});
afterEach(() => vi.useRealTimers());

const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
/** jsdom has no PointerEvent; a MouseEvent of that type carries the coordinates. */
const pointer = (x: number, y: number) =>
  document.body.dispatchEvent(new MouseEvent("pointerdown", { clientX: x, clientY: y, bubbles: true }));

describe("CrateDigging", () => {
  it("shows nothing before the threshold, while still digging", () => {
    // The first version of this test let the slot RESOLVE before asserting, so
    // it passed at any delay — including 0. The gate changed 450 to 350 and it
    // stayed green. Hold `digging` true and pin the boundary itself.
    state.playingSlot = slot();
    render(<CrateDigging />);
    advance(SHOW_AFTER_MS - 1);
    expect(screen.queryByRole("status")).toBeNull();
    advance(2);
    expect(screen.getByRole("status")).toBeInTheDocument();
    // The sprint's target: every tap acknowledged within 300 ms.
    expect(SHOW_AFTER_MS).toBeLessThanOrEqual(300);
  });

  it("a resolve that beats the threshold never flashes the card", () => {
    state.playingSlot = slot();
    const { rerender } = render(<CrateDigging />);
    advance(440);
    state.playingSlot = slot({ directTrackUrl: "https://archive.org/x.mp3" });
    rerender(<CrateDigging />);
    advance(2000);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("appears once the wait is long enough to need explaining", () => {
    state.playingSlot = slot();
    render(<CrateDigging />);
    expect(screen.queryByRole("status")).toBeNull();
    advance(500);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("names the song it is digging for", () => {
    state.playingSlot = slot();
    render(<CrateDigging />);
    advance(500);
    expect(screen.getByRole("status").textContent).toContain("Eyes of the World");
  });

  it("promises it will start on its own, and credits the Archive", () => {
    state.playingSlot = slot();
    render(<CrateDigging />);
    advance(500);
    const text = screen.getByRole("status").textContent ?? "";
    expect(text).toMatch(/start on its own/i);
    expect(text).toMatch(/Internet Archive/i);
  });

  it("gets out of the way the moment the tape resolves", () => {
    state.playingSlot = slot();
    const { rerender } = render(<CrateDigging />);
    advance(500);
    expect(screen.getByRole("status")).toBeInTheDocument();
    state.playingSlot = slot({ directTrackUrl: "https://archive.org/x.mp3" });
    rerender(<CrateDigging />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("gets out of the way when the bar has something real to say", () => {
    state.playingSlot = slot();
    const { rerender } = render(<CrateDigging />);
    advance(500);
    state.error = "Couldn't reach the Archive just now. Tap play to try again.";
    rerender(<CrateDigging />);
    // Two messages about the same tap, one reassuring and one not, is worse
    // than either alone.
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows nothing when nothing is playing", () => {
    render(<CrateDigging />);
    advance(2000);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("announces politely, so it cannot interrupt a screen reader", () => {
    state.playingSlot = slot();
    render(<CrateDigging />);
    advance(500);
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });

  it("clears the player bar by measuring it, never by assuming a height", () => {
    // A tap low on the screen, right above the bar: the sheet must go above
    // it, and its bottom edge (230 px tall) must stay clear of the MEASURED
    // bar. 96 is the mocked player height; the bar is drag-resizable and has
    // two implementations of different heights, so a constant would be wrong.
    pointer(100, window.innerHeight - 20);
    state.playingSlot = slot();
    render(<CrateDigging />);
    advance(500);
    const top = parseFloat((screen.getByRole("status") as HTMLElement).style.top);
    expect(Number.isFinite(top)).toBe(true);
    expect(top + 230).toBeLessThanOrEqual(window.innerHeight - 96 - 12);
  });


  it("restarts the wait when the reader taps a different night", () => {
    state.playingSlot = slot();
    const { rerender } = render(<CrateDigging />);
    advance(SHOW_AFTER_MS - 50);
    state.playingSlot = slot({ id: "slot-2", song: { id: "s2", title: "Bertha" } });
    rerender(<CrateDigging />);
    advance(SHOW_AFTER_MS - 50); // past the threshold in total, but not on THIS slot
    expect(screen.queryByRole("status")).toBeNull();
    advance(100);
    expect(screen.getByRole("status").textContent).toContain("Bertha");
  });
});

describe("the Play All wait, which has no playingSlot at all", () => {
  it("shows the card while Play All is still hunting for its first tape", () => {
    // playSetlist clears playingSlot and leaves it null until the first track
    // resolves, so the whole multi-second wait used to get no card.
    state.cueingTitle = "Eyes of the World";
    render(<CrateDigging />);
    advance(500);
    expect(screen.getByRole("status").textContent).toContain("Eyes of the World");
  });

  it("stops when the first tape is found", () => {
    state.cueingTitle = "Eyes of the World";
    const { rerender } = render(<CrateDigging />);
    advance(500);
    state.cueingTitle = null;
    state.playingSlot = slot({ directTrackUrl: "https://archive.org/x.mp3" });
    rerender(<CrateDigging />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("it is mounted, and it does not swallow taps", () => {
  it("App renders CrateDigging as a SIBLING of the player, not inside a page", () => {
    // Deleting the component from App.tsx left every test green. And it has to
    // be a sibling: PageLayout wraps pages in `relative z-10`, which opens a
    // stacking context the player's root-level z-40 always wins.
    const app = readFileSync(join(__dirname, "..", "..", "App.tsx"), "utf8");
    expect(app).toMatch(/<CrateDigging\s*\/>/);
    const player = app.indexOf("<GlobalAudioPlayer />");
    const card = app.indexOf("<CrateDigging />");
    expect(player).toBeGreaterThan(-1);
    expect(card).toBeGreaterThan(player);
    // Same indentation = same parent. A nested one would be deeper.
    const indentOf = (i: number) => app.slice(0, i).split("\n").pop()!.length;
    expect(indentOf(card)).toBe(indentOf(player));
  });

  it("the wrapper lets taps through to the player underneath", () => {
    state.playingSlot = slot();
    render(<CrateDigging />);
    advance(500);
    // jsdom has no layout, so this is the only way to catch the class being
    // dropped — which would make a full-width overlay eat every tap.
    expect(screen.getByRole("status").className).toContain("pointer-events-none");
    const card = screen.getByRole("status").firstElementChild as HTMLElement;
    expect(card.className).toContain("pointer-events-auto");
  });
});

describe("the 2026-11 sprint's louder wait", () => {
  it("escalates at 3 s: the Archive is slow, and it says so", () => {
    state.playingSlot = slot();
    render(<CrateDigging />);
    advance(SHOW_AFTER_MS + 10);
    expect(screen.getByRole("status").textContent).toContain("Finding Eyes of the World · 2/9/73");
    advance(ESCALATE_AFTER_MS);
    expect(screen.getByRole("status").textContent).toContain("The Archive's taking its time — still digging");
  });

  it("covers a wait that has not reached the player yet (a surface's own lookup)", () => {
    render(<CrateDigging />);
    act(() => { beginTap("version_picker", { songId: "s", title: "Althea", showDate: "1980-05-16" }); });
    advance(SHOW_AFTER_MS + 10);
    expect(screen.getByRole("status").textContent).toContain("Finding Althea · 5/16/80");
  });

  it("goes the moment the tap is answered with sound", () => {
    render(<CrateDigging />);
    act(() => { beginTap("version_picker", { songId: "s", title: "Althea" }); claimTap("other", { slotId: "x" }); });
    advance(SHOW_AFTER_MS + 10);
    expect(screen.getByRole("status")).toBeInTheDocument();
    act(() => tapFirstSound("x"));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("steps aside for Plan B, which says something truer", () => {
    state.playingSlot = slot();
    state.planB = { key: 1 };
    render(<CrateDigging />);
    advance(SHOW_AFTER_MS + 10);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("TapAck marks the finger at once — no timer at all", () => {
    render(<TapAck />);
    pointer(120, 300);
    act(() => { beginTap("version_picker", { songId: "s", title: "Althea" }); });
    const ack = document.querySelector("[data-tap-ack]") as HTMLElement;
    expect(ack).not.toBeNull();
    expect(ack.style.left).toBe("120px");
    expect(ack.style.top).toBe("300px");
  });
});

