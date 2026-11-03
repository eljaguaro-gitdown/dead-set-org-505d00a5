import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { archiveMirrorUrls, resetArchiveMirrors } from "@/lib/archiveOrg";

/**
 * The item's own servers, for a track whose /download/ redirect landed on a
 * failing mirror. Measured on 2026-10-31 against Jack Straw 10/19/71: the
 * redirect went to dn720308.ca.archive.org about 11 of 12 times and that
 * mirror answered 500, while the servers the metadata API lists answered 206
 * every time. No live network here: fetch is stubbed throughout.
 */

const ID = "gd71-10-19.orefm.clugston.3301.sbeok.shnf";
const FILE = "gd71-10-19d1t09.mp3";
const TRACK = `https://archive.org/download/${ID}/${FILE}`;
const DIR = `/31/items/${ID}`;
const META = {
  d1: "ia600906.us.archive.org",
  d2: "ia800906.us.archive.org",
  dir: DIR,
  server: "ia800906.us.archive.org",
  workable_servers: ["ia600906.us.archive.org", "ia800906.us.archive.org"],
  files: [{ name: FILE, title: "Jack Straw" }],
};

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as unknown as Response;
const status = (code: number) => ({ ok: false, status: code, json: async () => ({}) }) as unknown as Response;

const fetchMock = vi.fn<(url: string) => Promise<Response>>();
const metadataCalls = () => fetchMock.mock.calls.filter(([u]) => String(u).startsWith("https://archive.org/metadata/"));

beforeEach(() => {
  resetArchiveMirrors();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("archiveMirrorUrls", () => {
  it("lists the item's own servers in the order the Archive gives them, each with the item's dir", async () => {
    fetchMock.mockResolvedValue(ok(META));
    const found = await archiveMirrorUrls(TRACK);
    expect(found).toEqual({
      urls: [
        `https://ia600906.us.archive.org${DIR}/${FILE}`,
        `https://ia800906.us.archive.org${DIR}/${FILE}`,
      ],
      unreachable: false,
    });
    expect(metadataCalls()).toEqual([[`https://archive.org/metadata/${ID}`, expect.anything()]]);
  });

  it("workable_servers wins over d1 when the two disagree, as they did for this item on 2026-10-31", async () => {
    // Read live that day: workable_servers named ia800906 first, d1 ia600906.
    fetchMock.mockResolvedValue(ok({ ...META, workable_servers: ["ia800906.us.archive.org", "ia600906.us.archive.org"] }));
    const { urls } = await archiveMirrorUrls(TRACK);
    expect(urls).toEqual([
      `https://ia800906.us.archive.org${DIR}/${FILE}`,
      `https://ia600906.us.archive.org${DIR}/${FILE}`,
    ]);
  });

  it("falls back to d1, d2 and server when the item has no workable_servers, without repeats", async () => {
    fetchMock.mockResolvedValue(ok({ ...META, workable_servers: undefined, d1: "ia800906.us.archive.org", d2: "ia600906.us.archive.org" }));
    const { urls } = await archiveMirrorUrls(TRACK);
    expect(urls).toEqual([
      `https://ia800906.us.archive.org${DIR}/${FILE}`,
      `https://ia600906.us.archive.org${DIR}/${FILE}`,
    ]);
  });

  it("uses `server` when it is the only host the item names", async () => {
    fetchMock.mockResolvedValue(ok({ dir: DIR, server: "ia800906.us.archive.org" }));
    const { urls } = await archiveMirrorUrls(TRACK);
    expect(urls).toEqual([`https://ia800906.us.archive.org${DIR}/${FILE}`]);
  });

  it("never offers a host outside archive.org, whatever the response says", async () => {
    fetchMock.mockResolvedValue(ok({
      ...META,
      workable_servers: [
        "evil.example.com",
        "archive.org.evil.com",
        "ia600906.us.archive.org.evil.com",
        "evil-archive-org",
        "ia600906.us.archive.org",
        42,
      ],
      d1: "https://ia800906.us.archive.org",
      d2: null,
      server: undefined,
    }));
    const { urls } = await archiveMirrorUrls(TRACK);
    expect(urls).toEqual([`https://ia600906.us.archive.org${DIR}/${FILE}`]);
  });

  it("keeps the file part as it was written, already encoded", async () => {
    fetchMock.mockResolvedValue(ok(META));
    const encoded = `https://archive.org/download/${ID}/gd71-10-19%20d1t09.mp3`;
    const { urls } = await archiveMirrorUrls(encoded);
    expect(urls[0]).toBe(`https://ia600906.us.archive.org${DIR}/gd71-10-19%20d1t09.mp3`);
  });

  it("asks once per item for the session: another file of the same tape reuses the answer", async () => {
    fetchMock.mockResolvedValue(ok(META));
    await archiveMirrorUrls(TRACK);
    const other = await archiveMirrorUrls(`https://archive.org/download/${ID}/gd71-10-19d1t10.mp3`);
    expect(metadataCalls()).toHaveLength(1);
    expect(other.urls[0]).toBe(`https://ia600906.us.archive.org${DIR}/gd71-10-19d1t10.mp3`);
  });

  it("a metadata request that rejects is unreachable, after one retry, and is not remembered", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await archiveMirrorUrls(TRACK)).toEqual({ urls: [], unreachable: true });
    expect(metadataCalls()).toHaveLength(2);
    fetchMock.mockReset().mockResolvedValue(ok(META));
    const later = await archiveMirrorUrls(TRACK);
    expect(later.unreachable).toBe(false);
    expect(later.urls).toHaveLength(2);
  });

  it("a metadata 5xx is a resolved promise, and still unreachable, after one retry, and not remembered", async () => {
    fetchMock.mockResolvedValue(status(503));
    expect(await archiveMirrorUrls(TRACK)).toEqual({ urls: [], unreachable: true });
    expect(metadataCalls()).toHaveLength(2);
    fetchMock.mockReset().mockResolvedValue(ok(META));
    expect((await archiveMirrorUrls(TRACK)).urls).toHaveLength(2);
  });

  it("a plain 500, the status the sick mirror's metadata could answer with, is unreachable too", async () => {
    fetchMock.mockResolvedValue(status(500));
    expect(await archiveMirrorUrls(TRACK)).toEqual({ urls: [], unreachable: true });
    expect(metadataCalls()).toHaveLength(2);
  });

  it("a body that stops arriving is given up on, not waited for forever", async () => {
    // fetch()'s abort timer is cleared once the headers arrive, so a stalled
    // body used to leave the lookup, and the bar's busy state, pending for good.
    vi.useFakeTimers();
    try {
      fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => new Promise(() => undefined) } as unknown as Response);
      let answer: unknown = null;
      void archiveMirrorUrls(TRACK).then((r) => { answer = r; });
      await vi.advanceTimersByTimeAsync(11_000);
      expect(answer).toBeNull();
      await vi.advanceTimersByTimeAsync(20_000); // 12s, the retry's 0.6s wait, 12s again
      expect(answer).toEqual({ urls: [], unreachable: true });
      expect(metadataCalls()).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a 429 is the Archive asking us to slow down, not an answer", async () => {
    fetchMock.mockResolvedValue(status(429));
    expect(await archiveMirrorUrls(TRACK)).toEqual({ urls: [], unreachable: true });
  });

  it("one 5xx then an answer is the answer", async () => {
    fetchMock.mockResolvedValueOnce(status(502)).mockResolvedValueOnce(ok(META));
    const found = await archiveMirrorUrls(TRACK);
    expect(found.unreachable).toBe(false);
    expect(found.urls).toHaveLength(2);
  });

  it("a body that is not JSON is unreachable, not an empty item", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => { throw new SyntaxError("Unexpected token <"); } } as unknown as Response);
    expect(await archiveMirrorUrls(TRACK)).toEqual({ urls: [], unreachable: true });
  });

  it("a 404 is an answer: no such item, so no servers, remembered", async () => {
    fetchMock.mockResolvedValue(status(404));
    expect(await archiveMirrorUrls(TRACK)).toEqual({ urls: [], unreachable: false });
    expect(metadataCalls()).toHaveLength(1);
    await archiveMirrorUrls(TRACK);
    expect(metadataCalls()).toHaveLength(1);
  });

  it("an item with no usable dir has no servers to offer", async () => {
    fetchMock.mockResolvedValue(ok({ ...META, dir: "items/no-leading-slash" }));
    expect(await archiveMirrorUrls(TRACK)).toEqual({ urls: [], unreachable: false });
  });

  it("only a /download/ track has servers to look up, and nothing is asked for anything else", async () => {
    for (const url of [
      `https://archive.org/details/${ID}`,
      `https://ia600906.us.archive.org${DIR}/${FILE}`,
      `http://archive.org/download/${ID}/${FILE}`,
      `https://archive.org/download/${ID}/${FILE}?x=1`,
    ]) {
      expect(await archiveMirrorUrls(url)).toEqual({ urls: [], unreachable: false });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
