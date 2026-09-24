import { describe, it, expect, vi } from "vitest";

// Records each query chain and answers by which terminal method it used.
const chains: { method: string; args: unknown[] }[][] = [];
let fail = false;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      const chain: { method: string; args: unknown[] }[] = [{ method: "from", args: [table] }];
      chains.push(chain);
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "gte", "order", "limit"]) {
        builder[method] = (...args: unknown[]) => {
          chain.push({ method, args });
          return builder;
        };
      }
      builder.then = (resolve: (v: unknown) => void) => {
        if (fail) return resolve({ error: { message: "boom" } });
        const isCount = chain.some((c) => c.method === "gte");
        resolve(isCount ? { count: 2, error: null } : { data: [{ published_at: "2026-09-23T23:22:36Z" }], error: null });
      };
      return builder;
    },
  },
}));

import { fetchReleaseActivity, releaseCoversBuild } from "@/lib/webReleases";

describe("fetchReleaseActivity", () => {
  it("counts releases in the seven days before now, and reads the latest", async () => {
    chains.length = 0;
    fail = false;
    const now = Date.parse("2026-09-24T12:00:00Z");
    const result = await fetchReleaseActivity(now);

    expect(result).toEqual({ thisWeek: 2, lastReleasedAt: "2026-09-23T23:22:36Z" });
    expect(chains.every((c) => c[0].args[0] === "web_releases")).toBe(true);
    const gte = chains.flat().find((c) => c.method === "gte");
    expect(gte?.args).toEqual(["published_at", "2026-09-17T12:00:00.000Z"]);
    const order = chains.flat().find((c) => c.method === "order");
    expect(order?.args).toEqual(["published_at", { ascending: false }]);
  });

  it("returns null when the table cannot be read", async () => {
    fail = true;
    expect(await fetchReleaseActivity()).toBeNull();
  });
});


describe("releaseCoversBuild", () => {
  const release = { commitSha: "7acddcfa39f9a9f9e7e09b47e9e210a99f324ba5", publishedAt: "2026-09-24T00:55:36Z" };

  it("accepts the release recorded after this build went live", () => {
    // 2026-09-24: built 00:54:50, confirmed live and recorded 00:55:36.
    expect(releaseCoversBuild(release, "2026-09-24T00:54:50.984Z")).toBe(true);
  });

  it("refuses a release older than the build — that build was never recorded", () => {
    expect(releaseCoversBuild(release, "2026-09-24T02:10:00Z")).toBe(false);
  });

  it("refuses when the build time is unknown", () => {
    expect(releaseCoversBuild(release, "")).toBe(false);
  });
});
