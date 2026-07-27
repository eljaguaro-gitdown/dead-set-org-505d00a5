import { describe, it, expect, beforeEach, vi } from "vitest";
import { GaplessEngine, type EngineCallbacks } from "../gaplessEngine";

// Capture every FakeQueue the engine constructs so tests can drive callbacks.
const { instances } = vi.hoisted(() => ({
  instances: [] as Array<Record<string, unknown>>,
}));

vi.mock("gapless", () => {
  class FakeQueue {
    opts: Record<string, unknown>;
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
    constructor(opts: Record<string, unknown>) {
      this.opts = opts;
      instances.push(this as unknown as Record<string, unknown>);
    }
  }
  return { default: FakeQueue, Queue: FakeQueue };
});

const flush = async () => {
  // Engine ops are serialized behind a promise chain; a few microtask turns
  // plus a macrotask are enough to drain it.
  for (let i = 0; i < 5; i++) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
};

const makeCallbacks = (): EngineCallbacks => ({
  onTrackStarted: vi.fn(),
  onQueueEnded: vi.fn(),
  onError: vi.fn(),
  onPlayBlocked: vi.fn(),
  onPlayStateChanged: vi.fn(),
});

const tracks = [
  { slotId: "slot-a", url: "https://archive.org/download/x/a.mp3", metadata: { title: "Scarlet Begonias" } },
  { slotId: "slot-b", url: "https://archive.org/download/x/b.mp3", metadata: { title: "Fire on the Mountain" } },
];

type FakeQueueInstance = {
  opts: {
    playbackMethod: string;
    preloadNumTracks: number;
    onStartNewTrack: (info: { index: number; isPlaying: boolean; currentTime: number; duration: number }) => void;
    onProgress: (info: { index: number; isPlaying: boolean; currentTime: number; duration: number }) => void;
  };
  addTrack: ReturnType<typeof vi.fn>;
  gotoTrack: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
};

const lastQueue = (): FakeQueueInstance => instances[instances.length - 1] as unknown as FakeQueueInstance;

describe("GaplessEngine", () => {
  beforeEach(() => {
    instances.length = 0;
  });

  it("loads a queue in HYBRID mode with preload and starts at the given index", async () => {
    const cbs = makeCallbacks();
    const engine = new GaplessEngine(cbs);
    engine.load(tracks, 0, true);
    await flush();

    const q = lastQueue();
    expect(q.opts.playbackMethod).toBe("HYBRID");
    expect(q.opts.preloadNumTracks).toBe(2);
    expect(q.addTrack).toHaveBeenCalledTimes(2);
    expect(q.addTrack).toHaveBeenNthCalledWith(1, tracks[0].url, { metadata: tracks[0].metadata });
    expect(q.gotoTrack).toHaveBeenCalledWith(0, true);
  });

  it("maps queue indices back to slot ids in onTrackStarted", async () => {
    const cbs = makeCallbacks();
    const engine = new GaplessEngine(cbs);
    engine.load(tracks, 0, true);
    await flush();

    lastQueue().opts.onStartNewTrack({ index: 1, isPlaying: true, currentTime: 0, duration: 100 });
    expect(cbs.onTrackStarted).toHaveBeenCalledWith("slot-b", 1);
    expect(engine.indexOfSlot("slot-b")).toBe(1);
    expect(engine.queueLength).toBe(2);
  });

  it("append keeps the slot mapping in order", async () => {
    const cbs = makeCallbacks();
    const engine = new GaplessEngine(cbs);
    engine.load([tracks[0]], 0, true);
    await flush();
    engine.append(tracks[1]);
    await flush();

    expect(lastQueue().addTrack).toHaveBeenCalledTimes(2);
    expect(engine.indexOfSlot("slot-b")).toBe(1);
  });

  it("a pause issued while the track is still loading wins over the completed load (4.1 guard)", async () => {
    const cbs = makeCallbacks();
    const engine = new GaplessEngine(cbs);
    engine.load(tracks, 0, true);
    engine.pause(); // user taps pause before the async load resolves
    await flush();

    const q = lastQueue();
    // The load completing must not fire "started" — desired state is paused.
    q.opts.onStartNewTrack({ index: 0, isPlaying: true, currentTime: 0, duration: 100 });
    expect(q.pause).toHaveBeenCalled();
    expect(cbs.onTrackStarted).not.toHaveBeenCalled();
  });

  it("writes progress to the ref on every tick but notifies subscribers at ~4Hz", async () => {
    const cbs = makeCallbacks();
    const engine = new GaplessEngine(cbs);
    engine.load(tracks, 0, true);
    await flush();

    const sub = vi.fn();
    engine.subscribeProgress(sub);
    const q = lastQueue();
    // Simulate a burst of 60fps ticks inside one throttle window.
    for (let i = 0; i < 30; i++) {
      q.opts.onProgress({ index: 0, isPlaying: true, currentTime: i / 60, duration: 300 });
    }
    expect(engine.progressRef.current.currentTime).toBeCloseTo(29 / 60);
    expect(engine.progressRef.current.duration).toBe(300);
    expect(sub.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it("reports play-state transitions once, not per tick", async () => {
    const cbs = makeCallbacks();
    const engine = new GaplessEngine(cbs);
    engine.load(tracks, 0, true);
    await flush();

    const q = lastQueue();
    for (let i = 0; i < 10; i++) {
      q.opts.onProgress({ index: 0, isPlaying: true, currentTime: i, duration: 300 });
    }
    const playingCalls = (cbs.onPlayStateChanged as ReturnType<typeof vi.fn>).mock.calls
      .filter((c) => c[0] === true);
    expect(playingCalls).toHaveLength(1);
  });

  it("load() replaces the previous queue and clear() tears it down", async () => {
    const cbs = makeCallbacks();
    const engine = new GaplessEngine(cbs);
    engine.load([tracks[0]], 0, true);
    await flush();
    const first = lastQueue();

    engine.load([tracks[1]], 0, true);
    await flush();
    expect(first.destroy).toHaveBeenCalled();
    expect(instances).toHaveLength(2);

    engine.clear();
    await flush();
    expect(lastQueue().destroy).toHaveBeenCalled();
    expect(engine.queueLength).toBe(0);
  });
});
