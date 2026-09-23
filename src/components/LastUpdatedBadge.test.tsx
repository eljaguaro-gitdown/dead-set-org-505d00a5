import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Records the filters the badge applies, and answers with a fixed count.
const calls: { method: string; args: unknown[] }[] = [];
let answer = 0;

vi.mock("@/integrations/supabase/client", () => {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "gte", "order", "limit"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  builder.then = (resolve: (v: { count: number }) => void) => resolve({ count: answer });
  return { supabase: { from: () => builder } };
});

import LastUpdatedBadge from "@/components/LastUpdatedBadge";

const renderBadge = () =>
  render(
    <MemoryRouter>
      <LastUpdatedBadge />
    </MemoryRouter>,
  );

describe("LastUpdatedBadge", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("counts only notes published in the last seven days", async () => {
    answer = 3;
    renderBadge();
    await screen.findByText("Updated 3 times this week");

    const gte = calls.find((c) => c.method === "gte");
    expect(gte?.args[0]).toBe("created_at");
    const since = Date.parse(gte?.args[1] as string);
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    expect(Math.abs(Date.now() - sevenDays - since)).toBeLessThan(60_000);
    expect(calls).toContainEqual({ method: "eq", args: ["published", true] });
  });

  // The bug: an April week kept the footer saying "this week" in September.
  it("renders nothing when no notes were published this week", async () => {
    answer = 0;
    const { container } = renderBadge();
    await waitFor(() => expect(calls.some((c) => c.method === "gte")).toBe(true));
    expect(container).toBeEmptyDOMElement();
  });

  it("says 'time' for a single note", async () => {
    answer = 1;
    renderBadge();
    await screen.findByText("Updated 1 time this week");
  });
});
