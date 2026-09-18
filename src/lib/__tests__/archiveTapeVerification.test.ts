import { describe, it, expect, vi, afterEach } from "vitest";
import { keepRecordingsContainingSong, type ArchiveVersion } from "@/lib/archiveOrg";

/**
 * Regression cover for the "Crazy gems 💎 74" bug.
 *
 * The archive.org search behind the version browser matches an item's *text*,
 * not its track list, so asking for Crazy Fingers in 1974 returned real 1974
 * shows that do not contain the song — it debuted in June 1975. Two of them
 * were added to a setlist and rendered with real dates and venues; one played
 * the wrong audio's error state, the other sat there marked "no tape".
 */

const version = (identifier: string): ArchiveVersion => ({
  identifier,
  url: `https://archive.org/details/${identifier}`,
  date: "1974-08-06",
  venue: "Roosevelt Stadium",
  avgRating: 5,
});

/** Minimal archive.org metadata payload with the given track titles. */
function metadataWith(titles: string[]) {
  return {
    ok: true,
    json: async () => ({
      metadata: { identifier: "x" },
      files: titles.map((t) => ({ name: `${t}.mp3`, title: t, format: "VBR MP3" })),
    }),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("keepRecordingsContainingSong", () => {
  it("drops a recording whose track list does not contain the song", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => metadataWith(["Sugaree", "Jack Straw", "Row Jimmy"])),
    );

    const kept = await keepRecordingsContainingSong([version("gd1974-08-06")], "Crazy Fingers");
    expect(kept).toEqual([]);
  });

  it("keeps a recording that actually contains the song", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => metadataWith(["Crazy Fingers", "Sugaree"])),
    );

    const kept = await keepRecordingsContainingSong([version("gd1975-06-17")], "Crazy Fingers");
    expect(kept.map((v) => v.identifier)).toEqual(["gd1975-06-17"]);
  });

  it("keeps a recording it could not check — absence of evidence is not absence", async () => {
    // archive.org times out / rate-limits / 503s. Treating that as "no tape"
    // made the same recording vanish on one run and appear on the next.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ETIMEDOUT");
      }),
    );

    const kept = await keepRecordingsContainingSong([version("gd1975-06-17")], "Crazy Fingers");
    expect(kept.map((v) => v.identifier)).toEqual(["gd1975-06-17"]);
  });

  it("does not carry over candidates past the check budget", async () => {
    // Stopping early is a budget decision, not evidence. Padding the result
    // with unverified candidates would put the bad versions straight back.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => metadataWith(["Sugaree"])),
    );

    const candidates = Array.from({ length: 10 }, (_, i) => version(`gd-${i}`));
    const kept = await keepRecordingsContainingSong(candidates, "Crazy Fingers", {
      maxChecks: 4,
      concurrency: 2,
    });

    expect(kept).toEqual([]);
  });

  it("stops checking once enough tapes are confirmed", async () => {
    const fetchMock = vi.fn(async () => metadataWith(["Crazy Fingers"]));
    vi.stubGlobal("fetch", fetchMock);

    const candidates = Array.from({ length: 30 }, (_, i) => version(`gd-${i}`));
    const kept = await keepRecordingsContainingSong(candidates, "Crazy Fingers", {
      target: 4,
      concurrency: 2,
    });

    expect(kept.length).toBeGreaterThanOrEqual(4);
    // Nowhere near all 30 — the early stop is what keeps this affordable.
    expect(fetchMock.mock.calls.length).toBeLessThan(30);
  });
});
