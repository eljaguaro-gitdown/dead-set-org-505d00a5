import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

/**
 * The "Couldn't reach the Archive" message sits in a box filled with the dark
 * page colour (bg-background), above the cream bar. It was set in
 * text-card-foreground, the dark ink meant for the cream card: 1.06:1, which
 * on a phone in airplane mode read as an empty red outline. Light ink on the
 * dark fill is the pairing that reads (text-foreground, 11.55:1).
 *
 * Rendered rather than grepped, so the assertion is about the element that
 * carries the sentence, not about a string somewhere in the file.
 */
const ERROR = "Couldn't reach the Archive just now. Tap play to try again.";

vi.mock("@/contexts/AudioPlayerContext", () => ({
  useAudioPlayer: () => ({
    playingSlot: {
      id: "s1",
      song: { title: "Crazy Fingers" },
      version: { show_date: "1975-06-17", venue: "Winterland Arena" },
    },
    playlistMode: false,
    playlistIndex: 0,
    playlistSlots: [],
    activeSetlistId: null,
    stopPlayback: vi.fn(),
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

describe("the player's error message is readable", () => {
  it("sets the message in light ink on the dark box", () => {
    render(
      <MemoryRouter>
        <GaplessPlayerBar />
      </MemoryRouter>,
    );
    const alert = screen.getByRole("alert");
    expect(alert.className).toMatch(/\bbg-background\b/);
    const text = screen.getByText(ERROR);
    expect(alert.contains(text)).toBe(true);
    const classes = text.className.split(/\s+/);
    expect(classes).toContain("text-foreground");
    expect(classes.some((c) => c.startsWith("text-card-foreground"))).toBe(false);
  });
});
