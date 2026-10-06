import { describe, it, expect } from "vitest";
import { ladderPlaylist, ladderSlot } from "@/lib/ladderPlayback";
import type { LadderVersion } from "@/components/SongEraLadder";

/**
 * The curated Songbook issue and /song/:id both queue through here.
 *
 * Measured on production 2026-10-06: 25 of 53 notable_versions rows are dated
 * with no archive_org_url, concentrated badly — Shakedown Street has 15
 * versions and ONE url, and eight songs have their only version in that state.
 * Filtering on the url alone meant Shakedown's issue offered one night under a
 * ladder of fifteen, and those eight offered no play control at all.
 */

const song = { id: "song-1", title: "Shakedown Street" };

const version = (over: Partial<LadderVersion> = {}): LadderVersion =>
  ({
    id: "v1",
    show_date: "1978-08-31",
    venue: "Red Rocks",
    city: null,
    era_id: null,
    archive_org_url: null,
    blurb: null,
    is_benchmark: false,
    source_url: null,
    vote_source: null,
    votes: null,
    ...over,
  }) as LadderVersion;

describe("a ladder row is playable when it can be resolved", () => {
  it("keeps a row that names its night but stores no tape", () => {
    expect(ladderPlaylist(song, [version()])).toHaveLength(1);
  });

  it("keeps a row that stores a tape but names no night", () => {
    expect(
      ladderPlaylist(song, [
        version({ show_date: null, archive_org_url: "https://archive.org/details/a" }),
      ]),
    ).toHaveLength(1);
  });

  it("drops a row that can be neither found nor named", () => {
    expect(ladderPlaylist(song, [version({ show_date: null })])).toHaveLength(0);
  });

  it("Shakedown's real shape: 15 rows, 1 url — all 15 queue", () => {
    const rows = Array.from({ length: 15 }, (_, i) =>
      version({
        id: `v${i}`,
        show_date: `19${78 + i}-08-31`,
        archive_org_url: i === 0 ? "https://archive.org/details/a" : null,
      }),
    );
    expect(ladderPlaylist(song, rows)).toHaveLength(15);
  });

  it("carries the night onto the slot, which is what the player resolves by", () => {
    // Without show_date on the slot, resolveSlot's named-night branch cannot
    // fire and the row is silent however it was filtered.
    expect(ladderPlaylist(song, [version()])[0].version?.show_date).toBe("1978-08-31");
  });

  it("still plays oldest first", () => {
    const slots = ladderPlaylist(song, [
      version({ id: "late", show_date: "1990-03-29" }),
      version({ id: "early", show_date: "1978-08-31" }),
    ]);
    expect(slots.map((s) => s.version?.show_date)).toEqual(["1978-08-31", "1990-03-29"]);
  });

  it("ladderSlot keeps the night for a single tap too", () => {
    expect(ladderSlot(song, version()).version?.show_date).toBe("1978-08-31");
  });
});
