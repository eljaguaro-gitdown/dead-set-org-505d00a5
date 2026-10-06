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

const { trackFn } = vi.hoisted(() => ({
  trackFn: vi.fn(async (_u: string, _t: string) => null as string | null),
}));

vi.mock("@/lib/archiveOrg", () => ({
  archiveKeyDate: (d?: string | null) => {
    const day = (d || "").slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
  },
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
  findTrackInRecording: trackFn,
  // The context calls the DETAILED variant, which also reports whether we got
  // to ask at all. It delegates to the same vi.fn, so every existing
  // mockResolvedValue/mockImplementation on findTrackInRecording still steers
  // this path. `unreachable: false` = "we asked and got an answer".
  findTrackInRecordingDetailed: vi.fn(async (u: string, t: string) => ({
    url: await trackFn(u, t),
    unreachable: false,
  })),
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

import { findArchiveRecording, findRecordingForDate, findTrackInRecording } from "@/lib/archiveOrg";
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
    // clearAllMocks resets CALLS but not IMPLEMENTATIONS, so a persistent
    // mockRejectedValue in one test would leak into the next and make this
    // file order-dependent. Restore both defaults explicitly.
    vi.clearAllMocks();
    vi.mocked(findRecordingForDate).mockImplementation(async (_title: string, date: string) => ({
      url: `https://archive.org/details/gd${date}.sbd`,
      date,
      venue: "Nassau Coliseum",
      directTrackUrl: `https://archive.org/download/gd${date}.sbd/althea.mp3`,
    }));
    vi.mocked(findArchiveRecording).mockImplementation(async () => ({
      url: "https://archive.org/details/gd1989-03-29.WRONG-NIGHT",
      date: "1989-03-29",
      venue: "Charlotte Coliseum",
      directTrackUrl: "https://archive.org/download/WRONG-NIGHT/althea.mp3",
    }));
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

  /**
   * findRecordingForDate THROWS on a failed request, by design, so that a 503
   * or a timeout is never mistaken for "no tape of this night circulates".
   * Its sibling findArchiveRecording swallows errors and returns null, so the
   * two cannot be called the same way — and the first version of this feature
   * called the throwing one as though it were the swallowing one.
   *
   * The 2026-10-04 gate caught it: an uncaught rejection escaped through
   * playSetlist, playSingle and advancePlaylist. Nothing played, no toast
   * fired, a single tap left playingSlot set and spinning, and Play All stayed
   * stuck on the dead slot instead of advancing. The suite was green because
   * every mock resolved — null or a result, never a rejection.
   */
  describe("when the Archive cannot be asked at all", () => {
    it("toasts and clears instead of spinning forever on a single tap", async () => {
      vi.mocked(findRecordingForDate).mockRejectedValueOnce(new Error("archive.org search 503"));
      const { result } = renderHook(() => useAudioPlayer(), { wrapper });

      await act(async () => {
        await result.current.playSingle(guideSlot(0, "1980-05-16"));
      });

      await waitFor(() => expect(toastError).toHaveBeenCalled());
      expect(result.current.playingSlot).toBeNull();
      // A failed lookup is not a miss, so it must not fall back to a title search.
      expect(findArchiveRecording).not.toHaveBeenCalled();
    });

    it("advances past the failed night instead of stalling the queue", async () => {
      const nights = ["1980-05-16", "1981-03-28", "1990-03-15"];
      const slots = nights.map((d, i) => guideSlot(i, d));
      // The FIRST night cannot be asked for; the rest resolve normally.
      vi.mocked(findRecordingForDate).mockRejectedValueOnce(new Error("archive.org search 503"));

      const { result } = renderHook(() => useAudioPlayer(), { wrapper });
      await act(async () => {
        await result.current.playSetlist(slots, "setlist-althea");
      });

      // Play All skips the unaskable night and starts on the next one.
      await waitFor(() => expect(result.current.playingSlot?.id).toBe("slot-1"));
      expect(result.current.playingSlot?.version?.archive_org_url).toContain("gd1981-03-28");
      expect(result.current.playlistIndex).toBe(1);
    });

    /**
     * Why there is no "slot 1's lookup rejects mid-queue" test here: by the
     * time the queue advances, slot 1 is already bound. Starting the setlist
     * resolves the next night ahead, so resolveSlot returns at its first
     * early-exit and never asks the Archive again — an injected rejection is
     * not consumed and the night plays. The first attempt at this test
     * asserted slot-2 and got slot-1 for exactly that reason.
     *
     * A night can therefore only fail mid-queue if its prefetch ALSO failed,
     * which is the all-reject case asserted below, and it runs through the
     * same resolveSlot catch the head-of-queue test already covers. The
     * invariant worth pinning instead is that advancing does not re-ask for a
     * night already in hand — that is what keeps the failure unreachable.
     */
    it("does not re-ask the Archive for a night the queue already resolved", async () => {
      const slots = ["1980-05-16", "1981-03-28"].map((d, i) => guideSlot(i, d));
      const { result } = renderHook(() => useAudioPlayer(), { wrapper });

      await act(async () => {
        await result.current.playSetlist(slots, "setlist-althea");
      });
      await waitFor(() => expect(result.current.playingSlot?.id).toBe("slot-0"));

      const callsBeforeAdvance = vi.mocked(findRecordingForDate).mock.calls.length;
      await act(async () => {
        await result.current.advancePlaylist(1);
      });

      await waitFor(() => expect(result.current.playingSlot?.id).toBe("slot-1"));
      expect(result.current.playingSlot?.version?.archive_org_url).toContain("gd1981-03-28");
      expect(vi.mocked(findRecordingForDate).mock.calls.length).toBe(callsBeforeAdvance);
    });

    it("does not reject out of playSetlist", async () => {
      vi.mocked(findRecordingForDate).mockRejectedValue(new Error("archive.org search 503"));
      const { result } = renderHook(() => useAudioPlayer(), { wrapper });

      // Every night unaskable: the call must settle, not throw at the caller.
      await act(async () => {
        await expect(
          result.current.playSetlist([guideSlot(0, "1980-05-16"), guideSlot(1, "1981-03-28")], "s"),
        ).resolves.not.toThrow();
      });
      expect(result.current.playingSlot).toBeNull();
    });
  });

  /**
   * The Ripple guide, 2026-10-04. Every row named the right night, and the
   * stored tapes had no Ripple on them, because ai-deadhead preferred
   * Charlie's own `archiveUrl` string over the catalog's verified column — a
   * URL nobody had opened. Play All skipped every row; on the legacy engine a
   * trackless slot streams the whole recording from the top and plays a
   * DIFFERENT SONG under this one's name.
   *
   * So: a slot with a stored tape that does not contain the song is not a
   * dead end while we still know the night, and it is never playable without
   * a track.
   */
  describe("a stored tape that does not contain the song", () => {
    const storedButWrong = (date: string): PlayableSlot => ({
      ...guideSlot(0, date),
      version: {
        ...guideSlot(0, date).version!,
        archive_org_url: "https://archive.org/details/a-tape-charlie-invented",
      },
    });

    it("re-resolves the night instead of giving up on an unverified url", async () => {
      vi.mocked(findTrackInRecording).mockResolvedValueOnce(null);
      const { result } = renderHook(() => useAudioPlayer(), { wrapper });

      await act(async () => {
        await result.current.playSingle(storedButWrong("1970-08-18"));
      });

      await waitFor(() =>
        expect(result.current.playingSlot?.directTrackUrl).toContain("gd1970-08-18"),
      );
      expect(findRecordingForDate).toHaveBeenCalledWith("Althea", "1970-08-18");
      // And it swapped to the recording it actually read.
      expect(result.current.playingSlot?.version?.archive_org_url).not.toContain("invented");
    });

    it("never hands back a slot with no track, even when the night has one on paper", async () => {
      vi.mocked(findTrackInRecording).mockResolvedValueOnce(null);
      // findRecordingForDate's own "still the night" fallback: a recording,
      // but no readable track of this song inside it.
      vi.mocked(findRecordingForDate).mockResolvedValueOnce({
        url: "https://archive.org/details/night-without-the-song",
        date: "1970-08-18",
        venue: "Fillmore West",
        directTrackUrl: null,
      });
      const { result } = renderHook(() => useAudioPlayer(), { wrapper });

      await act(async () => {
        await result.current.playSingle(storedButWrong("1970-08-18"));
      });

      // Reported, not played. Playing it would stream someone else's song
      // under this one's name — the same contract the recovery suite asserts.
      await waitFor(() =>
        expect(result.current.transport.error).toBe("That song isn't on this tape."),
      );
      expect(result.current.playingSlot?.directTrackUrl).toBeFalsy();
    });
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
