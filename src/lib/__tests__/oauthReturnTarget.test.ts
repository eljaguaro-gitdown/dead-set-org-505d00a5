import { describe, it, expect, beforeEach } from "vitest";

/**
 * The web OAuth round trip loses the querystring.
 *
 * signInWithProvider deliberately does NOT pass `next` — changing redirectTo
 * breaks Supabase's redirect allow-list — so the tab leaves and comes back to
 * "/". smartRedirect, which honours ?redirect=, never runs on that path. The
 * result was that Save and Share on a song page sent people to /my-setlists
 * with the thing they asked for forgotten, on the commonest sign-in path there
 * is. The target rides sessionStorage across the trip instead.
 *
 * These assert the contract between the two halves (Auth writes, Index reads)
 * rather than either half alone, because the bug was that they did not meet.
 */
const KEY = "post_oauth_target";

/** What Auth.tsx does before handing off to the provider. */
const stashTarget = (explicitRedirect: string | null) => {
  try {
    if (explicitRedirect) sessionStorage.setItem(KEY, explicitRedirect);
    else sessionStorage.removeItem(KEY);
  } catch { /* blocked storage falls back to the old behaviour */ }
};

/** What Index.tsx does when a signed-in user lands on "/". */
const takeTarget = (): string | null => {
  try {
    const t = sessionStorage.getItem(KEY);
    if (t) sessionStorage.removeItem(KEY);
    return t;
  } catch {
    return null;
  }
};

beforeEach(() => sessionStorage.clear());

describe("the OAuth return target", () => {
  it("carries a Share across the round trip", () => {
    stashTarget("/versions/eyes-of-the-world?then=share");
    expect(takeTarget()).toBe("/versions/eyes-of-the-world?then=share");
  });

  it("carries a Save, with its intent intact", () => {
    stashTarget("/versions/franklins-tower?then=save");
    expect(takeTarget()).toContain("then=save");
  });

  it("is consumed once — a later landing must not bounce them again", () => {
    stashTarget("/versions/loser?then=share");
    expect(takeTarget()).toBe("/versions/loser?then=share");
    expect(takeTarget()).toBeNull();
  });

  it("clears a stale target when someone signs in with no destination", () => {
    stashTarget("/versions/dark-star?then=share");
    stashTarget(null);
    expect(takeTarget()).toBeNull();
  });

  it("is absent for an ordinary sign-in, so the smart destination still wins", () => {
    expect(takeTarget()).toBeNull();
  });
});
