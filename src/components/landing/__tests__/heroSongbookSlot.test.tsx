/**
 * What sits under the song picker on the home page.
 *
 * This week's Songbook song when the shelf answers, the daily community
 * spotlight when it does not, and a card-sized placeholder in between. No
 * test imported HeroSection before this one, so none of that was guarded.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { SongbookSpotlight } from "@/lib/songbookSpotlight";

const mocks = vi.hoisted(() => ({
  weekly: null as null | (() => Promise<unknown>),
  rpc: vi.fn(async (_name: string) => ({ data: [] })),
}));

vi.mock("@/lib/songbookSpotlight", () => ({
  loadWeeklySpotlight: () => mocks.weekly!(),
}));
vi.mock("@/components/landing/SongbookSpotlightCard", () => ({
  default: ({ spotlight }: { spotlight: SongbookSpotlight }) => <p>card: {spotlight.title}</p>,
  SongbookSpotlightSkeleton: () => <p>card placeholder</p>,
}));
vi.mock("@/components/landing/StartWithASong", () => ({ default: () => null }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/lib/trackCtaClick", () => ({ trackCtaClick: vi.fn() }));
vi.mock("@/contexts/AudioPlayerContext", () => ({
  useAudioPlayer: () => ({
    playSetlist: vi.fn(),
    playingSlot: null,
    stopPlayback: vi.fn(),
    activeSetlistId: null,
  }),
}));
vi.mock("@/integrations/supabase/client", () => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    then: (resolve: (v: { count: number }) => void) => resolve({ count: 255 }),
  };
  return { supabase: { from: () => chain, rpc: (name: string) => mocks.rpc(name) } };
});

import HeroSection from "@/components/landing/HeroSection";

const SPOT = { title: "Crazy Fingers", slug: "crazy-fingers" } as SongbookSpotlight;

const renderHero = () =>
  render(
    <MemoryRouter>
      <HeroSection />
    </MemoryRouter>,
  );

beforeEach(() => {
  mocks.rpc.mockClear();
});

describe("HeroSection — the Songbook slot", () => {
  it("holds the card's place while the shelf loads", () => {
    mocks.weekly = () => new Promise(() => {});
    renderHero();
    expect(screen.getByText("card placeholder")).toBeInTheDocument();
    expect(screen.queryByText(/Today's Spotlight/)).toBeNull();
  });

  it("shows this week's song, and does not fetch the community spotlight it would hide", async () => {
    mocks.weekly = async () => SPOT;
    renderHero();
    expect(await screen.findByText("card: Crazy Fingers")).toBeInTheDocument();
    expect(screen.queryByText("card placeholder")).toBeNull();
    expect(mocks.rpc).not.toHaveBeenCalledWith("get_hero_spotlight");
  });

  it("falls back to the daily community spotlight when the shelf has nothing", async () => {
    mocks.weekly = async () => null;
    renderHero();
    expect(await screen.findByRole("group", { name: /Today's Spotlight/ })).toBeInTheDocument();
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith("get_hero_spotlight"));
    expect(screen.queryByText(/^card/)).toBeNull();
  });
});
