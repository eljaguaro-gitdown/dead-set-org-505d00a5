import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

/**
 * The two guards that keep an abandoned tap from killing the one that
 * replaced it, and the heal path that must survive an unreadable stored tape.
 *
 * I could not pin the first two earlier: stubbing `fetch` beneath the real
 * resolver meant waiting out a 12s abort, and my tests passed with the guards
 * REMOVED. The pre-release gate showed the way — mock `findRecordingForDate`
 * itself with a deferred and settle it late. That gives the late failure
 * directly, with no timeout to outlast.
 */

const mocks = vi.hoisted(() => ({
  findRecordingForDate: vi.fn(),
  findTrackInRecording: vi.fn(async () => null as string | null),
  /**
   * resolveSlot calls the DETAILED lookup, and the difference between
   * `unreachable: true` and `url: null` is exactly what the heal test is
   * about — a fixed `false` here is what let the regression walk past it.
   */
  findTrackInRecordingDetailed: vi.fn(async () => ({ url: null as string | null, unreachable: false })),
  findArchiveRecording: vi.fn(async () => null),
  error: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/lib/archiveOrg", () => ({
  archiveKeyDate: (d?: string | null) => d ?? null,
  findArchiveRecording: mocks.findArchiveRecording,
  findRecordingForDate: mocks.findRecordingForDate,
  findTrackInRecording: mocks.findTrackInRecording,
  findTrackInRecordingDetailed: mocks.findTrackInRecordingDetailed,
}));
vi.mock("sonner", () => ({ toast: { error: mocks.error, info: mocks.info, success: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
    auth: { getUser: async () => ({ data: { user: null } }) },
    // playSetlist counts a play through this — without it the run throws
    // and the assertion fails for a reason that has nothing to do with the guard.
    rpc: async () => ({ data: null, error: null }),
  },
}));
vi.mock("@/lib/player/engineFlag", () => ({ resolvePlayerEngine: () => "legacy" }));

import { AudioPlayerProvider, useAudioPlayer, type PlayableSlot } from "@/contexts/AudioPlayerContext";

const base: PlayableSlot = {
  id: "x", song: { id: "s", title: "Althea" },
  version: {
    id: "v", song_id: "s", show_date: "1980-05-16", archive_org_url: null,
    venue: null, city: null, era_id: null, rating: null, description: null,
  } as PlayableSlot["version"],
  directTrackUrl: null, setNumber: 1, position: 0, segueToNext: false,
};
/** Dated, no stored tape — resolves only through the by-night search. */
const A: PlayableSlot = { ...base, id: "a" };
/** Already playable, so it starts with no resolution at all. */
const B: PlayableSlot = {
  ...base, id: "b",
  version: { ...base.version, archive_org_url: "https://archive.org/details/gd-b" } as PlayableSlot["version"],
  directTrackUrl: "https://archive.org/download/gd-b/althea.mp3",
};

const Harness = () => {
  const { playSingle, playSetlist, playingSlot, transport } = useAudioPlayer();
  return (
    <>
      <button onClick={() => void playSingle(A)}>tapA</button>
      <button onClick={() => void playSingle(B)}>tapB</button>
      <button onClick={() => void playSetlist([B], "s1")}>playAll</button>
      <div data-testid="now">{playingSlot?.id ?? ""}</div>
      <div data-testid="err">{transport.error ?? ""}</div>
    </>
  );
};

const now = () => screen.getByTestId("now").textContent ?? "";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findTrackInRecording.mockResolvedValue(null);
  mocks.findTrackInRecordingDetailed.mockResolvedValue({ url: null, unreachable: false });
  mocks.findArchiveRecording.mockResolvedValue(null);
});

/** A by-night search that hangs until we fail it. */
const deferSearch = () => {
  let fail: () => void = () => {};
  mocks.findRecordingForDate.mockImplementation(
    () => new Promise((_, rej) => { fail = () => rej(new Error("archive down")); }),
  );
  return () => fail();
};

describe("an abandoned tap must not kill the tap that replaced it", () => {
  it("a single tap that replaces it keeps playing when the first fails late", async () => {
    const failA = deferSearch();
    render(<AudioPlayerProvider><Harness /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("tapA"));
    await waitFor(() => expect(now()).toBe("a"));
    fireEvent.click(screen.getByText("tapB"));
    await waitFor(() => expect(now()).toBe("b"));
    failA();
    await new Promise((r) => setTimeout(r, 50));
    // Without the staleness guard, A's failure cleared B and toasted over it.
    expect(now()).toBe("b");
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("Play All keeps playing when an abandoned tap fails late", async () => {
    // Supersession runs both ways: playSetlist bumps playSingleSeqRef too.
    const failA = deferSearch();
    render(<AudioPlayerProvider><Harness /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("tapA"));
    await waitFor(() => expect(now()).toBe("a"));
    fireEvent.click(screen.getByText("playAll"));
    await waitFor(() => expect(now()).toBe("b"));
    failA();
    await new Promise((r) => setTimeout(r, 50));
    expect(now()).toBe("b");
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("an abandoned tap that SUCCEEDS late does not steal the tape from the newer one", async () => {
    /**
     * The other half, and the one the first four tests could not see: all of
     * them made the abandoned tap FAIL, which exercises the bail-out on the
     * error path. A slow tap that eventually resolves takes the success path,
     * where the setState guard is the only thing standing between the reader
     * and the wrong song starting under a tape they are already hearing.
     */
    let land: () => void = () => {};
    mocks.findRecordingForDate.mockImplementation(
      () => new Promise((res) => {
        land = () => res({
          url: "https://archive.org/details/gd-late-a",
          directTrackUrl: "https://archive.org/download/gd-late-a/althea.mp3",
          venue: "Nassau", date: "1980-05-16",
        });
      }),
    );
    render(<AudioPlayerProvider><Harness /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("tapA"));
    await waitFor(() => expect(now()).toBe("a"));
    fireEvent.click(screen.getByText("tapB"));
    await waitFor(() => expect(now()).toBe("b"));
    land();
    await new Promise((r) => setTimeout(r, 50));
    expect(now()).toBe("b");
  });

  it("two controls on ONE row: the slower night must not take over the faster one", async () => {
    /**
     * The guard the four tests above cannot reach, and the defect the Songbook
     * gate blocked on. First-played and last-played sit on the same Songbook
     * row and therefore carry the same slot id with different NIGHTS, so
     * `prev.playingSlot?.id === slot.id` is true for the abandoned run too —
     * it is the sequence number, and only the sequence number, that stops
     * last-played's tap from being answered with first-played's tape.
     *
     * This is why the id check alone is not the guard: in every other test
     * here the ids differ and it masks the hole.
     */
    const row = (date: string): PlayableSlot => ({
      ...base, id: "row",
      version: { ...base.version, show_date: date, archive_org_url: null } as PlayableSlot["version"],
    });
    const FTP = row("1975-02-28");
    const LTP = row("1995-07-09");
    let landFtp: () => void = () => {};
    mocks.findRecordingForDate.mockImplementation((_t: string, date: string) => {
      if (date === "1995-07-09") {
        return Promise.resolve({
          url: "https://archive.org/details/gd-ltp",
          directTrackUrl: "https://archive.org/download/gd-ltp/althea.mp3",
          venue: "Soldier Field", date,
        });
      }
      return new Promise((res) => {
        landFtp = () => res({
          url: "https://archive.org/details/gd-ftp",
          directTrackUrl: "https://archive.org/download/gd-ftp/althea.mp3",
          venue: "Kezar", date,
        });
      });
    });
    const Row = () => {
      const { playSingle, playingSlot } = useAudioPlayer();
      return (
        <>
          <button onClick={() => void playSingle(FTP)}>ftp</button>
          <button onClick={() => void playSingle(LTP)}>ltp</button>
          <div data-testid="tape">{playingSlot?.directTrackUrl ?? ""}</div>
        </>
      );
    };
    render(<AudioPlayerProvider><Row /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("ftp"));
    fireEvent.click(screen.getByText("ltp"));
    await waitFor(() => expect(screen.getByTestId("tape")).toHaveTextContent("gd-ltp"));
    landFtp();
    await new Promise((r) => setTimeout(r, 50));
    // Tapped last-played, so last-played is what plays.
    expect(screen.getByTestId("tape").textContent).toContain("gd-ltp");
  });

  it("a lone tap's own failure is still reported — the guard discards nothing real", async () => {
    mocks.findRecordingForDate.mockRejectedValue(new Error("archive down"));
    render(<AudioPlayerProvider><Harness /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("tapA"));
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(String(mocks.error.mock.calls[0][0])).toMatch(/reach the Archive/i);
  });
});

describe("an unreadable stored tape still heals onto another tape of that night", () => {
  it("plays the healed tape instead of looping 'try again'", async () => {
    /**
     * The regression the gate caught. A stored identifier that persistently
     * 503s, beside a HEALTHY night search: failing fast on the stored tape
     * forecloses the heal, so every tap said "couldn't reach the Archive" and
     * nothing ever played — where live healed onto the other tape.
     */
    const stored: PlayableSlot = {
      ...base, id: "c",
      version: { ...base.version, archive_org_url: "https://archive.org/details/dead-5xx" } as PlayableSlot["version"],
    };
    // The stored tape cannot be READ — a 5xx, not "the song isn't on it".
    // That is the input the early return tripped on; with `unreachable: false`
    // the regression is simply not exercised, which is how it survived.
    mocks.findTrackInRecordingDetailed.mockResolvedValue({ url: null, unreachable: true });
    // ...but the night itself is fine.
    mocks.findRecordingForDate.mockResolvedValue({
      url: "https://archive.org/details/gd-healed",
      directTrackUrl: "https://archive.org/download/gd-healed/althea.mp3",
      venue: "Nassau",
      date: "1980-05-16",
    });
    const Solo = () => {
      const { playSingle, playingSlot, transport } = useAudioPlayer();
      return (
        <>
          <button onClick={() => void playSingle(stored)}>go</button>
          <div data-testid="url">{playingSlot?.directTrackUrl ?? ""}</div>
          <div data-testid="err2">{transport.error ?? ""}</div>
        </>
      );
    };
    render(<AudioPlayerProvider><Solo /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("go"));
    await waitFor(() =>
      expect(screen.getByTestId("url")).toHaveTextContent("gd-healed"),
    );
    expect(screen.getByTestId("err2").textContent).toBe("");
  });
});
