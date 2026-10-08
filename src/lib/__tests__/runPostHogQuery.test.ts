import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  POSTHOG_QUERY_TIMEOUT_MS,
  runPostHogQuery,
  type PostHogQueryConfig,
} from "../../../supabase/functions/_shared/runPostHogQuery";

/**
 * The PostHog call behind the admin dashboard's traffic tiles and the daily and
 * weekly reports. Gate 8 (2026-10-08) found it had no timeout: admin-users
 * awaits it in the Promise.all that loads the user list, so a PostHog that
 * never answered held the whole dashboard. These run the real function with a
 * stand-in fetch.
 */

type FetchArgs = [string, RequestInit];

/** A fetch that never answers, and rejects the way real fetch does on abort. */
const makeHangingFetch = () =>
  vi.fn((_url: string, init: RequestInit) =>
    new Promise<Response>((_, reject) => {
      init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    }),
  );

const answering = (status: number, body: unknown) =>
  vi.fn(async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status }));

const config = (overrides: Partial<PostHogQueryConfig> = {}): PostHogQueryConfig => ({
  apiKey: "phx_test",
  projectId: "617063",
  host: undefined,
  ...overrides,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runPostHogQuery: the timeout", () => {
  it("gives up and returns null when PostHog never answers", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const hangingFetch = makeHangingFetch();
    const started = Date.now();
    const rows = await runPostHogQuery("t", "SELECT 1", config({ fetchImpl: hangingFetch, timeoutMs: 50 }));
    expect(rows).toBeNull();
    expect(Date.now() - started).toBeLessThan(2_000);
    const [, init] = hangingFetch.mock.calls[0] as FetchArgs;
    expect(init.signal?.aborted).toBe(true);
  });

  it("gives up when the answer starts but the body never finishes", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => ({
      ok: true,
      status: 200,
      json: () =>
        new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(init.signal?.reason))),
    }) as unknown as Response);
    expect(await runPostHogQuery("t", "SELECT 1", config({ fetchImpl, timeoutMs: 50 }))).toBeNull();
  });

  it("waits 10 seconds by default, and not a moment longer", async () => {
    expect(POSTHOG_QUERY_TIMEOUT_MS).toBe(10_000);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.useFakeTimers();
    try {
      let settled: unknown = "pending";
      void runPostHogQuery("t", "SELECT 1", config({ fetchImpl: makeHangingFetch() })).then((r) => { settled = r; });
      await vi.advanceTimersByTimeAsync(9_999);
      expect(settled).toBe("pending");
      await vi.advanceTimersByTimeAsync(1);
      expect(settled).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("leaves no timer behind once PostHog has answered", async () => {
    vi.useFakeTimers();
    try {
      await runPostHogQuery("t", "SELECT 1", config({ fetchImpl: answering(200, { columns: [], results: [] }) }));
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("runPostHogQuery: the request and the answer", () => {
  it("posts the HogQL to the project's query endpoint with the personal key", async () => {
    const fetchImpl = answering(200, { columns: [], results: [] });
    await runPostHogQuery("named query", "SELECT 2", config({ fetchImpl }));
    const [url, init] = fetchImpl.mock.calls[0] as unknown as FetchArgs;
    expect(url).toBe("https://us.posthog.com/api/projects/617063/query/");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer phx_test");
    expect(JSON.parse(init.body as string)).toEqual({ query: { kind: "HogQLQuery", query: "SELECT 2" }, name: "named query" });
  });

  it("uses a configured host, without a trailing slash", async () => {
    const fetchImpl = answering(200, { columns: [], results: [] });
    await runPostHogQuery("t", "SELECT 1", config({ fetchImpl, host: "https://eu.posthog.com/" }));
    expect((fetchImpl.mock.calls[0] as unknown as FetchArgs)[0]).toBe("https://eu.posthog.com/api/projects/617063/query/");
  });

  it("returns rows keyed by column name", async () => {
    const fetchImpl = answering(200, { columns: ["unique7d", "pageViews30d"], results: [[20, 211]] });
    expect(await runPostHogQuery("t", "SELECT 1", config({ fetchImpl }))).toEqual([{ unique7d: 20, pageViews30d: 211 }]);
  });

  it("returns null, without asking, when the key or project id is missing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const missing of [{ apiKey: undefined }, { projectId: undefined }, { apiKey: "" }]) {
      const fetchImpl = answering(200, { columns: [], results: [] });
      expect(await runPostHogQuery("t", "SELECT 1", config({ ...missing, fetchImpl }))).toBeNull();
      expect(fetchImpl).not.toHaveBeenCalled();
    }
  });

  it("returns null on a failing status, which is a resolved promise, not a rejection", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const status of [401, 429, 500, 503]) {
      expect(await runPostHogQuery("t", "SELECT 1", config({ fetchImpl: answering(status, "nope") }))).toBeNull();
    }
  });

  it("returns null when fetch rejects or the body is not JSON", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const rejecting = vi.fn(async () => { throw new TypeError("network down"); });
    expect(await runPostHogQuery("t", "SELECT 1", config({ fetchImpl: rejecting }))).toBeNull();
    expect(await runPostHogQuery("t", "SELECT 1", config({ fetchImpl: answering(200, "<html>") }))).toBeNull();
  });
});

describe("queryPostHog is only the secrets around runPostHogQuery", () => {
  const src = readFileSync(join(process.cwd(), "supabase/functions/_shared/posthogQuery.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

  it("passes the three secrets and nothing that would override the timeout", () => {
    expect(src).toMatch(/runPostHogQuery<Row>\(name, sql, \{\s*apiKey: Deno\.env\.get\('POSTHOG_PERSONAL_API_KEY'\),\s*projectId: Deno\.env\.get\('POSTHOG_PROJECT_ID'\),\s*host: Deno\.env\.get\('POSTHOG_API_HOST'\),\s*\}\)/);
    expect(src).not.toMatch(/timeoutMs|fetchImpl/);
  });

  it("does not keep a second copy of the request", () => {
    expect(src).not.toMatch(/\bfetch\(/);
    expect(src).not.toMatch(/\/query\//);
  });
});
