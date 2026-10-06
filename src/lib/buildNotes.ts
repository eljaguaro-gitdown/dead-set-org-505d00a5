/**
 * How Build Notes decides what an "edition" is.
 *
 * It used to be a hand-typed `week_number` and a hand-typed `week_label`, which
 * is how the page came to show "Week 3 · Apr 21 – Sep 23, 2026" — a five-month
 * stretch presented as a week, with nothing in the schema able to notice.
 *
 * The week is now a consequence of `shipped_on` rather than a claim typed
 * beside it, so an edition cannot describe a period it does not cover, and next
 * week's entries form next week's edition without anyone relabelling anything.
 */

/** A real stretch of quiet, not an arbitrary cutoff: the last commit before it
 *  is 2026-08-21 and nothing ships again until 2026-09-14. Everything from the
 *  relaunch up to that gap was written up as one catch-up edition, and stays
 *  one — splitting it into "weeks" would invent a cadence that never happened. */
export const ARCHIVE_START = "2026-04-21";
export const ARCHIVE_END = "2026-08-24";
const ARCHIVE_KEY = "archive";

export interface BuildNoteEntry {
  id: string;
  shipped_on: string;
  edition_title: string;
  /** Legacy display override. Set only on editions that predate `shipped_on`;
   *  null everywhere else, and the admin no longer writes it — a label that can
   *  be typed is a label that can disagree with its own dates. */
  week_label: string | null;
  set_number: number;
  tag: string;
  title: string;
  detail: string;
  credit: string | null;
  encore_note: string | null;
  next_week_teaser: string | null;
}

export interface Edition<T extends BuildNoteEntry = BuildNoteEntry> {
  key: string;
  label: string;
  edition_title: string;
  /** Derived from the entries, never stored beside them: a count that is a
   *  second expression agreeing with the collection is a count that drifts. */
  stats: { updates: number; feedback: number; bugs: number };
  set1: T[];
  set2: T[];
  encore_note: string | null;
  next_week_teaser: string | null;
  /** True while this week is still running — the edition people are in. */
  inProgress: boolean;
}

/** Monday of the ISO week containing `iso`, as YYYY-MM-DD. */
export const weekStart = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  // getUTCDay is 0 for Sunday, which belongs to the week that began 6 days ago.
  const back = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const parts = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m: MONTHS[m - 1], d };
};

/**
 * "Sep 14–20, 2026", "Sep 28 – Oct 4, 2026", "Oct 5, 2026".
 * Built from the days work actually shipped, so a week with two days of work in
 * it says so rather than claiming the whole Monday-to-Sunday.
 */
export const rangeLabel = (fromIso: string, toIso: string): string => {
  const a = parts(fromIso);
  const b = parts(toIso);
  if (fromIso === toIso) return `${a.m} ${a.d}, ${a.y}`;
  if (a.y !== b.y) return `${a.m} ${a.d}, ${a.y} – ${b.m} ${b.d}, ${b.y}`;
  if (a.m !== b.m) return `${a.m} ${a.d} – ${b.m} ${b.d}, ${b.y}`;
  return `${a.m} ${a.d}–${b.d}, ${b.y}`;
};

const editionKey = (iso: string): string =>
  iso >= ARCHIVE_START && iso <= ARCHIVE_END ? ARCHIVE_KEY : weekStart(iso);

/**
 * Group entries into editions, newest first.
 *
 * `today` is passed in rather than read from the clock so the in-progress week
 * is testable; callers pass the real date.
 */
export const groupEditions = <T extends BuildNoteEntry>(entries: T[], today: string): Edition<T>[] => {
  const byKey = new Map<string, { entries: T[]; min: string; max: string }>();
  for (const e of entries) {
    if (!e.shipped_on) continue;
    const key = editionKey(e.shipped_on);
    const g = byKey.get(key);
    if (!g) {
      byKey.set(key, { entries: [e], min: e.shipped_on, max: e.shipped_on });
    } else {
      g.entries.push(e);
      if (e.shipped_on < g.min) g.min = e.shipped_on;
      if (e.shipped_on > g.max) g.max = e.shipped_on;
    }
  }

  const thisWeek = weekStart(today);
  const editions: Edition<T>[] = [];
  for (const [key, g] of byKey) {
    // Newest first inside an edition, and stable on title so two items shipped
    // the same day do not reorder between loads.
    const sorted = [...g.entries].sort(
      (a, b) => b.shipped_on.localeCompare(a.shipped_on) || a.title.localeCompare(b.title),
    );
    /**
     * The override is honoured ONLY for editions that predate `shipped_on`:
     * the catch-up archive and anything before it. Everywhere else a stored
     * label would reproduce the exact defect this module exists to prevent —
     * one row carrying `week_label: "Apr 21 – Sep 23, 2026"` would print that
     * heading over a week of September entries, and nothing would notice.
     * The admin no longer writes the column, but the weekly routine lives
     * outside this repo and an admin tab left open on the old bundle still
     * does, so the restriction is load-bearing rather than belt-and-braces.
     */
    const canOverride = key === ARCHIVE_KEY || g.max < ARCHIVE_START;
    const override = canOverride ? sorted.find((e) => e.week_label)?.week_label ?? null : null;
    editions.push({
      key,
      label: override ?? rangeLabel(g.min, g.max),
      edition_title: sorted[0].edition_title,
      stats: {
        updates: sorted.length,
        feedback: sorted.filter((e) => !!e.credit).length,
        bugs: sorted.filter((e) => e.tag === "fix").length,
      },
      set1: sorted.filter((e) => e.set_number === 1),
      set2: sorted.filter((e) => e.set_number !== 1),
      encore_note: sorted.find((e) => e.encore_note)?.encore_note ?? null,
      next_week_teaser: sorted.find((e) => e.next_week_teaser)?.next_week_teaser ?? null,
      inProgress: key !== ARCHIVE_KEY && key === thisWeek,
    });
  }

  // Sort by the newest thing in each edition, so the archive sits where its
  // content belongs rather than wherever a week number put it.
  return editions.sort((a, b) => {
    const am = byKey.get(a.key)!.max;
    const bm = byKey.get(b.key)!.max;
    return bm.localeCompare(am);
  });
};
