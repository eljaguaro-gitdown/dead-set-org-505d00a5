import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  blessAudioElements,
  withBlessedAudio,
  blessedPoolSize,
  blessedAudioStats,
  resetBlessedAudio,
  BLESSED_POOL_SIZE,
} from "@/lib/player/blessedAudio";

/**
 * iOS lets an element play only if play() was called on THAT element in a
 * gesture. These pin the two halves: elements are started inside the tap,
 * and `new Audio()` inside withBlessedAudio returns them.
 */
let playSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  resetBlessedAudio();
  playSpy = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe("blessAudioElements", () => {
  it("starts a pool of elements synchronously, in the caller's task", () => {
    blessAudioElements();
    // Synchronous: the plays happened before any await could end the gesture.
    expect(playSpy).toHaveBeenCalledTimes(BLESSED_POOL_SIZE);
    expect(blessedPoolSize()).toBe(BLESSED_POOL_SIZE);
  });

  it("tops the pool up rather than growing it on every tap", () => {
    blessAudioElements();
    blessAudioElements();
    expect(playSpy).toHaveBeenCalledTimes(BLESSED_POOL_SIZE);
    withBlessedAudio(() => new Audio());
    blessAudioElements();
    expect(playSpy).toHaveBeenCalledTimes(BLESSED_POOL_SIZE + 1);
  });

  it("survives a browser that refuses even the silent play", () => {
    playSpy.mockImplementation(() => Promise.reject(new DOMException("no", "NotAllowedError")));
    expect(() => blessAudioElements(2)).not.toThrow();
    expect(blessedPoolSize()).toBe(2);
  });
});

describe("withBlessedAudio", () => {
  it("hands out the very elements started in the tap", () => {
    blessAudioElements(2);
    const started = playSpy.mock.instances.slice() as HTMLAudioElement[];
    const a = withBlessedAudio(() => new Audio());
    const b = withBlessedAudio(() => new Audio("https://archive.org/download/x/y.mp3"));
    expect(started).toContain(a);
    expect(started).toContain(b);
    expect(a).not.toBe(b);
    expect(b.src).toBe("https://archive.org/download/x/y.mp3");
    // The silent WAV is gone from the adopted element.
    expect(a.getAttribute("src")).toBeNull();
    expect(a).toBeInstanceOf(HTMLAudioElement);
  });

  it("falls back to an ordinary element when the pool is empty — never worse than before", () => {
    const el = withBlessedAudio(() => new Audio());
    expect(el).toBeInstanceOf(HTMLAudioElement);
    expect(blessedAudioStats().fellBack).toBe(1);
  });

  it("puts window.Audio back, even when the callback throws", () => {
    const Native = window.Audio;
    expect(() => withBlessedAudio(() => { throw new Error("boom"); })).toThrow("boom");
    expect(window.Audio).toBe(Native);
    blessAudioElements(1);
    withBlessedAudio(() => new Audio());
    expect(window.Audio).toBe(Native);
  });

  it("only swaps inside the call: an Audio made outside never takes a pooled element", () => {
    blessAudioElements(1);
    const outside = new Audio();
    expect(blessedPoolSize()).toBe(1);
    expect(playSpy.mock.instances).not.toContain(outside);
  });
});
