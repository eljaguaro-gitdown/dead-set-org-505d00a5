import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReleaseActivity } from "@/lib/webReleases";

let answer: ReleaseActivity | null = null;
const fetchReleaseActivity = vi.fn(async () => answer);
vi.mock("@/lib/webReleases", () => ({ fetchReleaseActivity: () => fetchReleaseActivity() }));

import LastUpdatedBadge from "@/components/LastUpdatedBadge";

const renderBadge = () =>
  render(
    <MemoryRouter>
      <LastUpdatedBadge />
    </MemoryRouter>,
  );

describe("LastUpdatedBadge", () => {
  beforeEach(() => fetchReleaseActivity.mockClear());

  it("counts this week's releases", async () => {
    answer = { thisWeek: 3, lastReleasedAt: "2026-09-23T23:22:36Z" };
    renderBadge();
    await screen.findByText("Updated 3 times this week");
  });

  it("says 'time' for a single release", async () => {
    answer = { thisWeek: 1, lastReleasedAt: "2026-09-23T23:22:36Z" };
    renderBadge();
    await screen.findByText("Updated 1 time this week");
  });

  // A quiet week must not hide the badge or pretend to be busy.
  it("falls back to the last release date when this week had none", async () => {
    answer = { thisWeek: 0, lastReleasedAt: "2026-09-10T12:00:00Z" };
    renderBadge();
    await screen.findByText("Last updated Sep 10");
  });

  it("renders nothing when no release has ever been recorded, or the read fails", async () => {
    for (const a of [{ thisWeek: 0, lastReleasedAt: null }, null]) {
      answer = a;
      const { container, unmount } = renderBadge();
      await waitFor(() => expect(fetchReleaseActivity).toHaveBeenCalled());
      expect(container).toBeEmptyDOMElement();
      unmount();
      fetchReleaseActivity.mockClear();
    }
  });
});
