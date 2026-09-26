/**
 * What makes a recording a sleeper.
 *
 * A sleeper is a version heads rate as highly as the song's famous ones, that
 * almost nobody pulls down. Two axes, both answerable from metadata the
 * Internet Archive already publishes about items we already stream — no new
 * dependency, nothing re-hosted, and every recording links back to its Archive
 * item. `src/lib/archiveOrg.ts` has been reading `avg_rating` from the same
 * endpoint since long before this file existed; this adds `downloads`,
 * `num_reviews` and `publicdate` to the same call.
 *
 * This is deliberately the FLOOR, not the ceiling. Where a human has
 * transcribed headyversion votes into `notable_versions.votes` — Crazy Fingers
 * and Shakedown Street so far — those win and are credited by name. Archive
 * metrics cover the songs nobody has hand-curated yet, so the app degrades to
 * "rated high, rarely pulled" instead of to nothing.
 *
 * Pure on purpose: no imports, no I/O, no Deno or browser globals. The edge
 * function fetches and this scores, so the rule can be tested from `src/`
 * without a network or a Deno runtime.
 */

/** Under this share of the song's most-pulled version and it counts as rarely heard. */
export const SLEEPER_RATIO = 0.3;

/** Below this many reviews there is no opinion to trust, however high the rating. */
export const MIN_REVIEWS = 3;

/** How far under the song's best rating a sleeper may still sit. */
export const RATING_TOLERANCE = 0.5;

/** Guards against a brand-new upload reading as undiscovered. */
export const MIN_MONTHS_ONLINE = 1;

/**
 * The four numbers above, bundled so a caller can vary them.
 *
 * The edge function and the app never pass this — they get the defaults, which
 * ARE the constants, so there is exactly one set of shipping thresholds. It
 * exists for /lab/sleepers, where the point is to try a value across many
 * songs before deciding whether it should become the default.
 */
export interface SleeperThresholds {
  sleeperRatio: number;
  minReviews: number;
  ratingTolerance: number;
  minMonthsOnline: number;
}

export const DEFAULT_THRESHOLDS: SleeperThresholds = {
  sleeperRatio: SLEEPER_RATIO,
  minReviews: MIN_REVIEWS,
  ratingTolerance: RATING_TOLERANCE,
  minMonthsOnline: MIN_MONTHS_ONLINE,
};

export interface ArchiveRecording {
  identifier: string;
  /** Performance date, as the Archive reports it. Not used for scoring. */
  date: string | null;
  avgRating: number | null;
  numReviews: number | null;
  downloads: number | null;
  /** When the item went up on the Archive — `publicdate`, not the show date. */
  publicDate: string | null;
}

export type SleeperVerdict =
  | "sleeper"
  | "leader"
  | "too-few-reviews"
  | "rated-below-peers"
  | "widely-heard"
  | "undateable";

export interface ScoredRecording extends ArchiveRecording {
  /** Downloads divided by months on the Archive. Null when it cannot be dated. */
  pullsPerMonth: number | null;
  isSleeper: boolean;
  verdict: SleeperVerdict;
}

export interface SleeperReport {
  scored: ScoredRecording[];
  sleepers: ScoredRecording[];
  /** The busiest version's pulls-per-month — the bar everything is measured against. */
  leaderPullsPerMonth: number | null;
  /** The song's best rating among recordings that cleared MIN_REVIEWS. */
  bestRating: number | null;
}

/**
 * Months an item has been on the Archive, floored at MIN_MONTHS_ONLINE.
 *
 * Raw download counts reward age: a 2004 etree upload has had twenty years to
 * accumulate and a 2019 one has not, so comparing them raw mistakes "recently
 * posted" for "undiscovered". Dividing by time online also happens to be the
 * more honest phrase — how often does anyone pull this down.
 */
export function monthsOnline(
  publicDate: string | null,
  now: Date,
  minMonthsOnline: number = MIN_MONTHS_ONLINE,
): number | null {
  if (!publicDate) return null;
  const up = Date.parse(publicDate);
  if (Number.isNaN(up)) return null;
  const months = (now.getTime() - up) / (1000 * 60 * 60 * 24 * 30.44);
  if (months < 0) return null;
  return Math.max(months, minMonthsOnline);
}

/**
 * Score one song's recordings against each other.
 *
 * Every threshold is relative to this song, never to the catalogue: Dark Star
 * and Touch of Grey are pulled down at wildly different rates, and a fixed
 * download floor would call every Dark Star version a sleeper and none of
 * Touch of Grey's. The comparison only means anything within a song.
 */
export function scoreSleepers(
  recordings: ArchiveRecording[],
  now: Date = new Date(),
  thresholds: SleeperThresholds = DEFAULT_THRESHOLDS,
): SleeperReport {
  const { sleeperRatio, minReviews, ratingTolerance, minMonthsOnline } = thresholds;

  const scored: ScoredRecording[] = recordings.map((r) => {
    const months = monthsOnline(r.publicDate, now, minMonthsOnline);
    const pullsPerMonth =
      months == null || r.downloads == null ? null : r.downloads / months;
    return { ...r, pullsPerMonth, isSleeper: false, verdict: "undateable" };
  });

  // Only recordings with enough reviews get a say in what "good" means here.
  const credible = scored.filter(
    (r) => r.avgRating != null && (r.numReviews ?? 0) >= minReviews,
  );
  const bestRating = credible.length
    ? Math.max(...credible.map((r) => r.avgRating as number))
    : null;

  const datable = scored.filter((r) => r.pullsPerMonth != null);
  const leaderPullsPerMonth = datable.length
    ? Math.max(...datable.map((r) => r.pullsPerMonth as number))
    : null;

  // One recording cannot be obscure relative to itself, and a song whose
  // versions are all pulled equally has no sleepers. Both leave the list empty
  // rather than promoting something on a comparison that was never made.
  const comparable = leaderPullsPerMonth != null && leaderPullsPerMonth > 0;
  const cutoff = comparable ? (leaderPullsPerMonth as number) * sleeperRatio : 0;

  for (const r of scored) {
    if (r.pullsPerMonth == null) {
      r.verdict = "undateable";
      continue;
    }
    if (!comparable) {
      r.verdict = "leader";
      continue;
    }
    if (r.avgRating == null || (r.numReviews ?? 0) < minReviews) {
      r.verdict = "too-few-reviews";
      continue;
    }
    if (bestRating != null && r.avgRating < bestRating - ratingTolerance) {
      r.verdict = "rated-below-peers";
      continue;
    }
    if (r.pullsPerMonth >= cutoff) {
      r.verdict = r.pullsPerMonth === leaderPullsPerMonth ? "leader" : "widely-heard";
      continue;
    }
    r.verdict = "sleeper";
    r.isSleeper = true;
  }

  const sleepers = scored
    .filter((r) => r.isSleeper)
    .sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0));

  return { scored, sleepers, leaderPullsPerMonth, bestRating };
}

/* ------------------------------------------------------------------ *
 * Talking to the Archive.
 *
 * The URL builder and the row mapper live here, beside the rule, because
 * three callers need them and a second copy is how they drift: the
 * score-sleepers edge function, /lab/sleepers in the browser, and the tests.
 * Still pure — buildArchiveSearchUrl returns a string and toRecordings maps
 * a parsed body. Neither performs the fetch; the caller does.
 * ------------------------------------------------------------------ */

/** Everything the rule needs, in the order the Archive documents them. */
export const ARCHIVE_FIELDS = [
  "identifier",
  "date",
  "avg_rating",
  "num_reviews",
  "downloads",
  "publicdate",
] as const;

export interface ArchiveQuery {
  rows?: number;
  yearStart?: number;
  yearEnd?: number;
}

/**
 * The same search `src/lib/archiveOrg.ts` has used for months, plus the three
 * fields the sleeper rule needs. `publicdate` is when the ITEM went up, not
 * when the show happened — the rule divides downloads by it.
 *
 * Caveat worth remembering: Archive items are shows, not song performances,
 * so this full-text match finds shows whose description mentions the title.
 * That is the known ceiling on accuracy (see docs/sleeper-methodology.md),
 * not a bug in the scoring.
 */
export function buildArchiveSearchUrl(title: string, opts: ArchiveQuery = {}): string {
  const { rows = 100, yearStart, yearEnd } = opts;
  const era =
    yearStart && yearEnd ? ` AND date:[${yearStart}-01-01 TO ${yearEnd}-12-31]` : "";
  const clean = title.replace(/["!?.,;:()\[\]]/g, "").trim();
  const q = encodeURIComponent(`collection:GratefulDead "${clean}"${era}`);
  const fl = ARCHIVE_FIELDS.map((f) => `fl[]=${f}`).join("&");
  return `https://archive.org/advancedsearch.php?q=${q}&${fl}&rows=${rows}&page=1&output=json`;
}

/** The Archive returns numbers as strings often enough to be worth coercing. */
function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/** Map a parsed advancedsearch body to the rule's input. Tolerates junk. */
export function toRecordings(body: unknown): ArchiveRecording[] {
  const docs: Record<string, unknown>[] =
    (body as { response?: { docs?: Record<string, unknown>[] } })?.response?.docs ?? [];
  return docs
    .map((d) => ({
      identifier: String(d.identifier ?? ""),
      date: str(d.date),
      avgRating: num(d.avg_rating),
      numReviews: num(d.num_reviews),
      downloads: num(d.downloads),
      publicDate: str(d.publicdate),
    }))
    .filter((r) => r.identifier !== "");
}
