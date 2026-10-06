import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

/**
 * The guards that keep an abandoned tap from killing the one that replaced it,
 * and the heal path that must survive an unreadable stored tape.
 *
 * Scope, stated honestly because the gate measured it: resolveSlot has a
 * stored-url branch and a no-url branch, each with its own staleness bail and
 * its own success guard. The first six tests below drive the NO-URL branch;
 * the stored-url pair is covered by the last two, added after mutants showed
 * the branch was unpinned. These mock `findRecordingForDate` wholesale, so
 * they prove the context's SEQUENCING and nothing about the resolver beneath
 * it — resolveReachability.test.tsx runs the real resolver over a stubbed
 * fetch for that.
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
  findTrackInRecordingDetailed: vi.fn(
    // Declared WITH its parameters: several tests below branch on the url, and
    // a zero-arg vi.fn makes every one of those mockImplementations a type
    // error that `vitest run` cannot see and only the typecheck reports.
    async (_url: string, _title?: string) => ({ url: null as string | null, unreachable: false }),
  ),
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


describe("the stored-url branch has the same two guards, and they were unpinned", () => {
  /**
   * Found by the pre-release gate's mutants, not by me. Everything above drives
   * the branch for a slot with a date and no tape, so the stored-url branch's
   * staleness bail could be replaced with `if (false)` and its success guard
   * stripped of the seq check with all tests green. That branch is the Songbook
   * night-row shape — those rows carry stored urls — which is precisely where
   * the swap defect was reported in the first place.
   */
  const stored = (id: string, tape: string): PlayableSlot => ({
    ...base, id,
    version: { ...base.version, archive_org_url: `https://archive.org/details/${tape}` } as PlayableSlot["version"],
  });

  it("a stored tape that fails late does not raise a banner over the tape now playing", async () => {
    /**
     * Both controls carry the SAME slot id, because that is what a Songbook
     * row is. With different ids this mutant is invisible: setPlaybackError
     * scopes the error to the failing slot, and a scoped error for a slot that
     * is not playing is never exposed. Share the id — as the real rows do —
     * and the stale failure's "Couldn't reach the Archive" lands squarely on
     * the tape the reader is listening to. My first draft used two ids and the
     * mutant walked straight through it.
     */
    const slow = stored("row", "gd-slow");
    const fast = stored("row", "gd-fast");
    let failSlow: () => void = () => {};
    mocks.findTrackInRecordingDetailed.mockImplementation((url: string) => {
      if (url.includes("gd-fast")) {
        return Promise.resolve({ url: "https://archive.org/download/gd-fast/althea.mp3", unreachable: false });
      }
      // Hangs, then reports the tape as unreadable — so the heal runs too.
      return new Promise((res) => { failSlow = () => res({ url: null, unreachable: true }); });
    });
    mocks.findRecordingForDate.mockRejectedValue(new Error("archive down"));
    const Two = () => {
      const { playSingle, playingSlot, transport } = useAudioPlayer();
      return (
        <>
          <button onClick={() => void playSingle(slow)}>slow</button>
          <button onClick={() => void playSingle(fast)}>fast</button>
          <div data-testid="t">{playingSlot?.directTrackUrl ?? ""}</div>
          <div data-testid="b">{transport.error ?? ""}</div>
        </>
      );
    };
    render(<AudioPlayerProvider><Two /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("slow"));
    fireEvent.click(screen.getByText("fast"));
    await waitFor(() => expect(screen.getByTestId("t")).toHaveTextContent("gd-fast"));
    failSlow();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByTestId("t").textContent).toContain("gd-fast");
    expect(screen.getByTestId("b").textContent).toBe("");
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("a stored tape that SUCCEEDS late does not take over from the newer tap", async () => {
    // Same row, two nights: the id check cannot help here, so the seq check
    // on the stored-url success path is the only thing holding the line.
    const row = (tape: string): PlayableSlot => ({
      ...base, id: "row",
      version: { ...base.version, archive_org_url: `https://archive.org/details/${tape}` } as PlayableSlot["version"],
    });
    const first = row("gd-first");
    const second = row("gd-second");
    let landFirst: () => void = () => {};
    mocks.findTrackInRecordingDetailed.mockImplementation((url: string) => {
      if (url.includes("gd-second")) {
        return Promise.resolve({ url: "https://archive.org/download/gd-second/althea.mp3", unreachable: false });
      }
      return new Promise((res) => {
        landFirst = () => res({ url: "https://archive.org/download/gd-first/althea.mp3", unreachable: false });
      });
    });
    const Row = () => {
      const { playSingle, playingSlot } = useAudioPlayer();
      return (
        <>
          <button onClick={() => void playSingle(first)}>one</button>
          <button onClick={() => void playSingle(second)}>two</button>
          <div data-testid="t2">{playingSlot?.directTrackUrl ?? ""}</div>
        </>
      );
    };
    render(<AudioPlayerProvider><Row /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("one"));
    fireEvent.click(screen.getByText("two"));
    await waitFor(() => expect(screen.getByTestId("t2")).toHaveTextContent("gd-second"));
    landFirst();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByTestId("t2").textContent).toContain("gd-second");
  });

  it("a track lookup that THROWS says the Archive was unreachable, not that the song isn't there", async () => {
    /**
     * The gate's survivor 5: nothing rejected that call, so the catch could
     * have returned absent() — "That song isn't on this tape" — for what is
     * actually "we couldn't read the tape". That is the exact conflation the
     * unreachable/absent split exists to prevent.
     */
    mocks.findTrackInRecordingDetailed.mockRejectedValue(new Error("boom"));
    mocks.findRecordingForDate.mockRejectedValue(new Error("boom"));
    const only = stored("only", "gd-throw");
    const One = () => {
      const { playSingle, transport } = useAudioPlayer();
      return (
        <>
          <button onClick={() => void playSingle(only)}>go</button>
          <div data-testid="banner">{transport.error ?? ""}</div>
        </>
      );
    };
    render(<AudioPlayerProvider><One /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("go"));
    // A lone tap reports through the error BANNER, not a toast — the toast is
    // the queue's "Skipping …" path. Asserting the toast here passed vacuously
    // in my first draft, which is the sweep-vs-render mistake again.
    await waitFor(() => expect(screen.getByTestId("banner").textContent).not.toBe(""));
    const said = screen.getByTestId("banner").textContent ?? "";
    expect(said).toMatch(/reach the Archive/i);
    expect(said).not.toMatch(/isn't on this tape/i);
  });
});


describe("Next, pressed while a tap is still resolving", () => {
  /**
   * The case where the id half of the success guard is the ONLY thing holding
   * the line: transport.next() goes through `advancePlaylist`, which changes
   * playingSlot WITHOUT bumping playSingleSeqRef, so a tap that lands after
   * the reader has moved on is still "current" by sequence number. Dropping
   * `prev.playingSlot?.id === slot.id` survives every other test in this file.
   *
   * What actually happens here, probed rather than assumed: a bare playSingle
   * carries no playlist context, so it empties playlistSlots and Next finds
   * nothing to advance to and STOPS the player. That is a real guarded
   * behaviour — a late tap must not resurrect a player the reader stopped —
   * but it is not "skips to the next track", which is what the first version
   * of this test was titled. The gate caught the mismatch; the assertions now
   * pin the stop explicitly so the next reader cannot mistake the mechanism.
   */
  const tape = (id: string, t: string): PlayableSlot => ({
    ...base, id, position: id === "p2" ? 1 : 0,
    version: { ...base.version, archive_org_url: `https://archive.org/details/${t}` } as PlayableSlot["version"],
  });
  const P1 = tape("p1", "gd-p1");
  const P2 = tape("p2", "gd-p2");
  const SLOW = tape("slow", "gd-slow");

  it("a late tap does not restart a player that Next has already stopped", async () => {
    let landSlow: () => void = () => {};
    mocks.findTrackInRecordingDetailed.mockImplementation((url: string) => {
      if (url.includes("gd-slow")) {
        return new Promise((res) => {
          landSlow = () => res({ url: "https://archive.org/download/gd-slow/althea.mp3", unreachable: false });
        });
      }
      const which = url.includes("gd-p2") ? "p2" : "p1";
      return Promise.resolve({ url: `https://archive.org/download/gd-${which}/althea.mp3`, unreachable: false });
    });
    const Q = () => {
      const { playSetlist, playSingle, playingSlot, transport } = useAudioPlayer();
      return (
        <>
          <button onClick={() => void playSetlist([P1, P2], "s")}>all</button>
          <button onClick={() => void playSingle(SLOW)}>slow</button>
          <button onClick={() => transport.next()}>next</button>
          <div data-testid="q">{playingSlot?.id ?? ""}</div>
        </>
      );
    };
    render(<AudioPlayerProvider><Q /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("all"));
    await waitFor(() => expect(screen.getByTestId("q")).toHaveTextContent("p1"));
    fireEvent.click(screen.getByText("slow"));
    await waitFor(() => expect(screen.getByTestId("q")).toHaveTextContent("slow"));
    fireEvent.click(screen.getByText("next"));
    // Pin the mechanism, not just "something changed": a bare playSingle left
    // no queue, so Next stops the player rather than advancing. Asserting the
    // exact end state is what stops this test quietly becoming about
    // something else again.
    await waitFor(() => expect(screen.getByTestId("q").textContent).toBe(""));
    landSlow();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByTestId("q").textContent).toBe("");
  });

  it("the same holds for a tap with no stored tape, resolved by night", async () => {
    /**
     * The gate's remaining note: dropping the id check from the NO-URL branch
     * alone survived all 29 tests, because the test above runs a slot that
     * carries a stored url and so only exercises the other branch. Both
     * branches have the same guard and both need their own coverage — the
     * lesson from the conjunction mutants, one level up.
     */
    const dated: PlayableSlot = {
      ...base, id: "dated",
      version: { ...base.version, archive_org_url: null, show_date: "1980-05-16" } as PlayableSlot["version"],
    };
    let landDated: () => void = () => {};
    mocks.findRecordingForDate.mockImplementation(
      () => new Promise((res) => {
        landDated = () => res({
          url: "https://archive.org/details/gd-dated",
          directTrackUrl: "https://archive.org/download/gd-dated/althea.mp3",
          venue: "Nassau", date: "1980-05-16",
        });
      }),
    );
    const R = () => {
      const { playSingle, playingSlot, transport } = useAudioPlayer();
      return (
        <>
          <button onClick={() => void playSingle(dated)}>dated</button>
          <button onClick={() => transport.next()}>next2</button>
          <div data-testid="r">{playingSlot?.id ?? ""}</div>
        </>
      );
    };
    render(<AudioPlayerProvider><R /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("dated"));
    await waitFor(() => expect(screen.getByTestId("r")).toHaveTextContent("dated"));
    fireEvent.click(screen.getByText("next2"));
    await waitFor(() => expect(screen.getByTestId("r").textContent).toBe(""));
    landDated();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByTestId("r").textContent).toBe("");
  });
});
