import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";

/**
 * A listening-guide slot names its night and carries no tape: the Version
 * Explorer's archiveUrl is optional, so for any song with no catalog versions
 * every pick arrives that way.
 *
 * Until 2026-10-04 resolveSlot had no branch for that shape. It fell through to
 * a generic by-title search, which answers with the song's best-drawing tape
 * from any year — so six cards describing six nights all played one, and where
 * the night was lost entirely the guide simply reported no audio. The Althea
 * guide saved that day came back empty on every row while all four of its
 * nights sat on the Archive.
 */

const waitFor = async (fn: () => void | Promise<void>, timeoutMs = 1500) => {
  const start = Date.now();
  let lastErr: unknown;
  while (Date.now() - start < timeoutMs) {
    try {
      await fn();
      return;
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 20));
    }
  }
  throw lastErr;
};

vi.mock("@/lib/archiveOrg", () => ({
  findArchiveRecording: vi.fn(async () => ({
    url: "https://archive.org/details/gd1989-03-29.WRONG-NIGHT",
    date: "1989-03-29",
    venue: "Charlotte Coliseum",
    directTrackUrl: "https://archive.org/download/WRONG-NIGHT/althea.mp3",
  })),
  findRecordingForDate: vi.fn(async (_title: string, date: string) => ({
    url: `https://archive.org/details/gd${date}.sbd`,
    date,
    venue: "Nassau Coliseum",
    directTrackUrl: `https://archive.org/download/gd${date}.sbd/althea.mp3`,
  })),
  findTrackInRecording: vi.fn(async () => null),
}));

vi.mock("@/lib/playEventTracker", () => ({
  startPlayEvent: vi.fn(async () => undefined),
  finalizePlayEvent: vi.fn(async () => undefined),
  pausePlayEvent: vi.fn(),
  resumePlayEvent: vi.fn(),
  setPlayEventTrackDuration: vi.fn(),
}));

// Hoisted: vi.mock factories run before module-level consts are initialized.
const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: toastError, info: vi.fn() },
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

import { findArchiveRecording, findRecordingForDate } from "@/lib/archiveOrg";
import { AudioPlayerProvider, useAudioPlayer, type PlayableSlot } from "./AudioPlayerContext";
import { SYNTHETIC_VERSION_DEFAULTS } from "@/lib/syntheticVersion";

/** A guide slot: this night, named, with no tape bound to it. */
const guideSlot = (i: number, showDate: string): PlayableSlot => ({
  id: `slot-${i}`,
  song: { id: "song-althea", title: "Althea" },
  setNumber: 1,
  position: i,
  segueToNext: false,
  version: {
    ...SYNTHETIC_VERSION_DEFAULTS,
    id: `archive-reconstructed-slot-${i}`,
    song_id: "song-althea",
    show_date: showDate,
    archive_org_url: null,
    venue: "Nassau Coliseum",
    city: null,
    era_id: null,
    rating: null,
    description: null,
  },
  directTrackUrl: null,
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <AudioPlayerProvider>{children}</AudioPlayerProvider>
);

describe("resolveSlot — a slot that names its night", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlayabilityRow.mockResolvedValue({ data: null, error: null });
  });

  it("resolves that night, not the song's best-drawing tape", async () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });

    await act(async () => {
      await result.current.playSingle(guideSlot(0, "1980-05-16"));
    });

    await waitFor(() => {
      expect(result.current.playingSlot?.version?.archive_org_url).toBe(
        "https://archive.org/details/gd1980-05-16.sbd",
      );
    });

    expect(findRecordingForDate).toHaveBeenCalledWith("Althea", "1980-05-16");
    // The generic search would have answered with a 1989 Charlotte tape.
    expect(findArchiveRecording).not.toHaveBeenCalled();
    expect(result.current.playingSlot?.directTrackUrl).toContain("gd1980-05-16.sbd");
    // The night the card describes survives resolution.
    expect(result.current.playingSlot?.version?.show_date).toBe("1980-05-16");
  });

  it("gives each night of one song its own tape across a whole guide", async () => {
    const nights = ["1980-05-16", "1981-03-28", "1990-03-15", "1991-09-10"];
    const slots = nights.map((d, i) => guideSlot(i, d));
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });

    await act(async () => {
      await result.current.playSetlist(slots, "setlist-althea");
    });

    await waitFor(() => expect(result.current.playingSlot?.id).toBe("slot-0"));
    expect(result.current.playingSlot?.version?.archive_org_url).toContain("gd1980-05-16");

    for (let i = 1; i < nights.length; i++) {
      await act(async () => {
        await result.current.advancePlaylist(1);
      });
      await waitFor(() => expect(result.current.playingSlot?.id).toBe(`slot-${i}`));
      expect(result.current.playingSlot?.version?.archive_org_url).toContain(`gd${nights[i]}`);
    }

    expect(findArchiveRecording).not.toHaveBeenCalled();
  });

  it("reports empty rather than swapping in a different night", async () => {
    vi.mocked(findRecordingForDate).mockResolvedValueOnce(null);
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });

    await act(async () => {
      await result.current.playSingle(guideSlot(0, "1980-05-16"));
    });

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(result.current.playingSlot).toBeNull();
    // Falling back here is what put the prose and the music on different shows.
    expect(findArchiveRecording).not.toHaveBeenCalled();
  });

  it("still searches by title when the slot names no night at all", async () => {
    const slot = guideSlot(0, "");
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });

    await act(async () => {
      await result.current.playSingle(slot);
    });

    await waitFor(() => expect(findArchiveRecording).toHaveBeenCalledWith("Althea"));
    expect(findRecordingForDate).not.toHaveBeenCalled();
  });
});
