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
 * actually differs. It also carries `base_commit`, so one request replaces the
 * branch lookup the badge used to make separately.
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

export interface CompareResponse {
  status?: string;
  ahead_by?: number;
  behind_by?: number;
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

const STATUSES: Record<string, SyncStatus> = {
  identical: "in-sync",
  ahead: "ahead",
  behind: "behind",
  diverged: "diverged",
};

export function classifyCompare(compare: CompareResponse): SyncVerdict {
  // An unknown status is treated as divergence rather than as in-sync: the
  // honest failure for a sync badge is to over-report drift, not under-report
  // it.
  const status = STATUSES[compare.status ?? ""] ?? "diverged";
  const ahead = compare.ahead_by ?? 0;
  const behind = compare.behind_by ?? 0;

  const appFiles = (compare.files ?? [])
    .map((f) => f?.filename ?? "")
    .filter((name) => name !== "" && shipsInApp(name));

  return {
    status,
    ahead,
    behind,
    appFiles,
    docsOnly: status !== "in-sync" && behind > 0 && appFiles.length === 0,
  };
}
