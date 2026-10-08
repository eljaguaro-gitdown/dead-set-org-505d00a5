/**
 * The admin dashboard's traffic tiles, rendered.
 *
 * No test rendered Admin.tsx, so gate 8 (2026-10-08) could make it show 0 for
 * an unanswered query, show the 24h number in the 7d tile, or claim PostHog in
 * the caption when PostHog had not answered, and the suite stayed green: 8 of
 * 9 mutants survived. These assert what the tiles and caption actually say.
 * The widgets around the panel are stubbed; each has its own data and is not
 * what is under test.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  invoke: { data: null as unknown, error: null as unknown },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "admin-1", email: "admin@example.com" }, loading: false }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => {
  // Every query-builder call returns the chain. Awaiting it gives the admin
  // role for user_roles and no rows for anything else.
  const chainFor = (table: string): unknown =>
    new Proxy(
      {},
      {
        get(_, prop) {
          if (prop === "then") {
            const data = table === "user_roles" ? { role: "admin" } : [];
            return (res: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).then(res);
          }
          return () => chainFor(table);
        },
      },
    );
  return {
    supabase: {
      from: (table: string) => chainFor(table),
      rpc: async () => ({ data: null, error: null }),
      functions: { invoke: async () => mocks.invoke },
    },
  };
});
for (const widget of [
  "LiveVisitorsWidget",
  "ModerationQueueWidget",
  "PresenceDebugPanel",
  "FunnelWidget",
  "AuthFunnelWidget",
  "ListeningAnalyticsWidget",
  "UserSegmentsWidget",
  "AdminAnnouncementsPanel",
  "DeliverabilityMonitor",
  "SuppressedAddressesPanel",
  "PrivateRelayMonitor",
  "DispatchSenderPanel",
  "GitHubSyncBadge",
]) {
  vi.doMock(`@/components/${widget}`, () => ({ default: () => null }));
}

const { default: Admin } = await import("@/pages/Admin");

const renderAdmin = () =>
  render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Admin />
    </MemoryRouter>,
  );

/** The figure printed under a tile's label. */
const tile = (label: string) => screen.getByText(label).nextElementSibling?.textContent;

const TILES = {
  top24h: "Visitors (24h)",
  top7d: "Visitors (7d)",
  unique24h: "Unique (24h)",
  unique7d: "Unique (7d)",
  unique30d: "Unique (30d)",
  views24h: "Page Views (24h)",
  views30d: "Page Views (30d)",
};
const FROM_POSTHOG = "From PostHog: dead-set.org only, internal accounts and bots excluded.";
const UNAVAILABLE = "Traffic unavailable: PostHog didn't answer.";

beforeEach(() => {
  mocks.invoke = { data: null, error: null };
});

describe("admin traffic tiles", () => {
  it("print each PostHog figure in its own tile, under the PostHog caption", async () => {
    // Five different numbers, so a tile showing its neighbour's figure fails.
    mocks.invoke = {
      data: { users: [], traffic: { source: "posthog", unique24h: 1, unique7d: 20, unique30d: 45, pageViews24h: 3, pageViews30d: 211 } },
      error: null,
    };
    renderAdmin();
    await waitFor(() => expect(tile(TILES.unique30d)).toBe("45"));
    expect(tile(TILES.top24h)).toBe("1");
    expect(tile(TILES.top7d)).toBe("20");
    expect(tile(TILES.unique24h)).toBe("1");
    expect(tile(TILES.unique7d)).toBe("20");
    expect(tile(TILES.views24h)).toBe("3");
    expect(tile(TILES.views30d)).toBe("211");
    expect(screen.getByText(FROM_POSTHOG)).toBeInTheDocument();
    expect(screen.queryByText(UNAVAILABLE)).not.toBeInTheDocument();
  });

  it("show a dash, never 0, and say so, when PostHog did not answer", async () => {
    mocks.invoke = { data: { users: [], traffic: null }, error: null };
    renderAdmin();
    expect(await screen.findByText(UNAVAILABLE)).toBeInTheDocument();
    for (const label of Object.values(TILES)) expect(tile(label), label).toBe("—");
    expect(screen.queryByText(FROM_POSTHOG)).not.toBeInTheDocument();
  });

  it("refuse the old page_visits payload, which used the same field names", async () => {
    mocks.invoke = {
      data: { users: [], traffic: { totalPageViews: 9000, totalUnique: 800, unique24h: 24, unique7d: 263, unique30d: 400 } },
      error: null,
    };
    renderAdmin();
    expect(await screen.findByText(UNAVAILABLE)).toBeInTheDocument();
    for (const label of Object.values(TILES)) expect(tile(label), label).toBe("—");
  });

  it("print 0 when PostHog answered 0", async () => {
    mocks.invoke = {
      data: { users: [], traffic: { source: "posthog", unique24h: 0, unique7d: 0, unique30d: 0, pageViews24h: 0, pageViews30d: 0 } },
      error: null,
    };
    renderAdmin();
    await waitFor(() => expect(tile(TILES.unique30d)).toBe("0"));
    for (const label of Object.values(TILES)) expect(tile(label), label).toBe("0");
    expect(screen.getByText(FROM_POSTHOG)).toBeInTheDocument();
  });
});
