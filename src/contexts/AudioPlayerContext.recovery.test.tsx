import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";

/**
 * Recovery behaviour on the GAPLESS path specifically.
 *
 * This lives apart from AudioPlayerContext.test.tsx because that file runs in
 * jsdom without an AudioContext, so resolvePlayerEngine() downgrades it to
 * "legacy" — and legacy is not the path that ships on iOS. Here the engine is
 * forced to gapless, which is the configuration real devices get.
 *
 * What it pins down: resolveSlot returns a slot UNCHANGED when it cannot find
 * the song inside a recording. Legacy survived that because AudioPlayer.tsx
 * fell back to the whole recording, but AudioPlayer never mounts under the
 * gapless engine, so isLoading (defined as !directTrackUrl) stayed true and
 * the player bar span forever with no error and no exit but the X.
 */

const waitFor = async (fn: () => void | Promise<void>, timeoutMs = 2000) => {
  const start = Date.now();
  let lastErr: unknown;
  while (Date.now() - start < timeoutMs) {
    try { await fn(); return; } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 20));
    }
  }
  throw lastErr;
};

// Give jsdom an AudioContext so isGaplessSupported() is true and the provider
// resolves the engine to "gapless" rather than downgrading to legacy.
class FakeAudioContext {
  state = "running";
  resume = vi.fn(async () => undefined);
  close = vi.fn(async () => undefined);
}
vi.stubGlobal("AudioContext", FakeAudioContext);

vi.mock("gapless", () => {
  class FakeQueue {
    addTrack = vi.fn();
    gotoTrack = vi.fn();
    play = vi.fn();
    pause = vi.fn();
    next = vi.fn();
    previous = vi.fn();
    seek = vi.fn();
    setVolume = vi.fn();
    destroy = vi.fn();
    resumeAudioContext = vi.fn(async () => undefined);
    currentTrackIndex = 0;
    isPlaying = false;
  }
  return { default: FakeQueue, Queue: FakeQueue };
});

// vi.mock is hoisted above const declarations, so the default implementation
// has to be hoisted with it.
const { DEFAULT_TRACK } = vi.hoisted(() => ({
  DEFAULT_TRACK: async (archiveUrl: string, songTitle: string) =>
    `https://archive.org/download/${encodeURIComponent(archiveUrl)}/${encodeURIComponent(songTitle)}.mp3`,
}));

vi.mock("@/lib/archiveOrg", () => ({
  findArchiveRecording: vi.fn(async () => null),
  findTrackInRecording: vi.fn(DEFAULT_TRACK),
}));

vi.mock("@/lib/playEventTracker", () => ({
  startPlayEvent: vi.fn(async () => undefined),
  finalizePlayEvent: vi.fn(async () => undefined),
  pausePlayEvent: vi.fn(),
  resumePlayEvent: vi.fn(),
  setPlayEventTrackDuration: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const mockPlayabilityRow = vi.fn(async () => ({ data: null, error: null }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
    auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
    from: vi.fn(() => ({
      insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(async () => ({ data: null })) })) })),
      update: vi.fn(() => ({ eq: vi.fn(async () => ({ data: null })) })),
      select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: mockPlayabilityRow })) })),
    })),
  },
}));

import { findTrackInRecording } from "@/lib/archiveOrg";
import { AudioPlayerProvider, useAudioPlayer, type PlayableSlot } from "./AudioPlayerContext";
import { SYNTHETIC_VERSION_DEFAULTS } from "@/lib/syntheticVersion";

const makeSlot = (i: number): PlayableSlot => ({
  id: `slot-${i}`,
  song: { id: `song-${i}`, title: `Song ${i}` },
  setNumber: 1,
  position: i,
  segueToNext: false,
  version: {
    ...SYNTHETIC_VERSION_DEFAULTS,
    id: `v-${i}`, song_id: `song-${i}`, show_date: "1977-05-08",
    archive_org_url: `https://archive.org/details/gd1977-05-08-${i}`,
    venue: "Barton Hall", city: "Ithaca, NY",
    era_id: null, rating: null, description: null,
  },
  directTrackUrl: null,
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <AudioPlayerProvider>{children}</AudioPlayerProvider>
);

describe("AudioPlayerContext — gapless recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlayabilityRow.mockResolvedValue({ data: null, error: null });
    vi.mocked(findTrackInRecording).mockImplementation(DEFAULT_TRACK);
  });

  it("runs on the gapless engine, not the legacy fallback", async () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });
    expect(result.current.transport.engine).toBe("gapless");
  });

  it("surfaces an error instead of spinning when the song isn't in the recording", async () => {
    vi.mocked(findTrackInRecording).mockResolvedValue(null);

    const { result } = renderHook(() => useAudioPlayer(), { wrapper });
    await act(async () => { await result.current.playSingle(makeSlot(0)); });

    await waitFor(() => {
      expect(result.current.transport.error).toBe("That song isn't on this tape.");
    });
    expect(result.current.playingSlot?.directTrackUrl).toBeFalsy();
  });

  it("clears the error and re-resolves on retry", async () => {
    vi.mocked(findTrackInRecording).mockResolvedValue(null);

    const { result } = renderHook(() => useAudioPlayer(), { wrapper });
    await act(async () => { await result.current.playSingle(makeSlot(0)); });
    await waitFor(() => expect(result.current.transport.error).toBeTruthy());

    // archive.org was flaky, not wrong — the tape comes back.
    vi.mocked(findTrackInRecording).mockImplementation(DEFAULT_TRACK);
    await act(async () => { result.current.transport.retry(); });

    await waitFor(() => {
      expect(result.current.transport.error).toBeNull();
      expect(result.current.playingSlot?.directTrackUrl).toContain("Song%200.mp3");
    });
  });

  it("reports no error when resolution succeeds", async () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });
    await act(async () => { await result.current.playSingle(makeSlot(0)); });

    await waitFor(() => {
      expect(result.current.playingSlot?.directTrackUrl).toContain("Song%200.mp3");
    });
    expect(result.current.transport.error).toBeNull();
  });
});
