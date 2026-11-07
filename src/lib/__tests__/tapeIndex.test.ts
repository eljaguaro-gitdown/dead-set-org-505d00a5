import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The client half of the tape index. A query builder that FILTERS (so a
 * wrong .eq() is caught — CLAUDE.md on mocks that prove only that code ran)
 * and records every call.
 */
const db = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  calls: [] as string[],
  delayMs: 0,
  fail: false,
}));
vi.mock("@/integrations/supabase/client", () => {
  const builder = () => {
    const filters: Array<(r: Record<string, unknown>) => boolean> = [];
    let lim = Infinity;
    const q: Record<string, unknown> = {
      select: (cols: string) => { db.calls.push(`select ${cols}`); return q; },
      eq: (c: string, v: unknown) => { db.calls.push(`eq ${c}=${v}`); filters.push((r) => r[c] === v); return q; },
      in: (c: string, vs: unknown[]) => { db.calls.push(`in ${c}`); filters.push((r) => vs.includes(r[c])); return q; },
      limit: (n: number) => { lim = n; return q; },
      then: (res: (v: unknown) => void, rej: (e: unknown) => void) =>
        new Promise((r) => setTimeout(r, db.delayMs)).then(() =>
          db.fail ? { data: null, error: { message: "no such table" } } : { data: db.rows.filter((r) => filters.every((f) => f(r))).slice(0, lim), error: null },
        ).then(res, rej),
    };
    return q;
  };
  return { supabase: { from: (t: string) => { db.calls.push(`from ${t}`); return builder(); } } };
});
const archive = vi.hoisted(() => ({ findRecordingForDate: vi.fn(), findArchiveRecording: vi.fn() }));
vi.mock("@/lib/archiveOrg", async (orig) => ({
  ...(await orig<typeof import("@/lib/archiveOrg")>()),
  findRecordingForDate: archive.findRecordingForDate,
  findArchiveRecording: archive.findArchiveRecording,
}));

import { askIndex, findNight, findSongDefault, prefetchNights, resetTapeIndex, streamUrlFor, INDEX_BUDGET_MS } from "@/lib/tapeIndex";
import { archiveMirrorUrls, resetArchiveMirrors } from "@/lib/archiveOrg";

const S = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const row = (o: Record<string, unknown>) => ({
  song_id: S, show_date: "1971-02-18", identifier: "gd71", status: "playable", is_default: true, is_song_default: false,
  track_url: "https://archive.org/download/gd71/t01.mp3", servers: ["https://ia800107.us.archive.org/1/items/gd71"], file_name: "t01.mp3", duration_s: 300, ...o,
});

const fetchSpy = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: true }) as Response);
beforeEach(() => {
  resetTapeIndex(); resetArchiveMirrors();
  db.rows = []; db.calls = []; db.delayMs = 0; db.fail = false;
  archive.findRecordingForDate.mockReset(); archive.findArchiveRecording.mockReset();
  fetchSpy.mockClear(); vi.stubGlobal("fetch", fetchSpy);
  vi.stubEnv("VITE_SUPABASE_URL", "https://proj.supabase.co");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "anon-key");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("askIndex", () => {
  it("a hit carries the track, the item, and a stream address on the item's own server", async () => {
    db.rows = [row({})];
    const a = await askIndex(S, "1971-02-18");
    expect(a).toEqual({ kind: "hit", result: expect.objectContaining({
      url: "https://archive.org/details/gd71",
      directTrackUrl: "https://archive.org/download/gd71/t01.mp3",
      streamUrl: "https://ia800107.us.archive.org/1/items/gd71/t01.mp3",
    }) });
    // It asked for THIS song on THIS night.
    expect(db.calls).toEqual(expect.arrayContaining(["from tape_index", `eq song_id=${S}`, "eq show_date=1971-02-18"]));
  });

  it("primes failover with the item's servers, so a dead stream needs no metadata read", async () => {
    db.rows = [row({ servers: ["https://ia800107.us.archive.org/1/items/gd71", "https://ia600107.us.archive.org/1/items/gd71"] })];
    await askIndex(S, "1971-02-18");
    const m = await archiveMirrorUrls("https://archive.org/download/gd71/t01.mp3");
    expect(m.urls).toEqual(["https://ia800107.us.archive.org/1/items/gd71/t01.mp3", "https://ia600107.us.archive.org/1/items/gd71/t01.mp3"]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("a night the index knows has no tape is an answer, not a miss", async () => {
    db.rows = [row({ identifier: "", status: "no_tape", track_url: null, servers: [] })];
    expect(await askIndex(S, "1971-02-18")).toEqual({ kind: "none", why: "no_tape" });
    db.rows = [row({ show_date: "1977-04-27", identifier: "", status: "no_match", track_url: null, servers: [] })];
    expect(await askIndex(S, "1977-04-27")).toEqual({ kind: "none", why: "no_match" });
  });

  it("another song's row on the same night is not this song's answer", async () => {
    db.rows = [row({ song_id: OTHER })];
    expect(await askIndex(S, "1971-02-18")).toEqual({ kind: "miss" });
  });

  it("a miss asks index-tapes to fill the night in — once", async () => {
    await askIndex(S, "1971-02-18");
    await askIndex(S, "1971-02-18");
    const posts = fetchSpy.mock.calls.filter((c) => String(c[0]).includes("/functions/v1/index-tapes"));
    expect(posts).toHaveLength(1);
    expect(JSON.parse(String((posts[0][1] as RequestInit).body))).toEqual({ song_id: S, show_date: "1971-02-18" });
  });

  it("prefers the recording the slot names, and does not substitute another for it", async () => {
    db.rows = [row({}), row({ identifier: "stored", is_default: false, track_url: "https://archive.org/download/stored/x.mp3", servers: [] })];
    const own = await askIndex(S, "1971-02-18", "stored");
    expect(own.kind === "hit" && own.result.directTrackUrl).toBe("https://archive.org/download/stored/x.mp3");
    expect(own.kind === "hit" && own.result.streamUrl).toBeNull(); // no servers known: the redirect
    // A named recording the index has not read is a miss — never the night's default instead.
    expect(await askIndex(S, "1971-02-18", "unread")).toEqual({ kind: "miss" });
  });

  it("an index slower than its budget is a miss, not a wait", async () => {
    db.rows = [row({})];
    db.delayMs = INDEX_BUDGET_MS + 400;
    const t0 = Date.now();
    expect(await askIndex(S, "1971-02-18")).toEqual({ kind: "miss" });
    expect(Date.now() - t0).toBeLessThan(INDEX_BUDGET_MS + 300);
  });

  it("an unreadable index (no table yet) is a miss and is asked again next time", async () => {
    db.fail = true;
    expect(await askIndex(S, "1971-02-18")).toEqual({ kind: "miss" });
    db.fail = false; db.rows = [row({})];
    expect((await askIndex(S, "1971-02-18")).kind).toBe("hit");
  });

  it("a synthetic song id or a missing night never queries", async () => {
    expect(await askIndex("picker-song", "1971-02-18")).toEqual({ kind: "miss" });
    expect(await askIndex(S, null)).toEqual({ kind: "miss" });
    expect(db.calls).toEqual([]);
  });
});

describe("findNight keeps findRecordingForDate's contract", () => {
  it("a hit never asks the Archive", async () => {
    db.rows = [row({})];
    const r = await findNight("Bertha", "1971-02-18", S);
    expect(r?.directTrackUrl).toBe("https://archive.org/download/gd71/t01.mp3");
    expect(archive.findRecordingForDate).not.toHaveBeenCalled();
  });
  it("an indexed no-tape night resolves null without asking the Archive", async () => {
    db.rows = [row({ identifier: "", status: "no_tape", track_url: null, servers: [] })];
    expect(await findNight("Bertha", "1971-02-18", S)).toBeNull();
    expect(archive.findRecordingForDate).not.toHaveBeenCalled();
  });
  it("a miss falls through to the live lookup, and its THROW still escapes (could not ask ≠ no tape)", async () => {
    archive.findRecordingForDate.mockRejectedValue(new Error("archive.org search 503"));
    await expect(findNight("Bertha", "1971-02-18", S)).rejects.toThrow("503");
  });
  it("without a song id it is exactly the live lookup", async () => {
    archive.findRecordingForDate.mockResolvedValue(null);
    expect(await findNight("Bertha", "1971-02-18")).toBeNull();
    expect(archive.findRecordingForDate).toHaveBeenCalledWith("Bertha", "1971-02-18");
  });
});

describe("findSongDefault", () => {
  it("uses the indexed undated answer, and only it", async () => {
    db.rows = [row({ is_default: false }), row({ show_date: "1972-08-27", identifier: "best", is_song_default: true, track_url: "https://archive.org/download/best/b.mp3" })];
    const r = await findSongDefault("Bertha", S);
    expect(r?.directTrackUrl).toBe("https://archive.org/download/best/b.mp3");
    expect(archive.findArchiveRecording).not.toHaveBeenCalled();
  });
  it("falls back to the generic search when the song has none", async () => {
    archive.findArchiveRecording.mockResolvedValue(null);
    expect(await findSongDefault("Bertha", S)).toBeNull();
    expect(archive.findArchiveRecording).toHaveBeenCalledWith("Bertha");
  });
});

describe("prefetchNights", () => {
  it("warms several nights in one request, and the tap then reads from memory", async () => {
    db.rows = [row({}), row({ show_date: "1995-06-27", identifier: "late", track_url: "https://archive.org/download/late/x.mp3" })];
    prefetchNights([{ songId: S, showDate: "1971-02-18" }, { songId: S, showDate: "1995-06-27" }]);
    const before = db.calls.filter((c) => c === "from tape_index").length;
    const a = await askIndex(S, "1995-06-27");
    expect(a.kind === "hit" && a.result.directTrackUrl).toBe("https://archive.org/download/late/x.mp3");
    expect(db.calls.filter((c) => c === "from tape_index").length).toBe(before);
    expect(before).toBe(1);
  });
});

describe("streamUrlFor", () => {
  it("joins the first server root with the file, keeping its encoding", () => {
    expect(streamUrlFor({ servers: ["https://ia1.us.archive.org/1/items/x"], track_url: "https://archive.org/download/x/04%20Sugaree.mp3" }))
      .toBe("https://ia1.us.archive.org/1/items/x/04%20Sugaree.mp3");
    expect(streamUrlFor({ servers: [], track_url: "https://archive.org/download/x/a.mp3" })).toBeNull();
  });
});
