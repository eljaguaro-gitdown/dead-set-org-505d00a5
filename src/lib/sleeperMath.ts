/**
 * The arithmetic behind the badges — one definition, used everywhere a version
 * is called a sleeper.
 *
 * This lived inline in SongEraLadder. The moment a second surface wanted to
 * say "rare gem" it had to agree with the ladder exactly, or the app would be
 * calling the same version a sleeper in one place and ordinary in another.
 * Same class as the slot-notes encoder: a second copy of a shared rule is a
 * silent divergence waiting to happen.
 *
 * The rule: versions carry vote counts from a public all-time list. A sleeper
 * is one that polls under 30% of that song's leader — enough regard to be on
 * the list at all, not enough to get played.
 */

export const SLEEPER_RATIO = 0.3;

export interface VotedVersion {
  votes: number | null;
  is_benchmark?: boolean | null;
}

/** Highest vote count among a song's ranked versions. 0 when nothing is ranked. */
export const leaderVotes = (versions: VotedVersion[]): number =>
  versions.reduce((max, v) => Math.max(max, v.votes ?? 0), 0);

/** The vote count a version must poll under to count as a sleeper. */
export const sleeperCutoff = (versions: VotedVersion[]): number =>
  leaderVotes(versions) * SLEEPER_RATIO;

/**
 * True when this version is a sleeper *within this set of versions*. The
 * comparison is always against the song's own leader, never across songs —
 * 40 votes is a sleeper next to 181 and a landslide next to 90.
 */
export const isSleeper = (version: VotedVersion, versions: VotedVersion[]): boolean => {
  const leader = leaderVotes(versions);
  return version.votes != null && leader > 0 && version.votes < leader * SLEEPER_RATIO;
};

export const sleepers = <T extends VotedVersion>(versions: T[]): T[] =>
  versions.filter((v) => isSleeper(v, versions));

/** Share of the leader's vote count, 0–100, for the strength bar. */
export const votePercent = (version: VotedVersion, versions: VotedVersion[]): number => {
  const leader = leaderVotes(versions);
  return leader ? Math.round(((version.votes ?? 0) / leader) * 100) : 0;
};

/** True when a song has enough ranked versions for any of this to mean anything. */
export const hasVoteData = (versions: VotedVersion[]): boolean =>
  versions.some((v) => v.votes != null) && leaderVotes(versions) > 0;

/**
 * The one-line version of the method, shown without being asked.
 * Kept here so every surface says the same sentence.
 */
export const METHOD_LINE =
  "Ranked on fan votes. The ones polling under 30% of the leader are the sleepers.";

/**
 * What we say when a song has no votes behind it — which is 232 of 234.
 *
 * It used to open "Nobody's voted this one onto an all-time list yet", which
 * is true and is also an apology in the one place the page should feel like a
 * find: four words of absence at the top of a song with 382 performances
 * behind it. Claiming a method we did not apply would still be worse, so the
 * gap stays stated — it just stops going first. Lead with what IS here.
 */
export const NO_VOTES_LINE =
  "These are the nights on tape — from the first time they played it to the last. No all-time poll exists for this one yet, so nothing here is ranked against one.";
