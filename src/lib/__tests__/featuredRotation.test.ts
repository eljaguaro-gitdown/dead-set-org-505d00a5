import { describe, it, expect } from "vitest";
import {
  featuredForWeek,
  oneSetlistPerCreator,
  isoWeekIndex,
  FRESH_WINDOW_MS,
  type RotatableSetlist,
} from "@/lib/featuredRotation";

/**
 * The shelf was `order by upvote_count desc limit 3`, all-time. On production
 * 2026-10-06: 255 public setlists, 47 creators, 200 with zero upvotes. So the
 * same three sat there forever and 44 of 47 people could never appear.
 */

const NOW = new Date("2026-10-06T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

const s = (
  id: string,
  creator: string,
  created: string,
  title = `Night ${id}`,
): RotatableSetlist => ({ id, creator_id: creator, created_at: created, title });

/** 47 creators, one old setlist each — the real shape, minus the fresh ones. */
const manyCreators = Array.from({ length: 47 }, (_, i) =>
  s(`s${i}`, `c${i}`, daysAgo(60 + i)),
);

describe("one setlist per creator", () => {
  it("keeps each creator's newest and drops the rest", () => {
    const pool = oneSetlistPerCreator([
      s("old", "ann", daysAgo(30)),
      s("new", "ann", daysAgo(2)),
      s("bob", "bob", daysAgo(10)),
    ]);
    expect(pool.map((p) => p.id)).toEqual(["new", "bob"]);
  });

  it("orders newest creator first", () => {
    const pool = oneSetlistPerCreator([
      s("a", "ann", daysAgo(30)),
      s("b", "bob", daysAgo(1)),
      s("c", "cal", daysAgo(10)),
    ]);
    expect(pool.map((p) => p.id)).toEqual(["b", "c", "a"]);
  });

  it("breaks ties on id, so the shelf cannot flicker between renders", () => {
    const same = daysAgo(5);
    const first = oneSetlistPerCreator([s("z", "z", same), s("a", "a", same)]);
    const again = oneSetlistPerCreator([s("a", "a", same), s("z", "z", same)]);
    expect(first.map((p) => p.id)).toEqual(again.map((p) => p.id));
  });
});

describe("rule 1 — new work surfaces at once", () => {
  it("leads with something made this week", () => {
    const picks = featuredForWeek([...manyCreators, s("fresh", "newbie", daysAgo(1))], 3, NOW);
    expect(picks[0].id).toBe("fresh");
  });

  it("does NOT lead with the newest when nothing is actually recent", () => {
    // Otherwise one creator holds the first slot forever on a quiet month.
    const picks = featuredForWeek(manyCreators, 3, NOW);
    expect(picks).toHaveLength(3);
    expect(picks[0].id).not.toBe(manyCreators[0].id);
  });

  it("treats the window edge as fresh, and a moment past it as not", () => {
    const edge = new Date(NOW.getTime() - FRESH_WINDOW_MS).toISOString();
    const past = new Date(NOW.getTime() - FRESH_WINDOW_MS - 1000).toISOString();
    expect(featuredForWeek([...manyCreators, s("e", "n", edge)], 3, NOW)[0].id).toBe("e");
    expect(featuredForWeek([...manyCreators, s("p", "n", past)], 3, NOW)[0].id).not.toBe("p");
  });
});

describe("rule 2 — everyone gets a turn", () => {
  it("shows different people from one week to the next", () => {
    const w1 = featuredForWeek(manyCreators, 3, NOW, 100).map((p) => p.id);
    const w2 = featuredForWeek(manyCreators, 3, NOW, 101).map((p) => p.id);
    expect(w1).not.toEqual(w2);
    expect(w1.some((id) => w2.includes(id))).toBe(false);
  });

  it("reaches EVERY creator within a full cycle — the whole point", () => {
    // The old shelf reached 3 of 47, ever. This is the assertion that the
    // replacement actually fixes that, rather than merely shuffling.
    const seen = new Set<string>();
    for (let w = 0; w < 47; w++) {
      for (const p of featuredForWeek(manyCreators, 3, NOW, w)) seen.add(p.creator_id);
    }
    expect(seen.size).toBe(47);
  });

  it("is stable within a week — same week in, same shelf out", () => {
    const a = featuredForWeek(manyCreators, 3, NOW, 7).map((p) => p.id);
    const b = featuredForWeek(manyCreators, 3, NOW, 7).map((p) => p.id);
    expect(a).toEqual(b);
  });

  it("never shows one person twice on the same shelf", () => {
    const withExtras = [...manyCreators, s("x1", "c0", daysAgo(1)), s("x2", "c0", daysAgo(2))];
    for (let w = 0; w < 20; w++) {
      const creators = featuredForWeek(withExtras, 3, NOW, w).map((p) => p.creator_id);
      expect(new Set(creators).size).toBe(creators.length);
    }
  });
});

describe("edges", () => {
  it("returns everything it has when there are fewer creators than slots", () => {
    const picks = featuredForWeek([s("a", "ann", daysAgo(40))], 3, NOW);
    expect(picks).toHaveLength(1);
  });

  it("handles an empty shelf", () => {
    expect(featuredForWeek([], 3, NOW)).toEqual([]);
  });

  it("handles a zero count", () => {
    expect(featuredForWeek(manyCreators, 0, NOW)).toEqual([]);
  });

  it("never returns more than asked", () => {
    for (let w = 0; w < 10; w++) {
      expect(featuredForWeek(manyCreators, 3, NOW, w).length).toBeLessThanOrEqual(3);
    }
  });

  it("survives a negative week index without crashing or repeating a slot", () => {
    const picks = featuredForWeek(manyCreators, 3, NOW, -5);
    expect(picks).toHaveLength(3);
    expect(new Set(picks.map((p) => p.id)).size).toBe(3);
  });
});

describe("isoWeekIndex", () => {
  it("is the same all week and changes exactly once", () => {
    // Mon 2026-10-05 → Sun 2026-10-11 is one ISO week.
    const mon = isoWeekIndex(new Date("2026-10-05T00:00:00Z"));
    const sun = isoWeekIndex(new Date("2026-10-11T23:59:59Z"));
    const nextMon = isoWeekIndex(new Date("2026-10-12T00:00:00Z"));
    expect(sun).toBe(mon);
    expect(nextMon).toBe(mon + 1);
  });

  it("advances by one per week, not by a drifting millisecond count", () => {
    const a = isoWeekIndex(new Date("2026-01-01T00:00:00Z"));
    const b = isoWeekIndex(new Date("2026-04-01T00:00:00Z"));
    expect(b - a).toBe(13);
  });
});

describe("it shows a creator's better-presented work", () => {
  // A simulation on the real 255 setlists put "Untitled Setlist" on the shelf
  // twice in five weeks, once for a test account. Untitled is the DEFAULT
  // title, so real people have them — it must cost the setlist, never the
  // creator, or "everyone gets a turn" quietly stops being true.
  it("prefers a named setlist over an untitled one, even if older", () => {
    const picks = oneSetlistPerCreator([
      s("untitled", "ann", daysAgo(1), "Untitled Setlist"),
      s("named", "ann", daysAgo(20), "Scarlet into Fire"),
    ]);
    expect(picks.map((p) => p.id)).toEqual(["named"]);
  });

  it("treats an empty title the same as untitled", () => {
    const picks = oneSetlistPerCreator([
      s("blank", "ann", daysAgo(1), "   "),
      s("named", "ann", daysAgo(20), "Scarlet into Fire"),
    ]);
    expect(picks.map((p) => p.id)).toEqual(["named"]);
  });

  it("keeps an untitled-only creator out of the shelf", () => {
    // The bar, measured: 35 of 47 creators have a titled setlist, and the
    // untitled-only group is where the QA accounts live. Name one and you are
    // in the same week.
    const picks = featuredForWeek(
      [...manyCreators, s("only", "qa-bot", daysAgo(1), "Untitled Setlist")],
      3,
      NOW,
    );
    expect(picks.some((p) => p.creator_id === "qa-bot")).toBe(false);
  });

  it("falls back to everything if NOBODY has named a setlist", () => {
    // A fresh install should show a shelf, not an empty space.
    const picks = featuredForWeek(
      [s("a", "ann", daysAgo(1), "Untitled Setlist"), s("b", "bob", daysAgo(2), "")],
      3,
      NOW,
    );
    expect(picks).toHaveLength(2);
  });

  it("still reaches every creator who HAS named something", () => {
    const mixed = manyCreators.map((m, i) =>
      i % 3 === 0 ? [{ ...m, title: "Untitled Setlist" }, s(`n${i}`, m.creator_id, daysAgo(70), `Named ${i}`)] : [m],
    ).flat();
    const seen = new Set<string>();
    for (let w = 0; w < 60; w++) {
      for (const p of featuredForWeek(mixed, 3, NOW, w)) seen.add(p.creator_id);
    }
    expect(seen.size).toBe(47);
  });
});
