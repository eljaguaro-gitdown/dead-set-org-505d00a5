import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

/**
 * One tap, one message. When the oops card above the bar is apologising for
 * THIS slot, the bar's own "That song isn't on this tape. [Try again]" steps
 * aside: the card says more, and its retry would fail the same way. For any
 * other slot — or no card — the bar's message stays exactly as it was.
 */

const ERROR = "That song isn't on this tape.";
const m = vi.hoisted(() => ({ oopsSlotId: null as string | null }));

vi.mock("@/contexts/AudioPlayerContext", () => ({
  useAudioPlayer: () => ({
    playingSlot: { id: "s1", song: { title: "Althea" }, version: { show_date: "1979-08-04", venue: "Oakland Auditorium" } },
    playlistMode: false,
    playlistIndex: 0,
    playlistSlots: [],
    activeSetlistId: null,
    stopPlayback: vi.fn(),
    playbackOops: m.oopsSlotId ? { key: 1, kind: "not_on_tape", slotId: m.oopsSlotId, songTitle: "Althea" } : null,
    transport: {
      error: ERROR,
      autoplayBlocked: false,
      isLoading: false,
      isPlaying: false,
      getProgress: () => ({ currentTime: 0, duration: 0 }),
      subscribeProgress: () => () => {},
      next: vi.fn(),
      previous: vi.fn(),
      play: vi.fn(),
      retry: vi.fn(),
      seek: vi.fn(),
      setVolume: vi.fn(),
      togglePlayPause: vi.fn(),
    },
  }),
}));

import GaplessPlayerBar from "@/components/GaplessPlayerBar";

const renderBar = () =>
  render(
    <MemoryRouter>
      <GaplessPlayerBar />
    </MemoryRouter>,
  );

beforeEach(() => {
  m.oopsSlotId = null;
});

describe("the bar yields to the oops card for the same slot only", () => {
  it("no card: the bar's message shows", () => {
    renderBar();
    expect(screen.getByText(ERROR)).toBeInTheDocument();
  });

  it("a card for this slot: the bar's message steps aside", () => {
    m.oopsSlotId = "s1";
    renderBar();
    expect(screen.queryByText(ERROR)).toBeNull();
  });

  it("a card for some other slot: the bar's message stays", () => {
    m.oopsSlotId = "other";
    renderBar();
    expect(screen.getByText(ERROR)).toBeInTheDocument();
  });
});
