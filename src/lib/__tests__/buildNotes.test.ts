import { describe, it, expect } from "vitest";
import { groupEditions, rangeLabel, weekStart, type BuildNoteEntry } from "@/lib/buildNotes";

const e = (p: Partial<BuildNoteEntry> & { shipped_on: string }): BuildNoteEntry => ({
  id: p.shipped_on + (p.title ?? ""),
  edition_title: "An Edition",
  week_label: null,
  set_number: 1,
  tag: "fix",
  title: "t",
  detail: "d",
  credit: null,
  encore_note: null,
  next_week_teaser: null,
  ...p,
});

describe("weekStart", () => {
  it("anchors on Monday, and keeps Sunday in the week that began six days earlier", () => {
    expect(weekStart("2026-09-14")).toBe("2026-09-14"); // Monday
    expect(weekStart("2026-09-17")).toBe("2026-09-14");
    expect(weekStart("2026-09-20")).toBe("2026-09-14"); // Sunday — the trap
    expect(weekStart("2026-09-21")).toBe("2026-09-21"); // next Monday
  });

  it("crosses a month and a year boundary", () => {
    expect(weekStart("2026-10-01")).toBe("2026-09-28");
    expect(weekStart("2027-01-01")).toBe("2026-12-28");
  });
});

describe("rangeLabel", () => {
  it("collapses to one date, shortens inside a month, spells out across months and years", () => {
    expect(rangeLabel("2026-10-05", "2026-10-05")).toBe("Oct 5, 2026");
    expect(rangeLabel("2026-09-14", "2026-09-20")).toBe("Sep 14–20, 2026");
    expect(rangeLabel("2026-09-28", "2026-10-04")).toBe("Sep 28 – Oct 4, 2026");
    expect(rangeLabel("2026-12-28", "2027-01-03")).toBe("Dec 28, 2026 – Jan 3, 2027");
  });
});

describe("groupEditions", () => {
  it("derives the label from the span when rows arrive NEWEST first", () => {
    /**
     * The order the real query returns. Every other fixture here lists the
     * earliest date first, which let the min-tracking line be deleted with all
     * thirteen tests green — and in production the page queries
     * `order("shipped_on", { ascending: false })`, so the first row of a group
     * is its MAX. With min tracking broken every label would read "max–max":
     * the label-vs-entries defect this module exists to prevent, reintroduced
     * by a fixture typed in the convenient direction.
     */
    const out = groupEditions([
      e({ shipped_on: "2026-09-20", title: "d" }),
      e({ shipped_on: "2026-09-18", title: "c" }),
      e({ shipped_on: "2026-09-16", title: "a" }),
    ], "2026-10-06");
    expect(out[0].label).toBe("Sep 16–20, 2026");
  });

  it("the archive window includes both of its end days", () => {
    // Aug 24 is the closing date and was untested; Aug 25 must fall out into
    // its own week, and Apr 20 must stay out of the archive entirely.
    const inside = groupEditions([
      e({ shipped_on: "2026-04-21", title: "start" }),
      e({ shipped_on: "2026-08-24", title: "end" }),
    ], "2026-10-06");
    expect(inside).toHaveLength(1);
    expect(inside[0].key).toBe("archive");

    const outside = groupEditions([
      e({ shipped_on: "2026-04-20", title: "before" }),
      e({ shipped_on: "2026-08-25", title: "after" }),
    ], "2026-10-06");
    expect(outside.map((x) => x.key)).toEqual(["2026-08-24", "2026-04-20"]);
  });

  it("a stored label cannot relabel a derived week — only the archive keeps one", () => {
    /**
     * The hole the gate found: the override used to apply to any edition, so
     * one row carrying the old five-month label would print it over a week of
     * September entries. That is the original defect, intact.
     */
    const out = groupEditions([
      e({ shipped_on: "2026-09-16", week_label: "Apr 21 – Sep 23, 2026" }),
      e({ shipped_on: "2026-09-18", week_label: null }),
    ], "2026-10-06");
    expect(out[0].label).toBe("Sep 16–18, 2026");
  });

  it("splits work into the weeks it actually shipped in", () => {
    const out = groupEditions([
      e({ shipped_on: "2026-09-16", title: "a" }),
      e({ shipped_on: "2026-09-20", title: "b" }),
      e({ shipped_on: "2026-09-23", title: "c" }),
      e({ shipped_on: "2026-10-05", title: "d" }),
    ], "2026-10-06");
    expect(out.map((x) => x.label)).toEqual([
      "Oct 5, 2026", "Sep 23, 2026", "Sep 16–20, 2026",
    ]);
  });

  it("never lets one edition span months — the defect this replaced", () => {
    /**
     * The page showed "Week 3 · Apr 21 – Sep 23, 2026": seventeen items from
     * five different months under one week heading, because the label was typed
     * rather than derived. Feed exactly that spread in and the April–August part
     * goes to the archive while September splits into its real weeks.
     */
    const out = groupEditions([
      e({ shipped_on: "2026-08-13", title: "firsts" }),
      e({ shipped_on: "2026-08-21", title: "songbook" }),
      e({ shipped_on: "2026-09-16", title: "clock" }),
      e({ shipped_on: "2026-09-23", title: "silent" }),
    ], "2026-09-30");
    expect(out).toHaveLength(3);
    for (const ed of out) {
      if (ed.key === "archive") continue;
      // A derived week can only hold seven days of ship dates.
      const span = out.filter((x) => x.key === ed.key);
      expect(span).toHaveLength(1);
    }
    expect(out.map((x) => x.key)).toEqual(["2026-09-21", "2026-09-14", "archive"]);
  });

  it("keeps the pre-relaunch backlog as one archive edition", () => {
    const out = groupEditions([
      e({ shipped_on: "2026-08-13" }),
      e({ shipped_on: "2026-08-15" }),
      e({ shipped_on: "2026-08-21" }),
      e({ shipped_on: "2026-04-21" }),
    ], "2026-10-06");
    expect(out).toHaveLength(1);
    expect(out[0].key).toBe("archive");
    expect(out[0].stats.updates).toBe(4);
  });

  it("leaves editions from before the backlog on their own weeks", () => {
    // The two April editions predate the archive window and were already
    // honest weekly editions; folding them in would rewrite published history.
    const out = groupEditions([
      e({ shipped_on: "2026-04-09", week_label: "Apr 7–11, 2026" }),
      e({ shipped_on: "2026-04-17", week_label: "Apr 14–20, 2026" }),
      e({ shipped_on: "2026-08-13" }),
    ], "2026-10-06");
    expect(out.map((x) => x.label)).toEqual([
      "Aug 13, 2026", "Apr 14–20, 2026", "Apr 7–11, 2026",
    ]);
  });

  it("a stored label wins only where one exists, and cannot be invented later", () => {
    // The override exists so the two April editions keep the labels they were
    // published with. Any edition without one is described by its own dates.
    const out = groupEditions([
      e({ shipped_on: "2026-09-16", week_label: null }),
      e({ shipped_on: "2026-09-18", week_label: null }),
    ], "2026-10-06");
    expect(out[0].label).toBe("Sep 16–18, 2026");
  });

  it("counts the entries rather than trusting a number stored beside them", () => {
    const out = groupEditions([
      e({ shipped_on: "2026-09-16", tag: "fix", credit: "built from a Founding Deadhead report" }),
      e({ shipped_on: "2026-09-17", tag: "fix", credit: null }),
      e({ shipped_on: "2026-09-18", tag: "new", credit: "built for our TestFlight circle" }),
    ], "2026-10-06");
    expect(out[0].stats).toEqual({ updates: 3, feedback: 2, bugs: 2 });
  });

  it("marks the running week, and only the running week", () => {
    const out = groupEditions([
      e({ shipped_on: "2026-10-05", title: "now" }),
      e({ shipped_on: "2026-09-30", title: "last" }),
    ], "2026-10-06");
    expect(out[0].inProgress).toBe(true);
    expect(out[1].inProgress).toBe(false);
  });

  it("the archive is never the running week, whatever today is", () => {
    const out = groupEditions([e({ shipped_on: "2026-08-13" })], "2026-08-13");
    expect(out[0].key).toBe("archive");
    expect(out[0].inProgress).toBe(false);
  });

  it("splits sets and carries the encore and teaser from whichever row has them", () => {
    const out = groupEditions([
      e({ shipped_on: "2026-09-16", set_number: 1, title: "fix one" }),
      e({ shipped_on: "2026-09-17", set_number: 2, title: "new one", encore_note: "one more thing" }),
      e({ shipped_on: "2026-09-18", set_number: 2, title: "new two", next_week_teaser: "next up" }),
    ], "2026-10-06");
    expect(out[0].set1.map((x) => x.title)).toEqual(["fix one"]);
    expect(out[0].set2.map((x) => x.title)).toEqual(["new two", "new one"]);
    expect(out[0].encore_note).toBe("one more thing");
    expect(out[0].next_week_teaser).toBe("next up");
  });

  it("ignores an entry with no ship date rather than inventing a week for it", () => {
    const out = groupEditions([
      e({ shipped_on: "2026-09-16" }),
      { ...e({ shipped_on: "x" }), shipped_on: "" },
    ], "2026-10-06");
    expect(out).toHaveLength(1);
    expect(out[0].stats.updates).toBe(1);
  });
});
