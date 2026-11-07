/**
 * Types for resolve.mjs, which vite.config.ts imports.
 *
 * tsconfig.node.json runs with `strict: true` and no `allowJs`, so a .mjs
 * import with no declaration file is TS7016 ("implicitly has an 'any' type")
 * and fails the build. This file is that declaration. Keep it in step with
 * resolve.mjs — the behaviour itself is tested in
 * src/lib/__tests__/buildShaPrecedence.test.ts.
 */

/** Prefix of the commit message the stamp workflow writes. */
export declare const STAMP_SUBJECT_PREFIX: string;

/** Everything resolveBuildSha weighs, in precedence order. */
export interface BuildShaInput {
  /** VITE_BUILD_SHA, when an operator set it. */
  env?: string;
  /** `git rev-parse HEAD`, or "" when git is unavailable. */
  gitHead: string;
  /** `git log -1 --format=%s`, or "" when git is unavailable. */
  gitHeadSubject: string;
  /** `git rev-parse HEAD^`, or "" when git is unavailable. */
  gitParent: string;
  /** The sha in src/buildInfo.ts, or "" when it carries none. */
  stamped: string;
}

/** The commit this build is of: the code commit, never the stamp commit. */
export declare function resolveBuildSha(input: BuildShaInput): string;

/** The text of src/buildInfo.ts for the given sha and build time. */
export declare function renderBuildInfo(sha: string, stampedAt: string): string;

/** The sha in src/buildInfo.ts's text, or "" when it carries none. */
export declare function parseBuildInfo(text: string): string;
