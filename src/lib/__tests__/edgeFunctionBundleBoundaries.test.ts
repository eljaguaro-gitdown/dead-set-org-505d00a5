import { describe, expect, it } from "vitest";
import { posix } from "node:path";
import { listSourceFiles, readSource } from "@/test/sourceFiles";

/**
 * The edge-function bundler packs a function's own folder and `_shared/`, and
 * nothing else. On 2026-11-24 `tape-desk` imported OWNER_INBOXES from
 * `../send-transactional-email/authorize.ts`. Typecheck, vitest, the build and
 * `deno check` were all green, because every file exists in the repo. Only the
 * deploy saw it ("Module not found"), after merge. So the rule is checked here,
 * where a pull request can see it:
 *
 *   - a function's file may import from its own folder or from _shared/;
 *   - a _shared/ file may import only from _shared/ (it is packed into every
 *     function, and none of them carries another function's folder).
 *
 * Remote specifiers (npm:, jsr:, https:) are not files and are not checked.
 */
const FUNCTIONS = "supabase/functions";

const specifiers = (src: string): string[] => {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  return [
    ...code.matchAll(/\bfrom\s+(['"])(\.{1,2}\/[^'"]+)\1/g),
    ...code.matchAll(/\bimport\s*\(\s*(['"])(\.{1,2}\/[^'"]+)\1\s*\)/g),
    ...code.matchAll(/^\s*import\s+(['"])(\.{1,2}\/[^'"]+)\1/gm),
  ].map((m) => m[2]);
};

/** Every relative import that leaves the folder the bundler packs. */
export const boundaryViolations = (files: string[], read: (p: string) => string): string[] => {
  const out: string[] = [];
  for (const file of files) {
    const rel = file.slice(FUNCTIONS.length + 1);
    const home = rel.split("/")[0];
    const allowed = home === "_shared" ? ["_shared"] : [home, "_shared"];
    for (const spec of specifiers(read(file))) {
      const target = posix.normalize(posix.join(posix.dirname(rel), spec));
      const top = target.split("/")[0];
      if (target.startsWith("..") || !allowed.includes(top)) out.push(`${file} imports ${spec}`);
    }
  }
  return out;
};

describe("edge functions import only what the bundler packs", () => {
  const files = listSourceFiles(FUNCTIONS, { match: /\.(ts|tsx|mts|js|mjs)$/ });

  it("finds the functions to check", () => {
    expect(files).toContain("supabase/functions/tape-desk/index.ts");
    expect(files).toContain("supabase/functions/_shared/ownerInboxes.ts");
  });

  it("no function reaches into another function's folder, and _shared stays inside _shared", () => {
    expect(boundaryViolations(files, readSource)).toEqual([]);
  });

  it("would have caught the tape-desk import that failed to deploy", () => {
    const fake = (src: string) => () => src;
    expect(boundaryViolations(["supabase/functions/tape-desk/index.ts"], fake(`import { OWNER_INBOXES } from "../send-transactional-email/authorize.ts";`))).toEqual([
      "supabase/functions/tape-desk/index.ts imports ../send-transactional-email/authorize.ts",
    ]);
  });

  it("sees single quotes, dynamic imports, bare side-effect imports and a _shared file reaching out", () => {
    expect(boundaryViolations(["supabase/functions/a/index.ts"], () => `import x from '../b/x.ts'`)).toHaveLength(1);
    expect(boundaryViolations(["supabase/functions/a/index.ts"], () => `const m = await import("../b/x.ts")`)).toHaveLength(1);
    expect(boundaryViolations(["supabase/functions/a/index.ts"], () => `import "../b/side.ts";`)).toHaveLength(1);
    expect(boundaryViolations(["supabase/functions/_shared/x.ts"], () => `import { y } from "../a/y.ts";`)).toHaveLength(1);
    expect(boundaryViolations(["supabase/functions/a/index.ts"], () => `import x from "../../../src/lib/x.ts";`)).toHaveLength(1);
  });

  it("allows the function's own folder, _shared, and remote specifiers", () => {
    const ok = [
      `import { a } from "./logic.ts";`,
      `import { b } from "../_shared/requireAdmin.ts";`,
      `import { c } from "./sub/../logic.ts";`,
      `import { createClient } from "npm:@supabase/supabase-js@2";`,
    ].join("\n");
    expect(boundaryViolations(["supabase/functions/a/index.ts"], () => ok)).toEqual([]);
    expect(boundaryViolations(["supabase/functions/_shared/x.ts"], () => `import { t } from "./tapeMatch.ts";`)).toEqual([]);
  });

  it("ignores a commented-out import", () => {
    expect(boundaryViolations(["supabase/functions/a/index.ts"], () => `// import x from "../b/x.ts";`)).toEqual([]);
  });
});
