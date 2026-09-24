import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

const { latest } = vi.hoisted(() => ({
  latest: { value: null as null | { commitSha: string; publishedAt: string } },
}));
vi.mock("@/lib/webReleases", async (orig) => ({
  ...(await orig<typeof import("@/lib/webReleases")>()),
  fetchLatestRelease: vi.fn(async () => latest.value),
}));

import GitHubSyncBadge from "@/components/GitHubSyncBadge";

const SHA = "7acddcfa39f9a9f9e7e09b47e9e210a99f324ba5";
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  // Lovable built without .git: no stamped sha, but the build time is real.
  vi.stubGlobal("__BUILD_SHA__", "unknown");
  vi.stubGlobal("__BUILD_SHA_SHORT__", "unknown");
  vi.stubGlobal("__BUILD_TIME__", "2026-09-24T00:54:50.984Z");
});
afterEach(() => vi.unstubAllGlobals());

const compareInSync = () => ({
  ok: true,
  status: 200,
  headers: new Headers(),
  json: async () => ({
    status: "identical",
    ahead_by: 0,
    behind_by: 0,
    files: [],
    base_commit: {
      sha: SHA,
      html_url: `https://github.com/x/commit/${SHA}`,
      commit: { message: "Work in progress", committer: { date: "2026-09-24T00:51:52Z" } },
    },
  }),
});

describe("GitHubSyncBadge without a stamped sha", () => {
  it("falls back to the recorded release that covers this build", async () => {
    latest.value = { commitSha: SHA, publishedAt: "2026-09-24T00:55:36Z" };
    fetchMock.mockResolvedValue(compareInSync());

    render(<GitHubSyncBadge />);

    await screen.findByText("In sync with main");
    expect(fetchMock.mock.calls[0][0]).toContain(`compare/main...${SHA}`);
    expect(screen.getByText(/from release log/)).toBeInTheDocument();
  });

  it("will not borrow a release older than the build", async () => {
    latest.value = { commitSha: SHA, publishedAt: "2026-09-23T23:22:36Z" };

    render(<GitHubSyncBadge />);

    await screen.findByText("Sync unknown");
    expect(screen.getByText(/newer than the last recorded release/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says so when nothing is recorded", async () => {
    latest.value = null;

    render(<GitHubSyncBadge />);

    await screen.findByText(/no release is recorded/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
