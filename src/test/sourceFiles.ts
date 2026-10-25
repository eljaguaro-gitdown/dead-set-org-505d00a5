import { readFileSync, readdirSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

/**
 * Reading and listing for the source-scanning tests: the ones that read files
 * under src/ and supabase/ and regex-match their text.
 *
 * Those tests were written on Linux, and a Windows checkout broke them in three
 * ways. core.autocrlf writes CRLF into the working tree, so a pattern with a
 * `\n` in it stops matching. Paths come back with backslashes, so a comparison
 * against "lib/instagramShare.ts" never matches. And `execSync("git ls-files
 * 'src/**'")` runs under cmd.exe, which passes the single quotes through to
 * git as part of the pattern, so the list came back empty.
 *
 * The failures were the visible half. The other half is that the same breakage
 * PASSES a negative assertion: a `not.toMatch` with a `\n` in it, or an
 * `expect(files.some(f => f.endsWith("lib/x.ts"))).toBe(false)`, is green on
 * Windows whatever the code says. Read and list through these and the text and
 * the paths look the same on every machine.
 */

/** The repository root, absolute. */
export const REPO_ROOT = resolve(__dirname, "../..");

/** A path the way the repo writes it: relative to the root, forward slashes. */
export const repoPath = (path: string): string =>
  relative(REPO_ROOT, resolve(REPO_ROOT, path)).split(sep).join("/");

/**
 * A file's text with CRLF folded to LF. Takes a repo-relative path (or an
 * absolute one), so a test does not depend on the directory vitest runs from.
 */
export const readSource = (path: string): string =>
  readFileSync(resolve(REPO_ROOT, path), "utf8").replace(/\r\n/g, "\n");

/**
 * Every file under `dir` whose name matches `match`, as sorted repo paths
 * ("src/lib/shareCopy.ts"). It walks the filesystem rather than asking git or
 * a shell, so it returns the same list on every platform, and it includes a
 * file that has not been committed yet, which is the file most likely to break
 * a rule. `skipDirs` skips a directory of that name at any depth.
 */
export const listSourceFiles = (
  dir: string,
  { match = /\.tsx?$/, skipDirs = [] }: { match?: RegExp; skipDirs?: string[] } = {},
): string[] => {
  const walk = (abs: string): string[] =>
    readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
      const full = resolve(abs, e.name);
      if (e.isDirectory()) return skipDirs.includes(e.name) ? [] : walk(full);
      return match.test(e.name) ? [repoPath(full)] : [];
    });
  return walk(resolve(REPO_ROOT, dir)).sort();
};
