import { afterEach, describe, expect, it, vi } from "vitest";
import { findRecordingForDate } from "@/lib/archiveOrg";

/**
 * A night usually has many tapes. The by-date lookup asks for ten, ordered
 * most-downloaded first, and walks them until one carries the song — so an
 * unreadable tape costs only its own turn.
 *
 * The distinction these tests pin: passing over a tape because it HAS NO
 * TRACK is a finding about that tape, and passing over it because we COULD
 * NOT READ IT is not a finding at all. Collapsing both into null let a run of
 * 5xx responses be cached as "no tape of this night circulates" for the whole
 * session, which is the inversion CLAUDE.md forbids. The search leg was
 * already armoured against it; the metadata leg was not.
 *
 * Every mock here REJECTS or returns a failure status, not just an empty
 * result — a suite whose fetches only ever resolve cannot tell the two apart.
 */
const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

/**
 * The night searched for must match the night the docs claim: the lookup
 * drops any doc whose date is not the same day. An earlier draft of this file
 * hardcoded one date here and three tests "failed" because their docs were
 * filtered out before the code under test ever ran.
 */
const search = (day: string, ...ids: string[]) =>
  json({ response: { docs: ids.map((identifier) => ({ identifier, date: `${day}T00:00:00Z`, venue: "Roscoe Maples Pavilion" })) } });

/** A readable tape whose tracks are exactly `titles`. */
const tape = (titles: string[]) =>
  json({
    metadata: { venue: "Roscoe Maples Pavilion" },
    files: titles.map((title, i) => ({ name: `t${i}.mp3`, title, format: "VBR MP3" })),
  });

afterEach(() => vi.unstubAllGlobals());

describe("walking candidate recordings", () => {
  it("falls through an unreadable tape to the next one, which has the song", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(search("1973-02-09", "tape-a", "tape-b"))
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))   // tape-a unreadable
      .mockResolvedValueOnce(tape(["Here Comes Sunshine"]));          // tape-b has it
    vi.stubGlobal("fetch", fetchMock);

    const r = await findRecordingForDate("Here Comes Sunshine", "1973-02-09");
    expect(r?.directTrackUrl).toContain("tape-b");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("falls through a tape that simply lacks the song", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(search("1973-02-09", "tape-a", "tape-b"))
      .mockResolvedValueOnce(tape(["Dark Star", "El Paso"]))
      .mockResolvedValueOnce(tape(["Row Jimmy"]));
    vi.stubGlobal("fetch", fetchMock);

    const r = await findRecordingForDate("Row Jimmy", "1973-02-09");
    expect(r?.directTrackUrl).toContain("tape-b");
  });

  it("THROWS when no tape matched and any candidate was unreadable", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(search("1973-02-09", "tape-a", "tape-b"))
      .mockResolvedValueOnce(tape(["Dark Star"]))                      // read, no match
      .mockRejectedValueOnce(new TypeError("network down")));          // never learned
    await expect(findRecordingForDate("Unestablished Song", "1973-02-09")).rejects.toThrow(/unreadable/i);
  });

  it("does not cache that throw — the night is asked again", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(search("1974-02-22", "tape-a"))
      .mockRejectedValueOnce(new TypeError("network down"))
      .mockResolvedValueOnce(search("1974-02-22", "tape-a"))
      .mockResolvedValueOnce(tape(["Loose Lucy"]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(findRecordingForDate("Loose Lucy", "1974-02-22")).rejects.toThrow();
    const r = await findRecordingForDate("Loose Lucy", "1974-02-22");
    expect(r?.directTrackUrl).toContain("tape-a");
  });

  it("still reports the night when EVERY candidate was read and none had the song", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(search("1973-02-09", "tape-a", "tape-b"))
      .mockResolvedValueOnce(tape(["Dark Star"]))
      .mockResolvedValueOnce(tape(["El Paso"])));

    const r = await findRecordingForDate("Absent Song", "1973-02-09");
    expect(r).not.toBeNull();
    expect(r?.directTrackUrl).toBeNull();   // the night circulates; the song is not on it
  });

  it("an item that no longer exists answers {} and counts as read, not unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(search("1972-04-08", "gone-identifier"))
      .mockResolvedValueOnce(json({})));                               // the Wembley case

    const r = await findRecordingForDate("Vanished Tape Song", "1972-04-08");
    expect(r?.directTrackUrl).toBeNull();   // established, so cacheable — not a throw
  });

  it("accepts a FLAC-only tape, which the old private copy of the loop could not see", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(search("1974-03-23", "flac-only"))
      .mockResolvedValueOnce(json({
        metadata: {},
        files: [{ name: "d1t04.flac", title: "Scarlet Begonias", format: "Flac" }],
      })));

    const r = await findRecordingForDate("Scarlet Begonias", "1974-03-23");
    expect(r?.directTrackUrl).toContain("d1t04.flac");
  });
});
