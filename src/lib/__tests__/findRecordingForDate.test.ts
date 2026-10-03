import { afterEach, describe, expect, it, vi } from "vitest";
import { findRecordingForDate } from "@/lib/archiveOrg";

/**
 * findRecordingForDate caches per song and day for the session. A miss is a
 * real answer and is cached; a failed request is not, so a 503 or a timeout
 * neither becomes "no tape of this night circulates" nor sticks for the
 * session. Each test uses its own song title to stay clear of the cache.
 */
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("findRecordingForDate", () => {
  it("throws on a failed search instead of answering 'no tape'", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("busy", { status: 503 })));
    await expect(findRecordingForDate("Failed Search Song", "1971-10-19")).rejects.toThrow();
  });

  it("does not cache a failure: the next lookup asks the Archive again", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(json({ response: { docs: [] } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(findRecordingForDate("Retry Song", "1972-05-11")).rejects.toThrow();
    await expect(findRecordingForDate("Retry Song", "1972-05-11")).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws when the request itself fails (network error or timeout)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("network down"); }));
    await expect(findRecordingForDate("Network Song", "1977-05-08")).rejects.toThrow();
  });

  it("still caches a real miss", async () => {
    const fetchMock = vi.fn(async () => json({ response: { docs: [] } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(findRecordingForDate("Untaped Song", "1966-01-08")).resolves.toBeNull();
    await expect(findRecordingForDate("Untaped Song", "1966-01-08")).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
