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
  it("reports a build cut from a branch as ahead, not behind", () => {
    // The build-24 case: the state the old badge could never reach.
    const verdict = classifyCompare({
      status: "ahead",
      ahead_by: 2,
      behind_by: 0,
      files: [{ filename: "src/lib/oauthSignIn.ts" }],
    });

    expect(verdict.status).toBe("ahead");
    expect(verdict.ahead).toBe(2);
    expect(verdict.docsOnly).toBe(false);
  });

  it("flags docs-only drift as docs-only", () => {
    // Exactly what main looked like after PR #54 merged: one doc commit and a
    // merge commit, nothing shipped.
    const verdict = classifyCompare({
      status: "behind",
      ahead_by: 0,
      behind_by: 2,
      files: [{ filename: "docs/appstore/SUBMISSION-STATE.md" }],
    });

    expect(verdict.status).toBe("behind");
    expect(verdict.docsOnly).toBe(true);
    expect(verdict.appFiles).toEqual([]);
  });

  it("does not excuse drift once one shipped file moves", () => {
    const verdict = classifyCompare({
      status: "behind",
      ahead_by: 0,
      behind_by: 3,
      files: [
        { filename: "docs/appstore/SUBMISSION-STATE.md" },
        { filename: "src/pages/Auth.tsx" },
      ],
    });

    expect(verdict.docsOnly).toBe(false);
    expect(verdict.appFiles).toEqual(["src/pages/Auth.tsx"]);
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

  it("carries both counts when history diverged", () => {
    const verdict = classifyCompare({
      status: "diverged",
      ahead_by: 1,
      behind_by: 4,
      files: [{ filename: "src/App.tsx" }],
    });
    expect(verdict).toMatchObject({ status: "diverged", ahead: 1, behind: 4 });
  });

  it("over-reports rather than under-reports on a malformed response", () => {
    // A sync badge that silently says "in sync" when it cannot tell is worse
    // than one that says "diverged".
    expect(classifyCompare({}).status).toBe("diverged");
    expect(classifyCompare({ status: "something-new" }).status).toBe("diverged");
  });
});
