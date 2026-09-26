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
export function monthsOnline(publicDate: string | null, now: Date): number | null {
  if (!publicDate) return null;
  const up = Date.parse(publicDate);
  if (Number.isNaN(up)) return null;
  const months = (now.getTime() - up) / (1000 * 60 * 60 * 24 * 30.44);
  if (months < 0) return null;
  return Math.max(months, MIN_MONTHS_ONLINE);
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
): SleeperReport {
  const scored: ScoredRecording[] = recordings.map((r) => {
    const months = monthsOnline(r.publicDate, now);
    const pullsPerMonth =
      months == null || r.downloads == null ? null : r.downloads / months;
    return { ...r, pullsPerMonth, isSleeper: false, verdict: "undateable" };
  });

  // Only recordings with enough reviews get a say in what "good" means here.
  const credible = scored.filter(
    (r) => r.avgRating != null && (r.numReviews ?? 0) >= MIN_REVIEWS,
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
  const cutoff = comparable ? (leaderPullsPerMonth as number) * SLEEPER_RATIO : 0;

  for (const r of scored) {
    if (r.pullsPerMonth == null) {
      r.verdict = "undateable";
      continue;
    }
    if (!comparable) {
      r.verdict = "leader";
      continue;
    }
    if (r.avgRating == null || (r.numReviews ?? 0) < MIN_REVIEWS) {
      r.verdict = "too-few-reviews";
      continue;
    }
    if (bestRating != null && r.avgRating < bestRating - RATING_TOLERANCE) {
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
