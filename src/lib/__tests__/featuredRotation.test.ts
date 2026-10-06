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

  it.each([2, 3, 4, 5, 6, 9, 12, 15, 24, 48, 96])(
    "starves nobody with %i creators, the sizes that share a factor with the stride",
    (n) => {
      // 47 is COPRIME with the 3-slot stride, which is the friendly case — so
      // the test above proves less than it looks like it does. A window that
      // advances by 3 over a pool of 6 could plausibly show only 2 of them
      // forever. (It does not: the window is consecutive, so the windows tile
      // the ring whatever the common factor. This pins that.)
      for (const fresh of [false, true]) {
        const rows: RotatableSetlist[] = Array.from({ length: n }, (_, i) => ({
          id: `s${i}`,
          creator_id: `c${i}`,
          // `fresh` also shortens the window to 2 and shrinks the pool by one,
          // so the stride and the ring size BOTH change — the harder case.
          created_at: fresh && i === 0 ? daysAgo(1) : daysAgo(60 + i),
          title: `Night ${i}`,
        }));
        const seen = new Set<string>();
        for (let w = 0; w < 400 && seen.size < n; w++) {
          featuredForWeek(rows, 3, NOW, w).forEach((p) => seen.add(p.creator_id));
        }
        expect(seen.size, `n=${n} fresh=${fresh}`).toBe(n);
      }
    },
  );

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

describe("the path production actually takes — a fresh lead present", () => {
  /**
   * Every coverage test above runs with nothing fresh, so they only exercise
   * slots=3. Production creates ~16 setlists a week, so a fresh lead is there
   * almost every week and slots=2 is the REAL path — which had no coverage at
   * all. Three mutations survived the whole suite because of it: using `count`
   * rather than `slots` for the stride (starves a third of the pool), ignoring
   * the lead when sizing the window (renders FOUR cards), and widening the
   * window to `count` while the lead still takes a slot.
   *
   * What keeps everyone reachable is that the stride EQUALS the window width,
   * so the windows tile the ring. These pin that where it counts.
   */
  const withLead = (n: number) =>
    Array.from({ length: n }, (_, i) =>
      s(`s${i}`, `c${i}`, i === 0 ? daysAgo(1) : daysAgo(60 + i)),
    );

  it.each([4, 6, 7, 9, 12, 48])(
    "never shows more cards than asked, with %i creators and a fresh lead",
    (n) => {
      for (let w = 0; w < 12; w++) {
        const picks = featuredForWeek(withLead(n), 3, NOW, w);
        expect(picks.length, `n=${n} week=${w}`).toBeLessThanOrEqual(3);
        // And never the same person twice on one shelf.
        expect(new Set(picks.map((p) => p.creator_id)).size).toBe(picks.length);
      }
    },
  );

  it.each([6, 9, 12, 48])(
    "still reaches every creator with %i in the pool and a lead taking a slot",
    (n) => {
      const rows = withLead(n);
      const seen = new Set<string>();
      for (let w = 0; w < 400 && seen.size < n; w++) {
        featuredForWeek(rows, 3, NOW, w).forEach((p) => seen.add(p.creator_id));
      }
      expect(seen.size, `n=${n}`).toBe(n);
    },
  );

  it("leads with the fresh one and fills the rest from the rotation", () => {
    const picks = featuredForWeek(withLead(12), 3, NOW, 5);
    expect(picks).toHaveLength(3);
    expect(picks[0].id).toBe("s0");
    expect(picks.slice(1).some((p) => p.id === "s0")).toBe(false);
  });
});

describe("an empty setlist never reaches the shelf", () => {
  // Selection happens before enrichment, so without a song count a named but
  // empty setlist renders as a "0 songs" card. The main grid already hides
  // empties. Measured: 3 of 189 named public setlists are empty.
  const full = (id: string, c: string, d: string) => ({ ...s(id, c, d), songCount: 12 });
  const empty = (id: string, c: string, d: string) => ({ ...s(id, c, d), songCount: 0 });

  it("prefers a creator's non-empty setlist even when the empty one is newer", () => {
    expect(oneSetlistPerCreator([empty("e", "ann", daysAgo(1)), full("f", "ann", daysAgo(30))])
      .map((p) => p.id)).toEqual(["f"]);
  });

  it("keeps an empty-only creator off the shelf", () => {
    const picks = featuredForWeek(
      [...manyCreators.map((m) => ({ ...m, songCount: 9 })), empty("x", "ghost", daysAgo(1))],
      3, NOW,
    );
    expect(picks.some((p) => p.creator_id === "ghost")).toBe(false);
  });

  it("treats an unknown count as eligible, not as empty", () => {
    // `undefined` means the caller did not say — it must not silently exclude
    // every setlist on a surface that does not fetch counts.
    const picks = featuredForWeek(manyCreators, 3, NOW, 3);
    expect(picks).toHaveLength(3);
  });
});

describe("isoWeekIndex does not depend on the machine's timezone", () => {
  // It survived a mutation to local getters because CI and the sandbox both
  // run in UTC. A timezone regression would have shipped green.
  const inTZ = (tz: string, fn: () => void) => {
    const prev = process.env.TZ;
    process.env.TZ = tz;
    try { fn(); } finally { process.env.TZ = prev; }
  };

  it.each(["UTC", "Pacific/Kiritimati", "Pacific/Pago_Pago", "America/New_York", "Asia/Kolkata"])(
    "gives the same index in %s",
    (tz) => {
      const at = (iso: string) => {
        let v = 0;
        inTZ(tz, () => { v = isoWeekIndex(new Date(iso)); });
        return v;
      };
      // Instants either side of UTC midnight on an ISO week boundary.
      expect(at("2026-10-11T23:59:59Z")).toBe(at("2026-10-05T00:00:00Z"));
      expect(at("2026-10-12T00:00:00Z")).toBe(at("2026-10-05T00:00:00Z") + 1);
    },
  );
});
