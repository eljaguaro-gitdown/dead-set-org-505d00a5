/**
 * A community Songbook issue carries report and block (App Store guideline 1.2).
 *
 * The page publishes what a fan wrote: their display name and a note on each
 * night. The Songbook shelf used to open the guide at /setlist/:id, which has
 * both controls. When it started opening /songbook/:slug instead, the controls
 * stayed behind, and gate 6 (2026-10-07) blocked the release on it. Build 27
 * was rejected under 1.2 for exactly this class of gap.
 *
 * The real SafetyMenu renders here; only the network calls under it are mocked,
 * so the test sees the button and dialog copy a reviewer would.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { CommunityIssue } from "@/lib/communityIssue";

const mocks = vi.hoisted(() => ({
  user: null as { id: string } | null,
  block: vi.fn(async (_id: string) => true),
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("@/hooks/useModeration", () => ({
  useBlockedUsers: () => ({ block: mocks.block }),
  submitReport: vi.fn(async () => true),
}));
vi.mock("@/contexts/AudioPlayerContext", () => ({
  useAudioPlayer: () => ({ playSetlist: vi.fn(), playSingle: vi.fn(), playingSlot: null }),
}));
vi.mock("@/components/ShareDropdown", () => ({ default: () => null }));
vi.mock("sonner", () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }));

import CommunityIssueArticle from "@/components/CommunityIssueArticle";

const ISSUE: CommunityIssue = {
  songId: "song-1",
  title: "Eyes of the World",
  slug: "eyes-of-the-world",
  firstPlayed: "1973-02-09",
  lastPlayed: "1995-07-06",
  firstPlayedVenue: null,
  lastPlayedVenue: null,
  timesPlayed: 382,
  mappedBy: "ric neil",
  creatorId: "user-ric",
  setlistId: "set-1",
  nights: [
    { position: 1, showDate: "1974-06-18", venue: "Freedom Hall", archiveUrl: null, note: "A night." },
  ],
};

const renderIssue = () =>
  render(
    <MemoryRouter initialEntries={["/songbook/eyes-of-the-world"]}>
      <Routes>
        <Route path="/songbook/:slug" element={<CommunityIssueArticle issue={ISSUE} />} />
        <Route path="/songbook" element={<p>The shelf</p>} />
      </Routes>
    </MemoryRouter>,
  );

beforeEach(() => {
  mocks.user = null;
  mocks.block.mockClear();
});

describe("community Songbook issue: report and block", () => {
  it("offers report or block to a signed-out visitor, where a reviewer starts", () => {
    renderIssue();
    expect(screen.getByRole("button", { name: "Report or block" })).toBeInTheDocument();
  });

  it("offers it to a signed-in fan who did not write the guide", () => {
    mocks.user = { id: "someone-else" };
    renderIssue();
    expect(screen.getByRole("button", { name: "Report or block" })).toBeInTheDocument();
  });

  it("does not offer it to the guide's own author", () => {
    mocks.user = { id: "user-ric" };
    renderIssue();
    expect(screen.queryByRole("button", { name: "Report or block" })).not.toBeInTheDocument();
  });

  it("names the guide and its author, the way Apple names the controls", () => {
    renderIssue();
    fireEvent.click(screen.getByRole("button", { name: "Report or block" }));
    expect(screen.getByRole("button", { name: /Report this guide/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Block ric neil/ })).toBeInTheDocument();
  });

  it("blocks the author, not the viewer, and leaves for the shelf", async () => {
    mocks.user = { id: "someone-else" };
    renderIssue();
    fireEvent.click(screen.getByRole("button", { name: "Report or block" }));
    fireEvent.click(screen.getByRole("button", { name: /Block ric neil/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Block" }));

    await waitFor(() => expect(mocks.block).toHaveBeenCalledWith("user-ric"));
    // Blocking hides the guide from the blocker, so the page would stop
    // resolving under them.
    expect(await screen.findByText("The shelf")).toBeInTheDocument();
  });

  it("is a 44px target", () => {
    renderIssue();
    const button = screen.getByRole("button", { name: "Report or block" });
    expect(button.className).toMatch(/min-h-\[44px\]/);
    expect(button.className).toMatch(/min-w-\[44px\]/);
  });
});
