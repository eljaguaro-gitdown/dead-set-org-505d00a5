/**
 * The beta-nudge page lets in whoever holds the admin role, whatever address
 * they sign in with.
 *
 * It also required the login email to be grateful_jaguaro@dead-set.org, and the
 * only admin account signs in as a different address, so the page sent its
 * one admin home on every visit (found 2026-10-08). The role check stays, and
 * send-beta-nudge enforces the same role on the server.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  user: null as { id: string; email: string } | null,
  isAdmin: false,
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: mocks.user, loading: false }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => {
  // Every query-builder call returns the chain; awaiting it gives no rows.
  const chain: unknown = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === "then") {
          return (res: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(res);
        }
        return () => chain;
      },
    },
  );
  return {
    supabase: {
      rpc: async () => ({ data: mocks.isAdmin, error: null }),
      from: () => chain,
      functions: { invoke: async () => ({ data: { users: [] }, error: null }) },
    },
  };
});

import AdminBetaNudge from "@/pages/AdminBetaNudge";

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/admin/email/beta-nudge"]}>
      <Routes>
        <Route path="/admin/email/beta-nudge" element={<AdminBetaNudge />} />
        <Route path="/" element={<p>HOME</p>} />
        <Route path="/auth" element={<p>SIGN IN</p>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  mocks.user = null;
  mocks.isAdmin = false;
});

describe("beta-nudge page gate", () => {
  it("opens for an admin who signs in with a personal address", async () => {
    mocks.user = { id: "admin-1", email: "someone@gmail.com" };
    mocks.isAdmin = true;
    renderPage();
    expect(await screen.findByRole("heading", { name: "Beta Nudge" })).toBeInTheDocument();
    expect(screen.queryByText("HOME")).not.toBeInTheDocument();
  });

  it("sends a signed-in fan without the admin role home", async () => {
    mocks.user = { id: "fan-1", email: "grateful_jaguaro@dead-set.org" };
    mocks.isAdmin = false;
    renderPage();
    expect(await screen.findByText("HOME")).toBeInTheDocument();
  });

  it("sends a signed-out visitor to sign in", async () => {
    renderPage();
    expect(await screen.findByText("SIGN IN")).toBeInTheDocument();
  });
});
