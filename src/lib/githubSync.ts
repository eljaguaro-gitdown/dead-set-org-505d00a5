/**
 * Reading GitHub's compare API into a verdict the admin badge can show.
 *
 * The badge used to compare shas for equality: same sha meant in sync, and
 * anything else meant "Behind main". That was wrong in two directions at once.
 * A build cut from a branch ahead of `main` — which is how builds 23 and 24
 * shipped — reported as behind, because nothing ever set the "ahead" state the
 * component already had. And a `main` that had moved only in `docs/` raised the
 * same amber warning as one carrying unshipped app code, so the warning that
 * matters looked exactly like the warning that does not.
 *
 * `GET /repos/{repo}/compare/{base}...{head}` answers both properly: `status`
 * distinguishes identical / ahead / behind / diverged, and `files` says what
 * actually differs.
 *
 * The direction of that call is load-bearing, and the badge had it backwards.
 * GitHub's `files` is the diff from the **merge base to HEAD** — not a
 * symmetric difference. Calling `compare/main...{buildSha}` to ask "is this
 * build behind main" puts the build at HEAD, and a build that is behind is an
 * ancestor of main, so the merge base IS the build and `files` comes back
 * EMPTY. `appFiles` was therefore always `[]` whenever the build was behind,
 * `docsOnly` was structurally always true, and the badge showed a green
 * "nothing that ships" over six changed source files. It did this on
 * 2026-09-22 while `main` carried the OAuth funnel fix the web was missing.
 *
 * So the call is `compare/{buildSha}...{branch}`: the branch is HEAD, the
 * merge base is the build, and `files` is exactly "what the branch has that
 * this build does not". The trade is that `status`, `ahead_by` and `behind_by`
 * now describe the BRANCH relative to the build, so they are inverted below to
 * stay build-relative — which is what the badge reads.
 */

export type SyncStatus = "in-sync" | "ahead" | "behind" | "diverged";

export interface SyncVerdict {
  status: SyncStatus;
  /** Commits this build has that the branch does not. */
  ahead: number;
  /** Commits the branch has that this build does not. */
  behind: number;
  /** Differing paths that actually ship — app code, native shell, functions. */
  appFiles: string[];
  /** The branch moved, but nothing that ships moved with it. */
  docsOnly: boolean;
}

/**
 * A `compare/{buildSha}...{branch}` response. Every field here describes the
 * BRANCH relative to the build, because the branch is HEAD in that call.
 */
export interface CompareResponse {
  /** The branch's relation to the build: identical / ahead / behind / diverged. */
  status?: string;
  /** Commits the BRANCH has beyond the merge base. */
  ahead_by?: number;
  /** Commits the BUILD has beyond the merge base. */
  behind_by?: number;
  /** Merge base → branch. What the branch has that this build does not. */
  files?: { filename?: string }[];
}

/**
 * Does this path end up in front of a fan?
 *
 * `supabase/functions/` counts: it does not ride the bundle, but it is
 * deployed code and drift there is a real difference between this build and
 * `main`. Everything else — `docs/`, `*.md`, `.github/` — is not.
 */
export const shipsInApp = (path: string): boolean =>
  /^(src\/|ios\/|android\/|public\/|supabase\/functions\/)/.test(path) ||
  /^(index\.html|package\.json|bun\.lock|package-lock\.json|vite\.config\.ts|capacitor\.config\.ts|tailwind\.config\.ts)$/.test(
    path,
  );

// Inverted on purpose. The key is the branch's status relative to the build;
// the value is the build's status relative to the branch, which is what the
// badge says out loud. A branch that is "ahead" means this build is behind.
const STATUSES: Record<string, SyncStatus> = {
  identical: "in-sync",
  ahead: "behind",
  behind: "ahead",
  diverged: "diverged",
};

export function classifyCompare(compare: CompareResponse): SyncVerdict {
  // An unknown status is treated as divergence rather than as in-sync: the
  // honest failure for a sync badge is to over-report drift, not under-report
  // it.
  const status = STATUSES[compare.status ?? ""] ?? "diverged";
  // Also inverted: the branch's ahead_by is how far this build is BEHIND.
  const behind = compare.ahead_by ?? 0;
  const ahead = compare.behind_by ?? 0;

  const appFiles = (compare.files ?? [])
    .map((f) => f?.filename ?? "")
    .filter((name) => name !== "" && shipsInApp(name));

  return {
    status,
    ahead,
    behind,
    appFiles,
    // Only claimable when the file list actually covers the gap, which is the
    // behind-and-not-also-ahead case: `files` describes merge base → branch,
    // so it says nothing about commits this build has that the branch lacks.
    // A diverged build has drift in both directions and only one is visible,
    // so it never gets the quiet verdict.
    docsOnly: status === "behind" && behind > 0 && appFiles.length === 0,
  };
}
