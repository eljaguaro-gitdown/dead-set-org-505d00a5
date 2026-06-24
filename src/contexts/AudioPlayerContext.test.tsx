import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

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
import type { ReactNode } from "react";

// Mock archive.org resolution — the context calls findTrackInRecording when a
// slot has an archive_org_url but no directTrackUrl. Return a stable URL so
// resolveSlot succeeds for every slot in the playlist.
vi.mock("@/lib/archiveOrg", () => ({
  findArchiveRecording: vi.fn(async () => null),
  findTrackInRecording: vi.fn(async (archiveUrl: string, songTitle: string) => {
    return `https://archive.org/download/${encodeURIComponent(archiveUrl)}/${encodeURIComponent(songTitle)}.mp3`;
  }),
}));

// Play-event analytics writes to Supabase — stub it out so tests don't hit the network.
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

// Supabase RPC for play-count increment is fired-and-forgotten. The
// `from("setlist_slot_playability").select().eq().maybeSingle()` chain backs
// the precomputed-playability lookup; default to a miss (data: null) so the
// live archive.org path is exercised unless a test overrides it.
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
import {
  AudioPlayerProvider,
  useAudioPlayer,
  type PlayableSlot,
} from "./AudioPlayerContext";

const makeSlot = (i: number): PlayableSlot => ({
  id: `slot-${i}`,
  song: { id: `song-${i}`, title: `Song ${i}` },
  setNumber: 1,
  position: i,
  segueToNext: false,
  version: {
    id: `v-${i}`,
    song_id: `song-${i}`,
    show_date: "1977-05-08",
    archive_org_url: `https://archive.org/details/gd1977-05-08-${i}`,
    venue: "Barton Hall",
    city: "Ithaca, NY",
    era_id: null,
    rating: null,
    description: null,
  },
  directTrackUrl: null,
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <AudioPlayerProvider>{children}</AudioPlayerProvider>
);

describe("AudioPlayerContext — setlist auto-advance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlayabilityRow.mockResolvedValue({ data: null, error: null });
  });

  it("advances to the next song when the current one ends", async () => {
    const slots = [makeSlot(0), makeSlot(1), makeSlot(2)];
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });

    // Start the setlist — context resolves slot 0 and begins playback.
    await act(async () => {
      await result.current.playSetlist(slots, "setlist-abc");
    });

    await waitFor(() => {
      expect(result.current.playingSlot?.id).toBe("slot-0");
    });
    expect(result.current.playlistMode).toBe(true);
    expect(result.current.playlistIndex).toBe(0);
    expect(result.current.playlistSlots).toHaveLength(3);

    // Simulate the AudioPlayer firing onEnded → which calls advancePlaylist(1).
    await act(async () => {
      await result.current.advancePlaylist(1);
    });

    await waitFor(() => {
      expect(result.current.playingSlot?.id).toBe("slot-1");
    });
    expect(result.current.playlistIndex).toBe(1);
    // Resolved slot must carry a directTrackUrl so the AudioPlayer can play it
    // without needing to do its own (potentially racy) lookup.
    expect(result.current.playingSlot?.directTrackUrl).toContain("Song%201.mp3");

    // And again — third song.
    await act(async () => {
      await result.current.advancePlaylist(1);
    });

    await waitFor(() => {
      expect(result.current.playingSlot?.id).toBe("slot-2");
    });
    expect(result.current.playlistIndex).toBe(2);
  });

  it("stops playback after the final song ends", async () => {
    const slots = [makeSlot(0), makeSlot(1)];
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });

    await act(async () => {
      await result.current.playSetlist(slots);
    });
    await waitFor(() => expect(result.current.playingSlot?.id).toBe("slot-0"));

    await act(async () => {
      await result.current.advancePlaylist(1);
    });
    await waitFor(() => expect(result.current.playingSlot?.id).toBe("slot-1"));

    // Past the end → playback should clear.
    await act(async () => {
      await result.current.advancePlaylist(1);
    });
    await waitFor(() => expect(result.current.playingSlot).toBeNull());
    expect(result.current.playlistMode).toBe(false);
  });
});

describe("AudioPlayerContext — server-precomputed playability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlayabilityRow.mockResolvedValue({ data: null, error: null });
  });

  it("uses the precomputed direct track URL instead of a live archive.org lookup", async () => {
    // A real setlist slot (UUID id) that has a precomputed 'playable' row.
    const slot: PlayableSlot = {
      id: "11111111-1111-4111-8111-111111111111",
      song: { id: "song-x", title: "Eyes of the World" },
      setNumber: 1,
      position: 0,
      segueToNext: false,
      version: {
        id: "v-x", song_id: "song-x", show_date: "1977-05-08",
        archive_org_url: "https://archive.org/details/gd1977-05-08.sbd",
        venue: "Barton Hall", city: "Ithaca, NY",
        era_id: null, rating: null, description: null,
      },
      directTrackUrl: null,
    };
    mockPlayabilityRow.mockResolvedValueOnce({
      data: { status: "playable", direct_track_url: "https://archive.org/download/gd1977-05-08.sbd/precomp-eyes.mp3" },
      error: null,
    });

    const { result } = renderHook(() => useAudioPlayer(), { wrapper });
    await act(async () => {
      await result.current.playSetlist([slot], "setlist-precomp");
    });

    await waitFor(() => expect(result.current.playingSlot?.id).toBe(slot.id));
    // The precomputed URL wins; the live findTrackInRecording path is skipped.
    expect(result.current.playingSlot?.directTrackUrl).toBe(
      "https://archive.org/download/gd1977-05-08.sbd/precomp-eyes.mp3",
    );
    expect(findTrackInRecording).not.toHaveBeenCalled();
  });

  it("falls back to live resolution when there is no precomputed row", async () => {
    const slot: PlayableSlot = {
      id: "22222222-2222-4222-8222-222222222222",
      song: { id: "song-y", title: "Sugaree" },
      setNumber: 1,
      position: 0,
      segueToNext: false,
      version: {
        id: "v-y", song_id: "song-y", show_date: "1977-05-08",
        archive_org_url: "https://archive.org/details/gd1977-05-08.sbd",
        venue: "Barton Hall", city: "Ithaca, NY",
        era_id: null, rating: null, description: null,
      },
      directTrackUrl: null,
    };
    // mockPlayabilityRow stays at its default miss (data: null).

    const { result } = renderHook(() => useAudioPlayer(), { wrapper });
    await act(async () => {
      await result.current.playSetlist([slot], "setlist-live");
    });

    await waitFor(() => expect(result.current.playingSlot?.id).toBe(slot.id));
    // Live path resolved it — the mock returns a "<archiveUrl>/<song>.mp3" URL.
    expect(findTrackInRecording).toHaveBeenCalled();
    expect(result.current.playingSlot?.directTrackUrl).toContain("Sugaree.mp3");
  });
});
