import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

/**
 * "The song not found — but they ARE there."
 *
 * resolveSlot returned `null` for three different things: the song is not on
 * this tape (an answer about the music), the Archive did not respond (an
 * admission about the network), and the search came back empty. playSingle
 * reported all three as "That song isn't on this tape." — so a reader got told
 * a tape was missing seconds before that same tape started playing.
 *
 * These drive the real provider and assert the SENTENCE, because the
 * distinction only exists if it reaches the screen.
 */

const mocks = vi.hoisted(() => ({
  findTrackInRecording: vi.fn(),
  findRecordingForDate: vi.fn(),
  findArchiveRecording: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  success: vi.fn(),
}));

vi.mock("@/lib/archiveOrg", () => ({
  findTrackInRecording: mocks.findTrackInRecording,
  findRecordingForDate: mocks.findRecordingForDate,
  findArchiveRecording: mocks.findArchiveRecording,
  archiveKeyDate: (d?: string | null) => d ?? null,
}));
vi.mock("sonner", () => ({
  toast: { error: mocks.error, info: mocks.info, success: mocks.success },
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    }),
    auth: { getUser: async () => ({ data: { user: null } }) },
  },
}));
vi.mock("@/lib/player/engineFlag", () => ({ resolvePlayerEngine: () => "legacy" }));

import { AudioPlayerProvider, useAudioPlayer, type PlayableSlot } from "@/contexts/AudioPlayerContext";

const SLOT: PlayableSlot = {
  id: "slot-1",
  song: { id: "song-1", title: "Eyes of the World" },
  version: {
    id: "v1", song_id: "song-1", show_date: "1973-02-09",
    archive_org_url: "https://archive.org/details/gd73-02-09",
    venue: "Stanford", city: null, era_id: null, rating: null, description: null,
  } as PlayableSlot["version"],
  directTrackUrl: null,
  setNumber: 1,
  position: 0,
  segueToNext: false,
};

/**
 * The OTHER shape: a slot that names its night and stores no tape. 21 of the
 * 33 community Songbook nights arrive this way, so it is the common case, and
 * it takes a different branch of resolveSlot than a slot with a stored url.
 */
const DATED_SLOT: PlayableSlot = {
  ...SLOT,
  id: "slot-2",
  version: { ...SLOT.version, archive_org_url: null } as PlayableSlot["version"],
};

const Harness = ({ slot = SLOT }: { slot?: PlayableSlot }) => {
  const { playSingle, transport } = useAudioPlayer();
  return (
    <>
      <button onClick={() => void playSingle(slot)}>play</button>
      <div data-testid="err">{transport.error ?? ""}</div>
    </>
  );
};

const tap = (slot?: PlayableSlot) => {
  const r = render(<AudioPlayerProvider><Harness slot={slot} /></AudioPlayerProvider>);
  fireEvent.click(screen.getAllByText("play")[0]);
  return r;
};

beforeEach(() => vi.clearAllMocks());

describe("a tape we could not ask about is never reported as one that does not exist", () => {
  it("says it could not REACH the Archive when the lookups throw", async () => {
    mocks.findTrackInRecording.mockRejectedValue(new Error("network"));
    mocks.findRecordingForDate.mockRejectedValue(new Error("network"));
    tap();
    await waitFor(() =>
      expect(screen.getByTestId("err").textContent).toMatch(/reach the Archive/i),
    );
    // The exact claim that was false: the tape is probably fine.
    expect(screen.getByTestId("err").textContent).not.toMatch(/isn't on this tape/i);
  });

  it("still says 'not on this tape' when the Archive actually answers", async () => {
    mocks.findTrackInRecording.mockResolvedValue(null);
    mocks.findRecordingForDate.mockResolvedValue(null);
    tap();
    await waitFor(() =>
      expect(screen.getByTestId("err").textContent).toMatch(/isn't on this tape/i),
    );
    expect(screen.getByTestId("err").textContent).not.toMatch(/reach the Archive/i);
  });

  it("says nothing at all when the track resolves", async () => {
    mocks.findTrackInRecording.mockResolvedValue("https://archive.org/x.mp3");
    tap();
    await waitFor(() => expect(mocks.findTrackInRecording).toHaveBeenCalled());
    expect(screen.getByTestId("err").textContent).toBe("");
  });

  it("a DATED slot with no stored tape: a throw is unreachable, not 'no tape'", async () => {
    // The named-night branch — a different code path from a slot that stores a
    // recording url, and the one most community Songbook nights actually use.
    mocks.findRecordingForDate.mockRejectedValue(new Error("network"));
    tap(DATED_SLOT);
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(String(mocks.error.mock.calls[0][0])).toMatch(/reach the Archive/i);
  });

  it("a DATED slot the Archive answers about says no tape circulates", async () => {
    mocks.findRecordingForDate.mockResolvedValue(null);
    mocks.findArchiveRecording.mockResolvedValue(null);
    tap(DATED_SLOT);
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    const said = String(mocks.error.mock.calls[0][0]);
    expect(said).toMatch(/no tape/i);
    expect(said).not.toMatch(/reach the Archive/i);
  });

  it("a stored tape that lacks the song, then an unreachable night, is unreachable", async () => {
    // The heal branch: the stored recording was READ and does not carry the
    // song (a real answer), so we go looking for another tape of that night —
    // and THAT request is the one that fails. Guides saved before the archive
    // url was verified land here, so it is not a rare path.
    mocks.findTrackInRecording.mockResolvedValue(null);
    mocks.findRecordingForDate.mockRejectedValue(new Error("network"));
    tap();
    await waitFor(() =>
      expect(screen.getByTestId("err").textContent).toMatch(/reach the Archive/i),
    );
    expect(screen.getByTestId("err").textContent).not.toMatch(/isn't on this tape/i);
  });

  it("a throw does not escape as an unhandled rejection and strand the bar", async () => {
    // findTrackInRecording was called unguarded: a throw escaped resolveSlot
    // into playSingle, where nothing caught it — nothing played, no message
    // appeared, and the bar spun forever.
    mocks.findTrackInRecording.mockRejectedValue(new Error("boom"));
    mocks.findRecordingForDate.mockRejectedValue(new Error("boom"));
    tap();
    await waitFor(() => expect(screen.getByTestId("err").textContent).not.toBe(""));
  });
});
