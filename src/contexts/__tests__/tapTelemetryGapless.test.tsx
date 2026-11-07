import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

/**
 * The gapless half of the tap contract: the engine's first progress tick
 * with real time is the sound, and a browser that refuses autoplay is a
 * failure at the gesture leg. The fake queue is the same shape the other
 * gapless suites use; its callbacks are driven by hand.
 */
class FakeAudioContext {
  state = "running";
  resume = vi.fn(async () => undefined);
  close = vi.fn(async () => undefined);
}
vi.stubGlobal("AudioContext", FakeAudioContext);

const { queues } = vi.hoisted(() => ({
  queues: [] as Array<{ opts: Record<string, (info?: unknown) => void> }>,
}));
vi.mock("gapless", () => {
  class FakeQueue {
    opts: Record<string, (info?: unknown) => void>;
    constructor(opts: Record<string, (info?: unknown) => void>) {
      this.opts = opts;
      queues.push(this);
    }
    addTrack = vi.fn();
    gotoTrack = vi.fn();
    play = vi.fn();
    pause = vi.fn();
    next = vi.fn();
    previous = vi.fn();
    seek = vi.fn();
    setVolume = vi.fn();
    destroy = vi.fn();
    resumeAudioContext = vi.fn(async () => undefined);
    currentTrackIndex = 0;
    isPlaying = false;
  }
  return { default: FakeQueue, Queue: FakeQueue };
});
vi.mock("@/lib/playEventTracker", () => ({
  startPlayEvent: vi.fn(async () => undefined),
  finalizePlayEvent: vi.fn(async () => undefined),
  pausePlayEvent: vi.fn(),
  resumePlayEvent: vi.fn(),
  setPlayEventTrackDuration: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(async () => ({ data: null, error: null })),
    auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })),
    })),
  },
}));

import { AudioPlayerProvider, useAudioPlayer, type PlayableSlot } from "@/contexts/AudioPlayerContext";
import { SYNTHETIC_VERSION_DEFAULTS } from "@/lib/syntheticVersion";
import { resetTaps, type TapRecord } from "@/lib/player/tapTelemetry";

const ready = (id: string): PlayableSlot => ({
  id,
  song: { id: `song-${id}`, title: "Bertha" },
  version: { ...SYNTHETIC_VERSION_DEFAULTS, id: `v-${id}`, song_id: `song-${id}`, show_date: "1971-02-18", archive_org_url: `https://archive.org/details/gd-${id}` },
  directTrackUrl: `https://archive.org/download/gd-${id}/Bertha.mp3`,
  setNumber: 1, position: 0, segueToNext: false,
});

const seen: TapRecord[] = [];
const listen = (e: Event) => seen.push((e as CustomEvent<TapRecord>).detail);
const Harness = () => {
  const { playSingle } = useAudioPlayer();
  return (
    <>
      <button onClick={() => void playSingle(ready("a"))}>tapA</button>
      <button onClick={() => void playSingle(ready("b"))}>tapB</button>
    </>
  );
};

const lastQueue = () => queues[queues.length - 1];
const tick = (currentTime: number) =>
  act(() => {
    lastQueue().opts.onProgress({ currentTime, duration: 300, isPlaying: true, playbackType: "HTML5", index: 0 });
  });

beforeEach(() => {
  seen.length = 0;
  queues.length = 0;
  resetTaps();
  window.addEventListener("deadset:tap", listen);
  window.history.replaceState({}, "", "/versions/bertha");
});
afterEach(() => window.removeEventListener("deadset:tap", listen));

const stored = (id: string): PlayableSlot => ({ ...ready(id), directTrackUrl: null });

describe("gapless: the resolution watchdog settles a tap that never got an answer", () => {
  it("times out AT the metadata leg when the stored tape never answers", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    try {
      const Stuck = () => {
        const { playSingle } = useAudioPlayer();
        return <button onClick={() => void playSingle(stored("s"))}>stuck</button>;
      };
      render(<AudioPlayerProvider><Stuck /></AudioPlayerProvider>);
      // Fake timers BEFORE the tap, so the watchdog's setTimeout is the fake
      // one; shouldAdvanceTime keeps the promise chain's macrotasks moving.
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        fireEvent.click(screen.getByText("stuck"));
        await vi.advanceTimersByTimeAsync(200);
        expect(fetch).toHaveBeenCalled();
        expect(seen.map((r) => r.event)).toEqual(["play_requested"]);
        await vi.advanceTimersByTimeAsync(26_000);
      } finally {
        vi.useRealTimers();
      }
      expect(seen.map((r) => r.event)).toEqual(["play_requested", "play_failed"]);
      expect(seen[1]).toMatchObject({ kind: "timeout", stage: "metadata" });
    } finally {
      vi.unstubAllGlobals();
      vi.stubGlobal("AudioContext", FakeAudioContext);
    }
  });
});

describe("gapless: the first progress tick is the sound", () => {
  it("settles the tap as first_sound once, with its own timing", async () => {
    render(<AudioPlayerProvider><Harness /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("tapA"));
    await waitFor(() => expect(lastQueue()?.opts.onProgress).toBeTypeOf("function"));
    // A tick at zero is a load, not a sound.
    tick(0);
    expect(seen.map((r) => r.event)).toEqual(["play_requested"]);
    tick(0.4);
    tick(0.7);
    expect(seen.map((r) => r.event)).toEqual(["play_requested", "play_first_sound"]);
    expect(seen[1]).toMatchObject({ surface: "version_picker", tap_id: seen[0].tap_id });
    expect(seen[1].ms).toBeGreaterThanOrEqual(0);
  });

  it("a refused autoplay is a failure at the gesture leg", async () => {
    render(<AudioPlayerProvider><Harness /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("tapA"));
    await waitFor(() => expect(lastQueue()?.opts.onPlayBlocked).toBeTypeOf("function"));
    act(() => lastQueue().opts.onPlayBlocked());
    expect(seen.map((r) => r.event)).toEqual(["play_requested", "play_failed"]);
    expect(seen[1]).toMatchObject({ kind: "autoplay_blocked", stage: "gesture" });
  });

  it("a tick from the slot the fan LEFT is not the new tap's sound", async () => {
    render(<AudioPlayerProvider><Harness /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("tapA"));
    await waitFor(() => expect(queues.length).toBeGreaterThan(0));
    fireEvent.click(screen.getByText("tapB"));
    // The engine re-anchors on B; a stale tick from A's queue arrives first.
    const aQueue = queues[0];
    await waitFor(() => expect(queues.length).toBeGreaterThan(1));
    act(() => aQueue.opts.onProgress({ currentTime: 3, duration: 300, isPlaying: true, playbackType: "HTML5", index: 0 }));
    const settled = seen.filter((r) => r.event !== "play_requested");
    // A's tap was superseded by B's; B is still waiting.
    expect(settled.map((r) => r.kind)).toEqual(["superseded"]);
    tick(0.5);
    expect(seen[seen.length - 1]).toMatchObject({ event: "play_first_sound", tap_id: seen[2].tap_id });
  });
});
