/**
 * The ranking for the songs nobody voted on — which is 232 of 234.
 *
 * `sleeperMath` reads fan votes off an all-time list. Two songs in the whole
 * catalog have that list. For every other song the picker has to either say
 * nothing or find a different signal, and there is one sitting in the open:
 * archive.org publishes, for every recording, how highly it is rated and how
 * often it is downloaded. Regard and attention. A tape the traders rate high
 * and nobody pulls is the same thing a vote-poll sleeper is — enough regard to
 * be respected, not enough to get heard.
 *
 * What this is NOT: archive.org rates the *recording*, not the performance of
 * one song inside it. The cohort here is already "recordings that contain this
 * song", so within that set the rating is a usable proxy — but it is a proxy,
 * and the copy that surfaces it says "the tape", never "the version".
 */

export interface RegardInput {
  /** archive.org identifier — the stable key for the recording. */
  identifier: string;
  /** avg_rating, 0–5. Null when nobody has rated it. */
  avgRating?: number | null;
  /** num_reviews backing that rating. Null/0 when unrated. */
  reviews?: number | null;
  /** downloads — the attention side. */
  downloads?: number | null;
}

export interface RegardScore extends RegardInput {
  /** Rating pulled toward the cohort mean by how few reviews back it. */
  regard: number;
  /** log10(downloads) — downloads are heavy-tailed, so compare their orders. */
  attention: number;
  /** Share of the cohort this recording out-regards, 0–1. */
  regardRank: number;
  /** Share of the cohort this recording out-draws, 0–1. */
  attentionRank: number;
  /** regardRank − attentionRank. Positive means held higher than it's pulled. */
  overlooked: number;
}

/**
 * How many reviews it takes before a rating speaks for itself. Below this the
 * score is dragged toward the cohort mean, so one five-star review on one tape
 * cannot outrank forty reviews averaging 4.7.
 */
export const PRIOR_WEIGHT = 3;

/** How far a recording must out-rank its own draw before we call it quiet. */
export const QUIET_GEM_THRESHOLD = 0.3;

/**
 * At most this many gems per song, highest `overlooked` first.
 *
 * Measured against live archive.org data: on "Ramble On Rose" the threshold
 * alone flagged 16 of 50 tapes. A chip on a third of the list is wallpaper —
 * the whole value of the mark is that it is rare. Capping beats tuning the
 * threshold per song, which is just overfitting to whichever song I happened
 * to check.
 */
export const MAX_GEMS = 3;

/**
 * Percentiles over three recordings are noise, not a ranking. Under this many
 * the signal reports nothing rather than guessing.
 */
export const MIN_COHORT = 4;

/**
 * Reviews a tape needs before it can be called a gem.
 *
 * An unrated tape takes the cohort mean as its regard, which is the right way
 * to rank it (unknown lands mid-pack) and the wrong way to decide it. Where
 * enough rated tapes sit below that mean, an unrated one clears the better
 * half on nothing at all: the Crazy Fingers 1975 window flagged
 * `gd1975-06-03.145776` — no rating, no reviews, 4,730 downloads — as a gem,
 * and `quietGemReason` returned null, so the chip appeared with no evidence
 * under it. "Held high" has to mean somebody held it.
 *
 * Set to PRIOR_WEIGHT so a gem's own rating is at least half its own score
 * rather than mostly the prior. Live gems carry 14-66 reviews, so this
 * excludes the unrated, not the real ones.
 */
export const MIN_GEM_REVIEWS = PRIOR_WEIGHT;

/** Review-weighted mean rating of the cohort — the prior each tape is pulled toward. */
const cohortMean = (inputs: RegardInput[]): number => {
  let weighted = 0;
  let weight = 0;
  for (const i of inputs) {
    const r = i.reviews ?? 0;
    if (i.avgRating != null && r > 0) {
      weighted += i.avgRating * r;
      weight += r;
    }
  }
  // Nothing in the cohort is rated: the Archive's own house average for this
  // collection, so an unrated cohort lands flat instead of at zero.
  return weight > 0 ? weighted / weight : 4.5;
};

/** Share of `values` strictly below `value`, 0–1. Ties share the lower rank. */
const rankOf = (value: number, values: number[]): number => {
  if (values.length < 2) return 0;
  const below = values.filter((v) => v < value).length;
  return below / (values.length - 1);
};

/**
 * Score a cohort of recordings against each other. Always relative — a 4.6
 * means nothing until you know what the other tapes of this song scored.
 */
export const scoreRecordings = (inputs: RegardInput[]): RegardScore[] => {
  const mean = cohortMean(inputs);

  const partial = inputs.map((i) => {
    const reviews = Math.max(0, i.reviews ?? 0);
    const rating = i.avgRating ?? mean;
    const regard = (rating * reviews + mean * PRIOR_WEIGHT) / (reviews + PRIOR_WEIGHT);
    const attention = Math.log10(Math.max(0, i.downloads ?? 0) + 1);
    return { ...i, regard, attention };
  });

  const regards = partial.map((p) => p.regard);
  const attentions = partial.map((p) => p.attention);

  return partial.map((p) => {
    const regardRank = rankOf(p.regard, regards);
    const attentionRank = rankOf(p.attention, attentions);
    return { ...p, regardRank, attentionRank, overlooked: regardRank - attentionRank };
  });
};

/**
 * True when a recording is held well above where its draw would put it.
 * Also requires it to be in the better half of the cohort on regard — being
 * ignored is not interesting on its own, only being ignored *and* good is.
 */
export const isQuietGem = (score: RegardScore): boolean =>
  (score.reviews ?? 0) >= MIN_GEM_REVIEWS &&
  score.avgRating != null &&
  score.regardRank >= 0.5 &&
  score.overlooked >= QUIET_GEM_THRESHOLD;

/**
 * The gems worth marking: the most overlooked few that clear the bar.
 * Ties break toward the better-regarded tape.
 */
export const quietGems = (scores: RegardScore[], limit = MAX_GEMS): RegardScore[] =>
  scores
    .filter(isQuietGem)
    .sort((a, b) => b.overlooked - a.overlooked || b.regard - a.regard)
    .slice(0, limit);

/**
 * True when the cohort is big enough and carries enough ratings for any of
 * this to mean anything. A cohort nobody has rated has no regard to read.
 */
export const hasRegardData = (inputs: RegardInput[]): boolean =>
  inputs.length >= MIN_COHORT &&
  inputs.some((i) => i.avgRating != null && (i.reviews ?? 0) > 0) &&
  inputs.some((i) => (i.downloads ?? 0) > 0);

/**
 * The method, said plainly, for the songs with no poll behind them.
 * No machinery, no "we rank" — it reads the tape, the way a trader would.
 */
export const REGARD_METHOD_LINE =
  "No all-time poll on this one, so we read the tape box instead. Of the tapes that circulate most, these are the ones held highest and pulled least.";

export const QUIET_GEM_CHIP = "Quiet gem";

/**
 * One line of evidence for a single card, so the chip is never a bare claim.
 * Returns null when the recording carries nothing worth citing.
 */
export const quietGemReason = (score: RegardScore): string | null => {
  const reviews = score.reviews ?? 0;
  if (score.avgRating == null || reviews < 1) return null;
  // Floor, never round: 4.95 printed as "5.0" claims a perfect score the tape
  // does not have, and a number beside a gold chip has to survive being checked.
  const rating = (Math.floor(score.avgRating * 10) / 10).toFixed(1);
  const noun = reviews === 1 ? "review" : "reviews";
  // NOT "less than most tapes of this song". The cohort is already the most-
  // circulated tapes, so a gem sits in the top 1% of the whole population by
  // downloads — on Ramble On Rose, out-drawn by 24 of 2,903. A number printed
  // beside a gold chip has to survive being checked, and that one did not.
  return `${rating} across ${reviews} ${noun}, and pulled less than the other tapes here.`;
};
