import { describe, it, expect } from "vitest";
import { classifyCompare, shipsInApp } from "@/lib/githubSync";

describe("shipsInApp", () => {
  it("counts app code, the native shell and deployed functions", () => {
    for (const path of [
      "src/pages/Admin.tsx",
      "ios/App/App/WebAuthPlugin.swift",
      "public/sw.js",
      "supabase/functions/ai-deadhead/index.ts",
      "package.json",
      "capacitor.config.ts",
      "index.html",
    ]) {
      expect(shipsInApp(path)).toBe(true);
    }
  });

  it("does not count docs, migrations or CI config", () => {
    for (const path of [
      "docs/appstore/SUBMISSION-STATE.md",
      "CLAUDE.md",
      "README.md",
      ".github/workflows/ios-testflight.yml",
      "reports/growth/2026-09-19.md",
    ]) {
      expect(shipsInApp(path)).toBe(false);
    }
  });
});

describe("classifyCompare", () => {
  // Every fixture below is a `compare/{buildSha}...{branch}` response, so its
  // status/ahead_by/behind_by describe the BRANCH and `files` is merge base →
  // branch. The tests this replaced used the opposite direction AND populated
  // `files` on a response where GitHub returns none — they asserted against a
  // shape the API cannot emit, which is why they passed while the badge lied.

  it("reports shipped drift when the branch is ahead — the 2026-09-22 case", () => {
    // Deployed 5387c6c, main 0353397, eleven commits, six of them source.
    // The badge showed a green "nothing that ships" over exactly this.
    const verdict = classifyCompare({
      status: "ahead",
      ahead_by: 11,
      behind_by: 0,
      files: [
        { filename: "CLAUDE.md" },
        { filename: "docs/RELEASING.md" },
        { filename: "src/lib/authFunnel.ts" },
        { filename: "src/pages/Auth.tsx" },
      ],
    });

    expect(verdict.status).toBe("behind");
    expect(verdict.behind).toBe(11);
    expect(verdict.ahead).toBe(0);
    expect(verdict.appFiles).toEqual(["src/lib/authFunnel.ts", "src/pages/Auth.tsx"]);
    expect(verdict.docsOnly).toBe(false);
  });

  it("stays quiet when the branch moved only in docs", () => {
    const verdict = classifyCompare({
      status: "ahead",
      ahead_by: 2,
      behind_by: 0,
      files: [{ filename: "docs/appstore/SUBMISSION-STATE.md" }],
    });

    expect(verdict.status).toBe("behind");
    expect(verdict.docsOnly).toBe(true);
    expect(verdict.appFiles).toEqual([]);
  });

  it("reports a build cut from a branch as ahead, not behind", () => {
    // The build-24 case: branch behind the build, so GitHub says "behind".
    const verdict = classifyCompare({ status: "behind", ahead_by: 0, behind_by: 2, files: [] });

    expect(verdict.status).toBe("ahead");
    expect(verdict.ahead).toBe(2);
    expect(verdict.behind).toBe(0);
  });

  it("never calls an ahead build docs-only, because `files` cannot see that side", () => {
    // `files` is merge base → branch, so it is empty here BY CONSTRUCTION and
    // says nothing about what the build carries. Empty must not read as quiet.
    const verdict = classifyCompare({ status: "behind", ahead_by: 0, behind_by: 4, files: [] });
    expect(verdict.docsOnly).toBe(false);
  });

  it("never calls a diverged build docs-only — half the drift is invisible", () => {
    const verdict = classifyCompare({
      status: "diverged",
      ahead_by: 4,
      behind_by: 1,
      files: [{ filename: "docs/RELEASING.md" }],
    });
    expect(verdict).toMatchObject({ status: "diverged", behind: 4, ahead: 1 });
    expect(verdict.docsOnly).toBe(false);
  });

  it("treats identical as in sync, with no drift to report", () => {
    const verdict = classifyCompare({ status: "identical", ahead_by: 0, behind_by: 0, files: [] });
    expect(verdict).toEqual({
      status: "in-sync",
      ahead: 0,
      behind: 0,
      appFiles: [],
      docsOnly: false,
    });
  });

  it("over-reports rather than under-reports on a malformed response", () => {
    // A sync badge that silently says "in sync" when it cannot tell is worse
    // than one that says "diverged".
    expect(classifyCompare({}).status).toBe("diverged");
    expect(classifyCompare({ status: "something-new" }).status).toBe("diverged");
    expect(classifyCompare({}).docsOnly).toBe(false);
  });
});
