import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The engine side of the iOS fix: the element gapless builds for a track in
 * addTrack — which runs after the Archive lookup, long after the tap — must be
 * one of the elements started IN the tap (GaplessEngine.unlock).
 */
const { built, opts } = vi.hoisted(() => ({ built: [] as HTMLAudioElement[], opts: [] as Array<Record<string, unknown>> }));
const lastOpts = () => opts[opts.length - 1];
vi.mock("gapless", () => {
  class FakeQueue {
    constructor(o: Record<string, unknown>) { opts.push(o); }
    // Exactly what gapless's Track constructor does: `new Audio()`.
    _tracks: Array<{ audio: HTMLAudioElement }> = [];
    addTrack = vi.fn(() => { const audio = new Audio(); built.push(audio); this._tracks.push({ audio }); });
    gotoTrack = vi.fn();
    play = vi.fn();
    pause = vi.fn();
    destroy = vi.fn();
    seek = vi.fn();
    setVolume = vi.fn();
    resumeAudioContext = vi.fn(async () => undefined);
    currentTrackIndex = 0;
    isPlaying = false;
  }
  return { default: FakeQueue, Queue: FakeQueue };
});

import { GaplessEngine } from "@/lib/player/gaplessEngine";
import { resetBlessedAudio } from "@/lib/player/blessedAudio";

const cb = { onTrackStarted: vi.fn(), onQueueEnded: vi.fn(), onError: vi.fn(), onPlayBlocked: vi.fn(), onPlayStateChanged: vi.fn() };
let started: HTMLMediaElement[];

beforeEach(() => {
  built.length = 0;
  resetBlessedAudio();
  started = [];
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
    started.push(this);
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("GaplessEngine plays through elements started in the tap", () => {
  it("unlock() in the tap, load() after the lookup: the track's element was started in the tap", async () => {
    const engine = new GaplessEngine(cb);
    engine.unlock(); // the tap
    const inTap = [...started];
    expect(inTap.length).toBeGreaterThan(0);
    await flush(); // ...the Archive lookup...
    engine.load([{ slotId: "s1", url: "https://archive.org/download/x/a.mp3" }, { slotId: "s2", url: "https://archive.org/download/x/b.mp3" }], 0, true);
    await vi.waitFor(() => expect(built).toHaveLength(2));
    expect(inTap).toContain(built[0]);
    expect(inTap).toContain(built[1]);
  });

  it("append() also draws from the pool", async () => {
    const engine = new GaplessEngine(cb);
    engine.unlock();
    const inTap = [...started];
    engine.load([{ slotId: "s1", url: "https://archive.org/download/x/a.mp3" }], 0, true);
    engine.append({ slotId: "s2", url: "https://archive.org/download/x/b.mp3" });
    await vi.waitFor(() => expect(built).toHaveLength(2));
    expect(inTap).toContain(built[1]);
  });

  it("with no tap at all the engine still works, on ordinary elements", async () => {
    const engine = new GaplessEngine(cb);
    engine.load([{ slotId: "s1", url: "https://archive.org/download/x/a.mp3" }], 0, true);
    await vi.waitFor(() => expect(built).toHaveLength(1));
    expect(built[0]).toBeInstanceOf(HTMLAudioElement);
    expect(started).not.toContain(built[0]);
  });
});

import { errorTrackIndex } from "@/lib/player/gaplessEngine";

describe("errorTrackIndex", () => {
  it("reads the failing track from gapless's element error", () => {
    expect(errorTrackIndex(new Error("HTML5 audio error on track 3 (code 4): MEDIA_ERR_SRC_NOT_SUPPORTED"))).toBe(3);
    expect(errorTrackIndex(new Error("HTML5 audio error on track 0 (code 2): network"))).toBe(0);
  });
  it("is null for an error that names no track — a play() rejection is about the current one", () => {
    expect(errorTrackIndex(new DOMException("The operation is not supported.", "NotSupportedError"))).toBeNull();
    expect(errorTrackIndex("boom")).toBeNull();
  });
});

describe("the playback method", () => {
  // The fake queue records its options; gapless 4 reads playbackMethod and
  // ignores the old webAudioIsDisabled entirely, so that option proves nothing.
  const optsOf = async (ua: string) => {
    const desc = Object.getOwnPropertyDescriptor(window.navigator, "userAgent");
    Object.defineProperty(window.navigator, "userAgent", { value: ua, configurable: true });
    try {
      const { GaplessEngine: E } = await import("@/lib/player/gaplessEngine");
      const engine = new E(cb);
      engine.load([{ slotId: "s", url: "https://archive.org/download/x/a.mp3" }], 0, true);
      await vi.waitFor(() => expect(built.length).toBeGreaterThan(0));
      return lastOpts();
    } finally {
      if (desc) Object.defineProperty(window.navigator, "userAgent", desc);
    }
  };
  it("is HTML5_ONLY on an iPhone — no full-file download beside the stream, no mid-song hand-off", async () => {
    const o = await optsOf("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1");
    expect(o.playbackMethod).toBe("HTML5_ONLY");
  });
  it("stays HYBRID on a desktop, where the segue is sample-accurate", async () => {
    const o = await optsOf("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130 Safari/537.36");
    expect(o.playbackMethod).toBe("HYBRID");
  });
});

describe("GaplessEngine releases a replaced tape", () => {
  it("a new load stops the old tape's download: its element loses its src", async () => {
    const engine = new GaplessEngine(cb);
    engine.unlock();
    engine.load([{ slotId: "slow", url: "https://archive.org/download/x/slow.mp3" }], 0, true);
    await vi.waitFor(() => expect(built).toHaveLength(1));
    const old = built[0];
    old.src = "https://ia800.us.archive.org/1/items/x/slow.mp3";
    engine.load([{ slotId: "planb", url: "https://archive.org/download/y/sure.mp3" }], 0, true);
    await vi.waitFor(() => expect(built).toHaveLength(2));
    expect(old.hasAttribute("src")).toBe(false);
    expect(built[1]).not.toBe(old);
  });
});
