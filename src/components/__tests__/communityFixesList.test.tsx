import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { CommunityFix } from "@/lib/playbackIssues";

const m = vi.hoisted(() => ({ fixes: [] as CommunityFix[] }));
vi.mock("@/lib/playbackIssues", async () => ({
  ...(await vi.importActual<typeof import("@/lib/playbackIssues")>("@/lib/playbackIssues")),
  fetchCommunityFixes: vi.fn(async () => m.fixes),
}));

import CommunityFixesList from "@/components/CommunityFixesList";

beforeEach(() => {
  m.fixes = [];
});

describe("Build Notes credits the fans who flagged a fix", () => {
  it("says nothing until there is someone to thank", async () => {
    const { container } = render(<CommunityFixesList />);
    await new Promise((r) => setTimeout(r, 0));
    expect(container).toBeEmptyDOMElement();
  });

  it("names the night and the fans who said yes", async () => {
    m.fixes = [{ issueId: "a", songTitle: "Althea", showDate: "1979-08-04", verifiedAt: "x", credited: ["jaguaro_fan", "deadhead_72"] }];
    render(<CommunityFixesList />);
    const item = await screen.findByRole("listitem");
    expect(item.textContent).toBe("Althea · 8/4/79 plays again. Flagged by jaguaro_fan, deadhead_72.");
    expect(screen.getByRole("heading", { name: "Fixed with the community" })).toBeInTheDocument();
  });
});
