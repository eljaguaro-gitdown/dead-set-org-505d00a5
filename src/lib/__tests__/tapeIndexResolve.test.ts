import { describe, it, expect, vi } from "vitest";
import { resolveNight, parseLength } from "../../../supabase/functions/_shared/tapeIndexResolve.ts";

/**
 * The server-side resolver behind the tape index. Same question as the
 * player's by-night lookup, so the same three outcomes, plus the one rule
 * that matters most: a failure to ask is never stored as an answer.
 */
const S = "11111111-1111-4111-8111-111111111111";
const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body }) as unknown as Response;
const search = (...ids: string[]) => json({ response: { docs: ids.map((identifier) => ({ identifier, date: "1977-05-08T00:00:00Z" })) } });
const item = (files: Array<{ name: string; title?: string; format?: string; length?: string }>, extra: Record<string, unknown> = {}) =>
  json({ files, dir: "/1/items/x", workable_servers: ["ia800106.us.archive.org"], d1: "ia600106.us.archive.org", metadata: {}, ...extra });

const fake = (routes: Record<string, () => Response>) =>
  vi.fn(async (url: string) => {
    const key = Object.keys(routes).find((k) => url.includes(k));
    if (!key) throw new Error(`unrouted ${url}`);
    return routes[key]();
  });

describe("resolveNight", () => {
  it("indexes the first (most-downloaded) tape that carries the song, with its servers and length", async () => {
    const f = fake({
      advancedsearch: () => search("a", "b"),
      "metadata/a": () => item([{ name: "d1t01.mp3", title: "Bertha", format: "VBR MP3", length: "05:12" }]),
    });
    const r = await resolveNight(f, { songId: S, songTitle: "Bertha", showDate: "1977-05-08" });
    expect(r.unreachable).toBe(false);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({
      status: "playable", is_default: true, identifier: "a",
      track_url: "https://archive.org/download/a/d1t01.mp3",
      servers: ["https://ia800106.us.archive.org/1/items/x", "https://ia600106.us.archive.org/1/items/x"],
      duration_s: 312, match_score: 100,
    });
  });

  it("finds the song inside a medley track", async () => {
    const f = fake({
      advancedsearch: () => search("a"),
      "metadata/a": () => item([{ name: "d2t04.mp3", title: "Help On The Way > Slipknot! > Franklin's Tower", format: "VBR MP3" }]),
    });
    const r = await resolveNight(f, { songId: S, songTitle: "Slipknot!", showDate: "1977-05-08" });
    expect(r.rows[0]).toMatchObject({ status: "playable", identifier: "a" });
  });

  it("answers no_tape when the Archive lists no recording of the night", async () => {
    const f = fake({ advancedsearch: () => search() });
    const r = await resolveNight(f, { songId: S, songTitle: "Slipknot!", showDate: "1983-10-06" });
    expect(r).toMatchObject({ unreachable: false, rows: [{ status: "no_tape", identifier: "", is_default: true }] });
  });

  it("answers no_match when every tape was read and none carries the song", async () => {
    const f = fake({
      advancedsearch: () => search("a", "b"),
      "metadata/a": () => item([{ name: "x.mp3", title: "Scarlet Begonias" }]),
      "metadata/b": () => item([{ name: "y.mp3", title: "Fire On The Mountain" }]),
    });
    const r = await resolveNight(f, { songId: S, songTitle: "Slipknot!", showDate: "1977-05-08" });
    expect(r.rows).toEqual([expect.objectContaining({ status: "no_match", identifier: "", is_default: true })]);
  });

  it("stores NOTHING when a tape could not be read and none matched — a 5xx is not an answer", async () => {
    const f = fake({
      advancedsearch: () => search("a", "b"),
      "metadata/a": () => json({}, 503),
      "metadata/b": () => item([{ name: "y.mp3", title: "Fire On The Mountain" }]),
    });
    const r = await resolveNight(f, { songId: S, songTitle: "Slipknot!", showDate: "1977-05-08" });
    expect(r.unreachable).toBe(true);
    expect(r.rows.find((x) => x.status !== "playable")).toBeUndefined();
  });

  it("a search that fails is unreachable, never no_tape", async () => {
    const f = fake({ advancedsearch: () => json({}, 502) });
    const r = await resolveNight(f, { songId: S, songTitle: "Bertha", showDate: "1971-02-18" });
    expect(r).toMatchObject({ unreachable: true, rows: [] });
  });

  it("a rejected fetch is unreachable too, not just a failing status", async () => {
    const f = vi.fn(async () => { throw new TypeError("network down"); });
    const r = await resolveNight(f, { songId: S, songTitle: "Bertha", showDate: "1971-02-18" });
    expect(r.unreachable).toBe(true);
  });

  it("indexes a stored recording under its own identifier, and keeps the night's default separate", async () => {
    const f = fake({
      "metadata/stored": () => item([{ name: "s.mp3", title: "Bertha" }]),
      advancedsearch: () => search("best"),
      "metadata/best": () => item([{ name: "b.mp3", title: "Bertha" }]),
    });
    const r = await resolveNight(f, { songId: S, songTitle: "Bertha", showDate: "1977-05-08", storedIdentifier: "stored" });
    expect(r.rows.map((x) => [x.identifier, x.is_default])).toEqual([["stored", false], ["best", true]]);
  });

  it("when the stored recording IS the night's best, it is one row and the default", async () => {
    const f = fake({
      "metadata/a": () => item([{ name: "s.mp3", title: "Bertha" }]),
      advancedsearch: () => search("a"),
    });
    const r = await resolveNight(f, { songId: S, songTitle: "Bertha", showDate: "1977-05-08", storedIdentifier: "a" });
    expect(r.rows).toEqual([expect.objectContaining({ identifier: "a", is_default: true })]);
  });

  it("never reaches for a restricted original on a stream-only item", async () => {
    const f = fake({
      advancedsearch: () => search("a"),
      "metadata/a": () => item([{ name: "t.flac", title: "Bertha", format: "Flac" }], { metadata: { collection: ["stream_only"] } }),
    });
    const r = await resolveNight(f, { songId: S, songTitle: "Bertha", showDate: "1977-05-08" });
    expect(r.rows[0].status).toBe("no_match");
  });
});

describe("parseLength", () => {
  it.each([["312.45", 312.45], ["05:12", 312], ["1:02:03", 3723], ["", null], [undefined, null], ["abc", null]])("%s → %s", (raw, want) => {
    expect(parseLength(raw)).toBe(want);
  });
});

import { matchScore } from "../../../supabase/functions/_shared/tapeMatch.ts";

describe("suites filed under their own name", () => {
  it("finds Lady with a Fan in a track titled Terrapin Station — the 1977-02-26 debut", () => {
    expect(matchScore("Terrapin Station", "Lady with a Fan")).toBeGreaterThanOrEqual(60);
    expect(matchScore("Terrapin Station (First One!)", "Lady with a Fan")).toBeGreaterThanOrEqual(60);
    expect(matchScore("Terrapin Station > Playing in the Band", "Lady with a Fan")).toBeGreaterThanOrEqual(60);
  });
  it("a dedicated Lady With A Fan track still outranks the suite", () => {
    expect(matchScore("Lady With A Fan", "Lady with a Fan")).toBeGreaterThan(matchScore("Terrapin Station", "Lady with a Fan"));
  });
  it("does not run backwards: Terrapin Station is not found in a Lady with a Fan track", () => {
    expect(matchScore("Lady With A Fan", "Terrapin Station")).toBeLessThan(60);
  });
  it("never files a song that arrives LATER in a suite: Let It Grow is not the Weather Report Suite", () => {
    expect(matchScore("Weather Report Suite", "Let It Grow")).toBeLessThan(60);
  });
  it("a track that only mentions Terrapin later is not Lady with a Fan", () => {
    expect(matchScore("Estimated Prophet > Terrapin Station", "Lady with a Fan")).toBeLessThan(60);
  });
});

import { resolveSong } from "../../../supabase/functions/_shared/tapeIndexResolve.ts";

describe("resolveSong — the undated answer", () => {
  it("asks the same question as the player's generic search and flags the row", async () => {
    const f = fake({
      advancedsearch: () => json({ response: { docs: [{ identifier: "a", date: "1972-08-27T00:00:00Z" }] } }),
      "metadata/a": () => item([{ name: "t.mp3", title: "Bertha" }]),
    });
    const r = await resolveSong(f, { songId: S, songTitle: "Bertha" });
    const searchUrl = decodeURIComponent(String(f.mock.calls[0][0]));
    expect(searchUrl).toContain('collection:GratefulDead "Bertha"');
    expect(searchUrl).toContain("sort[]=avg_rating+desc");
    expect(r.rows).toEqual([expect.objectContaining({ show_date: "1972-08-27", identifier: "a", is_song_default: true, is_default: false })]);
  });
  it("stores nothing when no tape carries the song", async () => {
    const f = fake({
      advancedsearch: () => json({ response: { docs: [{ identifier: "a", date: "1972-08-27" }] } }),
      "metadata/a": () => item([{ name: "t.mp3", title: "Bertha" }]),
    });
    const r = await resolveSong(f, { songId: S, songTitle: "Slipknot!" });
    expect(r.rows).toEqual([]);
  });
});
