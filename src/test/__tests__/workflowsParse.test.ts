import { describe, expect, it } from "vitest";
// `yaml` is not a direct dependency: it arrives through the Tailwind/PostCSS
// toolchain and is in bun.lock. If it ever stops arriving, this import fails
// loudly, which is the right way for this test to break.
import { parse } from "yaml";
import { listSourceFiles, readSource } from "@/test/sourceFiles";

/**
 * Every workflow file must be valid YAML.
 *
 * stamp-build-sha.yml carried `if: ${{ !startsWith(..., 'chore: stamp build') }}`
 * unquoted. The ': ' inside the string ends a plain YAML scalar, so GitHub
 * rejected the whole file. Each push then showed a failed run named after the
 * file path, with no job and no log, and the stamp could never have run on main.
 * Nothing in the repo parsed workflows, so the first thing to notice it would
 * have been build_sha "unknown" returning after a publish.
 */
describe("GitHub workflows", () => {
  const files = listSourceFiles(".github/workflows", { match: /\.ya?ml$/ });

  it("finds the workflows", () => {
    expect(files).toContain(".github/workflows/stamp-build-sha.yml");
  });

  it.each(files)("%s parses, with a trigger and jobs", (file) => {
    const doc = parse(readSource(file));
    expect(doc).toBeTypeOf("object");
    expect(doc.on).toBeTruthy();
    expect(Object.keys(doc.jobs ?? {}).length).toBeGreaterThan(0);
  });
});
