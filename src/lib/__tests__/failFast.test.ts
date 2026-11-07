import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ARCHIVE_TIMEOUT_MS,
  RANK_GRACE_MS,
  rankedBatch,
  findRecordingForDate,
  findTrackInRecordingDetailed,
} from "@/lib/archiveOrg";

/**
 * Fail fast, and never trade honesty for speed: a lookup that runs out of
 * time is "could not ask" (a throw / unreachable), never "no tape".
 */
const hit = (n: string) => ({ hit: n });
const miss = { hit: null };
const later = <T,>(ms: number, v: T) => new Promise<T>((r) => setTimeout(() => r(v), ms));
const never = <T,>() => new Promise<T>(() => undefined);

describe("rankedBatch", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("the best-ranked hit wins when everything above it has answered", async () => {
    let out: unknown;
    void rankedBatch([later(100, miss), later(50, hit("b")), later(10, hit("c"))], RANK_GRACE_MS).then((r) => { out = r; });
    await vi.advanceTimersByTimeAsync(101);
    expect((out as Array<{ hit: unknown }>).find((r) => r?.hit)?.hit).toBe("b");
  });

  it("a hung better-ranked tape is waited for only the grace, not its full timeout", async () => {
    let out: unknown;
    void rankedBatch([never<{ hit: unknown }>(), later(20, hit("second"))], RANK_GRACE_MS).then((r) => { out = r; });
    await vi.advanceTimersByTimeAsync(RANK_GRACE_MS - 10);
    expect(out).toBeUndefined();
    await vi.advanceTimersByTimeAsync(20);
    expect((out as Array<{ hit: unknown } | undefined>)[1]?.hit).toBe("second");
    expect((out as Array<unknown>)[0]).toBeUndefined(); // unanswered: no claim about it
  });

  it("a better-ranked hit that answers inside the grace still wins", async () => {
    let out: unknown;
    void rankedBatch([later(RANK_GRACE_MS - 100, hit("first")), later(10, hit("second"))], RANK_GRACE_MS).then((r) => { out = r; });
    await vi.advanceTimersByTimeAsync(RANK_GRACE_MS);
    expect((out as Array<{ hit: unknown }>)[0].hit).toBe("first");
  });

  it("with no hit at all it waits for every answer", async () => {
    let out: unknown;
    void rankedBatch([later(3000, miss), later(10, miss)], RANK_GRACE_MS).then((r) => { out = r; });
    await vi.advanceTimersByTimeAsync(2000);
    expect(out).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1001);
    expect(out).toEqual([miss, miss]);
  });
});

describe("one night's lookup has a ceiling", () => {
  const json = (b: unknown) => ({ ok: true, status: 200, json: async () => b }) as unknown as Response;
  // A fetch that honours its AbortSignal, as the real one does.
  const hang = (_u: string, init?: RequestInit) =>
    new Promise<Response>((_, rej) => init?.signal?.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError"))));

  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: false }));
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("a night whose every tape hangs throws (could not ask) within the budget — it is never 'no tape'", async () => {
    const docs = Array.from({ length: 10 }, (_, i) => ({ identifier: `t${i}`, date: "1977-05-10T00:00:00Z" }));
    vi.stubGlobal("fetch", vi.fn((u: string, init?: RequestInit) =>
      String(u).includes("advancedsearch") ? Promise.resolve(json({ response: { docs } })) : hang(u, init)));
    let err: unknown = null;
    let value: unknown = "pending";
    void findRecordingForDate("Bertha", "1977-05-10").then((v) => { value = v; }, (e) => { err = e; });
    await vi.advanceTimersByTimeAsync(12_000);
    expect(value).toBe("pending");
    expect(String(err)).toMatch(/unreadable|ArchiveUnreachable/);
  });

  it("a .flac16 name that answers first still wins over the base name", async () => {
    vi.stubGlobal("fetch", vi.fn((u: string) =>
      Promise.resolve(json({ files: [{ name: /flac16$/.test(String(u)) ? "s.mp3" : "b.mp3", title: "Bertha", format: "VBR MP3" }] }))));
    let r: unknown = null;
    void findTrackInRecordingDetailed("https://archive.org/details/gd77.flac16", "Bertha").then((v) => { r = v; });
    await vi.advanceTimersByTimeAsync(10);
    expect(r).toEqual({ url: "https://archive.org/download/gd77.flac16/s.mp3", unreachable: false });
  });

  it("a .flac16 tape whose suffixed name hangs is read from its base name without waiting it out", async () => {
    vi.stubGlobal("fetch", vi.fn((u: string, init?: RequestInit) =>
      /metadata\/gd77\.flac16$/.test(String(u)) ? hang(u, init)
        : Promise.resolve(json({ files: [{ name: "b.mp3", title: "Bertha", format: "VBR MP3" }] }))));
    let r: unknown = null;
    void findTrackInRecordingDetailed("https://archive.org/details/gd77.flac16", "Bertha").then((v) => { r = v; });
    // Previously: 4s timeout, 0.6s retry wait, 4s again, THEN the base name
    // (8.6 s). Now: the grace, and the base name's answer is taken.
    await vi.advanceTimersByTimeAsync(RANK_GRACE_MS + 50);
    expect(r).toEqual({ url: "https://archive.org/download/gd77/b.mp3", unreachable: false });
    expect(RANK_GRACE_MS + 50).toBeLessThan(ARCHIVE_TIMEOUT_MS);
  });
});
