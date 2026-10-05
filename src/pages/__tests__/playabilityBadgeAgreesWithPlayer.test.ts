import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The "no tape" badge must not contradict what the player can actually do.
 *
 * `setlist_slot_playability` is written by precompute-slot-playability, which
 * resolves a slot's STORED archive url and nothing else. Since 2026-10-05 the
 * player does more than that: when the stored recording turns out not to carry
 * the song, it goes and finds a recording OF THAT NIGHT that does. So for a
 * slot that names its night, the job's verdict describes one recording, not
 * the night, and the player can succeed where the job gave up.
 *
 * Observed on a phone that day: a Ripple listening guide showing "no tape" on
 * every row, greyed to 50%, while gd70-08-18 and gd71-04-29 both carry a track
 * titled exactly "Ripple". The share surface was telling readers not to bother
 * with music that plays.
 *
 * Both readers of that table have to apply the same rule. A per-row badge and
 * a "4 of 7 on tape" counter that disagree is worse than either alone — same
 * invariant as the gem badge and its reason, asserted together rather than
 * separately.
 */
const SRC = readFileSync(resolve(__dirname, "../SetlistPoster.tsx"), "utf8");

/** Every place that turns a precompute verdict into something a reader sees. */
const READERS = [
  { name: "the per-row badge", anchor: "const isUnplayable" },
  { name: "the 'on tape' counter", anchor: "const playabilityStats" },
];

describe("the no-tape badge defers to the player", () => {
  it.each(READERS)("$name checks the status at all", ({ anchor }) => {
    const i = SRC.indexOf(anchor);
    expect(i).toBeGreaterThan(-1);
    expect(SRC.slice(i, i + 700)).toMatch(/unresolved|error/);
  });

  it("the per-row badge exempts a slot that names its night", () => {
    // archiveKeyDate is the one validator for "this slot names a real night".
    expect(SRC).toMatch(/const namesItsNight = !!archiveKeyDate\(slot\.version\?\.show_date\)/);
    // …and the exemption is actually applied to the verdict, not just computed.
    const i = SRC.indexOf("const isUnplayable");
    expect(SRC.slice(i, i + 300)).toMatch(/!namesItsNight/);
  });

  it("the counter exempts a slot that names its night", () => {
    const i = SRC.indexOf("const playabilityStats");
    expect(SRC.slice(i, i + 900)).toMatch(/archiveKeyDate\(s\.version\?\.show_date\)/);
  });
});
