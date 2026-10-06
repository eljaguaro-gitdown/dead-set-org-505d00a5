/**
 * Who gets on the Featured shelf this week.
 *
 * It used to be `order by upvote_count desc limit 3` — an all-time
 * leaderboard. Upvote counts barely move, so the same three setlists sat
 * there indefinitely and the shelf read as abandoned.
 *
 * Measured on production 2026-10-06, which is what makes the case:
 *
 *   public setlists            255
 *   distinct creators           47
 *   created in the last 7 days  16
 *   with ANY upvote             55
 *
 * So 200 of 255 setlists carried zero upvotes and were structurally
 * unfeaturable, and 44 of 47 people could never appear no matter what they
 * made. A leaderboard rewards the already-rewarded; this shelf is supposed
 * to say "look what the community is making".
 *
 * TWO RULES, both from the brief:
 *
 * 1. NEW WORK SURFACES AT ONCE. Anything created inside the freshness window
 *    takes the first slot, so posting something is visibly worth doing.
 * 2. EVERYONE GETS A TURN. The rest of the shelf is a window over the
 *    creators, advancing by one shelf-width each week and wrapping — so with
 *    47 creators and 3 slots, every creator appears within about 24 weeks
 *    rather than never.
 *
 * ONE SETLIST PER CREATOR per week, so three cards are three different
 * people rather than one person's back catalogue.
 *
 * No cron and no table: the week number seeds the window, so the shelf
 * rotates by itself, is identical for every visitor within a week, and
 * cannot drift out of sync with a job that failed to run.
 */

export interface RotatableSetlist {
  id: string;
  creator_id: string;
  created_at: string;
  /** Optional: used only to prefer a creator's better-presented work. */
  title?: string | null;
  /**
   * Songs in the setlist, when the caller knows. Selection happens before
   * enrichment, so without this an empty-but-named setlist can reach the shelf
   * as a "0 songs" card — the main grid hides empties, the shelf did not.
   * Measured on production: 3 of the 189 named public setlists are empty, and
   * every one of the 35 named creators also has a non-empty one, so preferring
   * non-empty costs nobody their turn.
   */
  songCount?: number | null;
}

/**
 * A setlist nobody named — "Untitled Setlist" is the default title.
 *
 * This is the shelf's quality bar, and it is deliberately the ONLY one.
 * Simulating the rotation on the real 255 setlists put "Untitled Setlist" on
 * the shelf three times in five weeks, twice for QA accounts
 * (`qa-verify-race-test-0713`, `qa-verify-auth-2026-07-13`) — on the page
 * every visitor sees.
 *
 * Measured before choosing it: 35 of the 47 creators have at least one titled
 * setlist, and every one of those 35 also has one with 5+ songs — so a title
 * separates finished work from a test row on its own, and a second rule about
 * song counts would exclude nobody extra while needing a column the shelf
 * query does not have.
 *
 * The 12 it excludes have made nothing but untitled setlists. That is a bar,
 * not a snub: name one and you are in the rotation the same week.
 */
/** Known to have no songs. `undefined` means "caller did not say", not empty. */
const isEmpty = (s: RotatableSetlist) => s.songCount != null && s.songCount <= 0;

const isUntitled = (s: RotatableSetlist) => {
  const t = (s.title ?? "").trim();
  return t === "" || /^untitled setlist$/i.test(t);
};

/**
 * ISO-8601 week number since the epoch — a single integer that increments
 * once a week, worldwide, on the same boundary for everyone.
 *
 * Deliberately NOT `Math.floor(Date.now() / WEEK_MS)`: that drifts against
 * the calendar and rotates mid-week in some timezones. Thursday-anchored, as
 * ISO-8601 defines it.
 */
export const isoWeekIndex = (now: Date = new Date()): number => {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // Shift to the Thursday of this week; ISO weeks are defined by their Thursday.
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  return Math.floor(d.getTime() / 604_800_000);
};

/** A setlist counts as new work for this long after it is created. */
export const FRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const newestFirst = (a: RotatableSetlist, b: RotatableSetlist) =>
  b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id);

/** Has songs beats empty; titled beats untitled; otherwise newest wins. */
const betterRepresentative = (a: RotatableSetlist, b: RotatableSetlist) => {
  const ae = isEmpty(a), be = isEmpty(b);
  if (ae !== be) return ae ? 1 : -1;
  const au = isUntitled(a), bu = isUntitled(b);
  if (au !== bu) return au ? 1 : -1;
  return newestFirst(a, b);
};

/**
 * One setlist per creator — their newest NAMED one, falling back to an
 * untitled one if that is all they have — ordered newest-creator first.
 * Ties break on id so the order is total and the shelf cannot flicker
 * between two renders of the same week.
 */
export const oneSetlistPerCreator = <T extends RotatableSetlist>(setlists: T[]): T[] => {
  const best = new Map<string, T>();
  for (const s of setlists) {
    const held = best.get(s.creator_id);
    if (!held || betterRepresentative(s, held) < 0) best.set(s.creator_id, s);
  }
  return [...best.values()].sort(newestFirst);
};

/**
 * The shelf for a given week.
 *
 * `now` and `weekIndex` are parameters rather than reads of the clock so the
 * behaviour is testable at an exact instant — a rotation you can only observe
 * by waiting a week is a rotation nobody will ever check.
 */
export const featuredForWeek = <T extends RotatableSetlist>(
  setlists: T[],
  count = 3,
  now: Date = new Date(),
  weekIndex: number = isoWeekIndex(now),
): T[] => {
  if (count <= 0) return [];
  // The bar: a setlist somebody named. Falls back to everything only if NOBODY
  // has named one, so a fresh install still shows a shelf instead of nothing.
  const eligible = setlists.filter((x) => !isUntitled(x) && !isEmpty(x));
  const pool = oneSetlistPerCreator(eligible.length > 0 ? eligible : setlists);
  if (pool.length === 0) return [];

  // Rule 1 — new work first. `pool` is newest-first, so the head is the most
  // recent thing anyone made; it leads only if it is actually recent.
  const freshest = pool[0];
  const isFresh = now.getTime() - new Date(freshest.created_at).getTime() <= FRESH_WINDOW_MS;
  const lead = isFresh ? [freshest] : [];
  const rest = isFresh ? pool.slice(1) : pool;
  if (rest.length === 0) return lead.slice(0, count);

  // Rule 2 — a window that advances one shelf-width per week and wraps, so
  // the whole community cycles through instead of the same names recurring.
  const slots = Math.max(0, count - lead.length);
  const start = ((weekIndex * Math.max(slots, 1)) % rest.length + rest.length) % rest.length;
  const picked: T[] = [];
  for (let i = 0; i < Math.min(slots, rest.length); i++) {
    picked.push(rest[(start + i) % rest.length]);
  }
  return [...lead, ...picked];
};
