import { describe, it, expect } from "vitest";
import {
  SLEEPER_RATIO,
  leaderVotes,
  sleeperCutoff,
  isSleeper,
  sleepers,
  votePercent,
  hasVoteData,
} from "@/lib/sleeperMath";

/**
 * The numbers here are the real Shakedown Street ladder as it stands in
 * production (15 ranked versions, headyversion vote counts). If the rule ever
 * changes, these fail with the production consequence spelled out rather than
 * a synthetic one.
 */
const SHAKEDOWN = [181, 168, 89, 73, 71, 58, 53, 51, 48, 47, 42, 40, 40, 39, 37].map((votes) => ({
  votes,
}));

describe("sleeperMath against the live Shakedown Street ladder", () => {
  it("reads the leader off the set", () => {
    expect(leaderVotes(SHAKEDOWN)).toBe(181);
  });

  it("puts the cutoff at 30% of the leader", () => {
    expect(SLEEPER_RATIO).toBe(0.3);
    expect(sleeperCutoff(SHAKEDOWN)).toBeCloseTo(54.3, 5);
  });

  it("finds the nine sleepers production shows", () => {
    // 53 and below; 58 sits just over the line and is not one.
    expect(sleepers(SHAKEDOWN).map((v) => v.votes)).toEqual([53, 51, 48, 47, 42, 40, 40, 39, 37]);
  });

  it("does not call the leader or the runner-up a sleeper", () => {
    expect(isSleeper({ votes: 181 }, SHAKEDOWN)).toBe(false);
    expect(isSleeper({ votes: 168 }, SHAKEDOWN)).toBe(false);
    expect(isSleeper({ votes: 58 }, SHAKEDOWN)).toBe(false);
  });

  it("is relative to the song, never across songs", () => {
    // 40 votes is a sleeper beside 181 and a landslide beside 90.
    const smallSong = [90, 40, 30].map((votes) => ({ votes }));
    expect(isSleeper({ votes: 40 }, SHAKEDOWN)).toBe(true);
    expect(isSleeper({ votes: 40 }, smallSong)).toBe(false);
  });
});

describe("sleeperMath edge cases", () => {
  it("calls nothing a sleeper when no version carries votes", () => {
    const unvoted = [{ votes: null }, { votes: null }];
    expect(hasVoteData(unvoted)).toBe(false);
    expect(sleepers(unvoted)).toEqual([]);
    expect(leaderVotes(unvoted)).toBe(0);
  });

  it("ignores unvoted versions sitting beside voted ones", () => {
    const mixed = [{ votes: 100 }, { votes: null }, { votes: 10 }];
    expect(hasVoteData(mixed)).toBe(true);
    expect(sleepers(mixed).map((v) => v.votes)).toEqual([10]);
  });

  it("survives an empty ladder without dividing by zero", () => {
    expect(leaderVotes([])).toBe(0);
    expect(sleeperCutoff([])).toBe(0);
    expect(votePercent({ votes: 5 }, [])).toBe(0);
    expect(hasVoteData([])).toBe(false);
  });

  it("scales the strength bar against the leader", () => {
    expect(votePercent({ votes: 181 }, SHAKEDOWN)).toBe(100);
    expect(votePercent({ votes: 37 }, SHAKEDOWN)).toBe(20);
  });
});
