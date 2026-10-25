import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Every PostHog event carries `build_sha`, the commit the bundle was built
 * from, so a release can be dated by the first event that carries it instead
 * of by inference (see src/lib/posthog.ts).
 *
 * The fake below reproduces posthog-js 1.434.2's own order, read from its
 * dist: init calls `config.loaded(this)` synchronously, then schedules the
 * initial $pageview with `setTimeout(…, 1)`. The pageview a visitor lands on
 * is the one that matters most, so the tests assert on THAT event, not on a
 * register call in isolation — registering anywhere after it would leave the
 * landing pageview untagged while still "calling register".
 */

type Captured = { event: string; properties: Record<string, unknown> };

const { fake } = vi.hoisted(() => {
  const fake = {
    captured: [] as { event: string; properties: Record<string, unknown> }[],
    superProps: {} as Record<string, unknown>,
    register(props: Record<string, unknown>) {
      Object.assign(fake.superProps, props);
    },
    capture(event: string, properties: Record<string, unknown> = {}) {
      fake.captured.push({ event, properties: { ...fake.superProps, ...properties } });
    },
    captureException: () => {},
    identify: () => {},
    init(_token: string, config: { loaded?: (ph: unknown) => void }) {
      config.loaded?.(fake);
      setTimeout(() => fake.capture("$pageview"), 1);
    },
  };
  return { fake };
});

vi.mock("posthog-js", () => ({ default: fake }));

const SHA = "4172085362a741715a28b7ea63df1323211cb205";

async function landOnSite(): Promise<Captured[]> {
  vi.resetModules();
  vi.stubEnv("VITE_PUBLIC_POSTHOG_PROJECT_TOKEN", "phc_test");
  vi.stubEnv("VITE_PUBLIC_POSTHOG_HOST", "https://us.i.posthog.com");
  const { initializePostHog, captureEvent } = await import("@/lib/posthog");
  initializePostHog();
  await new Promise((r) => setTimeout(r, 10));
  captureEvent("landing_song_chosen", { slug: "althea" });
  return fake.captured;
}

beforeEach(() => {
  fake.captured = [];
  fake.superProps = {};
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("PostHog events carry the build they came from", () => {
  it("tags the landing $pageview with the build sha", async () => {
    vi.stubGlobal("__BUILD_SHA__", SHA);
    const [pageview] = await landOnSite();
    expect(pageview.event).toBe("$pageview");
    expect(pageview.properties.build_sha).toBe(SHA);
  });

  it("tags events the app captures later in the visit", async () => {
    vi.stubGlobal("__BUILD_SHA__", SHA);
    const events = await landOnSite();
    const chosen = events.find((e) => e.event === "landing_song_chosen");
    expect(chosen?.properties).toEqual({ build_sha: SHA, slug: "althea" });
  });

  it("says 'unknown' when the build was not stamped, rather than dropping the tag", async () => {
    vi.stubGlobal("__BUILD_SHA__", "unknown");
    const [pageview] = await landOnSite();
    expect(pageview.properties.build_sha).toBe("unknown");
  });

  it("says 'unknown' when the build constant is not defined at all", async () => {
    const [pageview] = await landOnSite();
    expect(pageview.properties.build_sha).toBe("unknown");
  });
});
