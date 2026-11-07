import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The engine side of the iOS fix: the element gapless builds for a track in
 * addTrack — which runs after the Archive lookup, long after the tap — must be
 * one of the elements started IN the tap (GaplessEngine.unlock).
 */
const { built } = vi.hoisted(() => ({ built: [] as HTMLAudioElement[] }));
vi.mock("gapless", () => {
  class FakeQueue {
    constructor(_opts: unknown) {}
    // Exactly what gapless's Track constructor does: `new Audio()`.
    addTrack = vi.fn(() => { built.push(new Audio()); });
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
