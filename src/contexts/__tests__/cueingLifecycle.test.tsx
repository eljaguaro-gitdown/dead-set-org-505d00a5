import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

/**
 * `cueingTitle` is the busy flag that makes the digging card appear during
 * Play All, which clears `playingSlot` and so leaves nothing else to watch.
 *
 * It shipped with a defect nothing could see: NO provider test read it. The
 * early return for a superseded run carried the comment "the newer run owns
 * cueingTitle now — do not clear it", which is true only when the newer run is
 * another playSetlist. `playSingle` and `stopPlayback` also bump
 * `playSetlistSeqRef`, and neither cleared the flag — so the card sat over a
 * tape that was already playing. Measured in a real browser at 31 seconds,
 * ending only when an unrelated stall error happened to hide it.
 *
 * A busy flag set by one entry point must be cleared by EVERY path that
 * supersedes that entry point, not just the one that re-sets it.
 */

const mocks = vi.hoisted(() => ({ error: vi.fn(), info: vi.fn(), success: vi.fn() }));

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

const slot = (id: string, title: string, identifier: string): PlayableSlot => ({
  id,
  song: { id: `song-${id}`, title },
  version: {
    id: `v-${id}`, song_id: `song-${id}`, show_date: "1973-02-09",
    archive_org_url: `https://archive.org/details/${identifier}`,
    venue: null, city: null, era_id: null, rating: null, description: null,
  } as PlayableSlot["version"],
  directTrackUrl: null,
  setNumber: 1,
  position: 0,
  segueToNext: false,
});

const A = slot("a", "Althea", "gd-a");
const B = slot("b", "Bertha", "gd-b");
/**
 * A dated slot with NO stored tape — the branch whose failure path actually
 * clears `playingSlot`. The stored-url branch only skips inside a queue, so a
 * test built on A cannot see the staleness guard working at all.
 */
/** Already resolved, so Play All starts it with no network at all. */
const B_READY: PlayableSlot = {
  ...B,
  id: "b2",
  directTrackUrl: "https://archive.org/download/gd-b/Bertha.mp3",
};

const A_NO_URL: PlayableSlot = {
  ...A,
  id: "a2",
  version: { ...A.version, archive_org_url: null } as PlayableSlot["version"],
};

const json = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as unknown as Response;
const GOOD = {
  files: [{ name: "Bertha.mp3", format: "VBR MP3", length: "300" },
          { name: "Althea.mp3", format: "VBR MP3", length: "300" }],
  metadata: { identifier: "gd-b" },
};

const Harness = () => {
  const { playSingle, playSetlist, stopPlayback, transport, playingSlot } = useAudioPlayer();
  return (
    <>
      <button onClick={() => void playSetlist([A], "set-1")}>playAll</button>
      <button onClick={() => void playSetlist([B_READY], "set-2")}>playAllB</button>
      <button onClick={() => void playSingle(B)}>playOne</button>
      <button onClick={() => void playSingle(A)}>playA</button>
      <button onClick={() => void playSingle(A_NO_URL)}>playAnoUrl</button>
      <button onClick={() => void playSingle(A, { slots: [A, B], setlistId: "set-1" })}>
        playAinQueue
      </button>
      <button onClick={() => stopPlayback()}>stop</button>
      <div data-testid="cue">{transport.cueingTitle ?? ""}</div>
      <div data-testid="err">{transport.error ?? ""}</div>
      <div data-testid="now">{playingSlot?.song.title ?? ""}</div>
    </>
  );
};

const cue = () => screen.getByTestId("cue").textContent ?? "";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

/** A fetch that never settles, so Play All stays mid-resolve. */
const hang = () => vi.mocked(fetch).mockImplementation(() => new Promise<Response>(() => {}));

describe("cueingTitle", () => {
  it("is set while Play All is hunting for its first tape", async () => {
    hang();
    render(<AudioPlayerProvider><Harness /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("playAll"));
    await waitFor(() => expect(cue()).toBe("Althea"));
  });

  it("is cleared when a single tap supersedes Play All — the shipped defect", async () => {
    hang();
    render(<AudioPlayerProvider><Harness /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("playAll"));
    await waitFor(() => expect(cue()).toBe("Althea"));

    // The reader gives up on Play All and taps a night instead.
    vi.mocked(fetch).mockResolvedValue(json(GOOD));
    fireEvent.click(screen.getByText("playOne"));
    // Without this the card kept saying "Finding Althea" over a playing tape.
    await waitFor(() => expect(cue()).toBe(""));
  });

  it("is cleared by stopPlayback", async () => {
    hang();
    render(<AudioPlayerProvider><Harness /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("playAll"));
    await waitFor(() => expect(cue()).toBe("Althea"));
    fireEvent.click(screen.getByText("stop"));
    await waitFor(() => expect(cue()).toBe(""));
  });

  it("is cleared once the first tape resolves", async () => {
    vi.mocked(fetch).mockResolvedValue(json(GOOD));
    render(<AudioPlayerProvider><Harness /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("playAll"));
    await waitFor(() => expect(cue()).toBe(""));
  });

  it("is cleared when Play All finds nothing at all", async () => {
    vi.mocked(fetch).mockResolvedValue(json({ files: [], metadata: {} }));
    render(<AudioPlayerProvider><Harness /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("playAll"));
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(cue()).toBe("");
  });

  it("Play All says it could not REACH the Archive, not that no tape exists", async () => {
    // N3: playSetlist used to discard `unreachable` and claim "No tape
    // circulating for any of these yet" with the network simply down.
    vi.mocked(fetch).mockResolvedValue(
      { ok: false, status: 503, json: async () => ({}) } as unknown as Response,
    );
    render(<AudioPlayerProvider><Harness /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("playAll"));
    await waitFor(() => expect(mocks.error).toHaveBeenCalled(), { timeout: 5000 });
    const said = String(mocks.error.mock.calls[0][0]);
    expect(said).toMatch(/reach the Archive/i);
    expect(said).not.toMatch(/no tape circulating/i);
  });
});

describe("the other paths the gate found unpinned", () => {
  const err = () => screen.getByTestId("err").textContent ?? "";

  it("Play All clears an error left by a previous failed tap", async () => {
    // Same reasoning as playSingle: a new run is a new attempt, and the banner
    // from the last one must not sit over it.
    vi.mocked(fetch).mockResolvedValue(
      { ok: false, status: 503, json: async () => ({}) } as unknown as Response,
    );
    render(<AudioPlayerProvider><Harness /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("playA"));
    await waitFor(() => expect(err()).toMatch(/reach the Archive/i), { timeout: 5000 });

    vi.mocked(fetch).mockResolvedValue(json(GOOD));
    fireEvent.click(screen.getByText("playAll"));
    await waitFor(() => expect(err()).toBe(""), { timeout: 5000 });
  });

  it("a slot inside a queue says it could not REACH the Archive, then skips", async () => {
    // The playlist-mode branch survived two gate rounds with no coverage: it
    // could be forced to the "not on this tape" wording and stay green.
    vi.mocked(fetch).mockResolvedValue(
      { ok: false, status: 503, json: async () => ({}) } as unknown as Response,
    );
    render(<AudioPlayerProvider><Harness /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("playAinQueue"));
    await waitFor(() => expect(mocks.info).toHaveBeenCalled(), { timeout: 5000 });
    const said = String(mocks.info.mock.calls[0][0]);
    expect(said).toMatch(/couldn't reach the Archive/i);
    expect(said).not.toMatch(/not on this tape/i);
    // And it must not PROMISE to keep looking while skipping.
    expect(said).not.toMatch(/still looking/i);
  });

  const now = () => screen.getByTestId("now").textContent ?? "";

  /**
   * KNOWN TEST GAP, recorded rather than faked.
   *
   * Two behaviours in this release have no regression test: the staleness
   * guard in playSingle's failure paths (N2), and playSetlist bumping
   * playSingleSeqRef so supersession runs both ways (H1). Both are
   * implemented, and the pre-release gate verified both in a real browser —
   * "B keeps playing and there is no toast".
   *
   * I wrote tests for them and they passed while the guards were REMOVED, so
   * they were asserting nothing. Driving the abandoned tap to a late failure
   * needs the by-night resolver to exhaust its retry inside the test window,
   * and this harness could not get it there. A test that passes for the wrong
   * reason is worse than a missing one, so they are gone rather than green.
   *
   * To close it: a fake timer around findRecordingForDate's retry backoff, or
   * injecting the resolver instead of stubbing fetch beneath it.
   */

  /**
   * gd-a (and the by-night search) hangs until released, then fails for good.
   *
   * The "for good" matters: findRecordingForDate RETRIES, so a harness that
   * only rejects the one pending request just hangs again on the retry and the
   * tap never finishes — which silently made two of these tests vacuous.
   */
  const hangA = () => {
    const pending: ((e: Error) => void)[] = [];
    let failing = false;
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("gd-a") || url.includes("advancedsearch")) {
        if (failing) return Promise.reject(new Error("down"));
        return new Promise<Response>((_, rej) => pending.push(rej));
      }
      return Promise.resolve(json(GOOD));
    });
    return () => {
      failing = true;
      pending.splice(0).forEach((rej) => rej(new Error("down")));
    };
  };

  it("a late failure from an abandoned tap does not toast over the new one", async () => {
    // Tap A (hangs), tap B (plays), then A finally fails. A's failure path
    // used to clear B's playingSlot and toast over it.
    let failA: () => void = () => {};
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("gd-a")) {
        return new Promise<Response>((_, rej) => { failA = () => rej(new Error("down")); });
      }
      return Promise.resolve(json(GOOD));
    });
    render(<AudioPlayerProvider><Harness /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("playA"));
    fireEvent.click(screen.getByText("playOne"));
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalled());
    failA();
    await new Promise((r) => setTimeout(r, 1500));
    expect(err()).not.toMatch(/reach the Archive/i);
  });
});

describe("two taps that race must not swap each other's tape", () => {
  /**
   * The cardinal failure for this project: a tap that plays a different night
   * than the one chosen.
   *
   * The Songbook's first-played and last-played controls both built their slot
   * through `communitySlot(issue, { position: -1 })`, so both got the id
   * `songbook-<song>--1`. `playSingle`'s SUCCESS path was guarded by slot id
   * and not by sequence — only its failure paths checked `seq` — so tapping
   * first-played, then last-played before the first resolved, applied the
   * first's tape to the second's tap. The window is one Archive resolve, and
   * the two controls sit side by side on a phone.
   *
   * Mock-level tests cannot see this: they assert which slot was handed to
   * playSingle, and both taps hand over a correct slot. Only the provider can
   * show the second one being overwritten.
   */
  const dated = (id: string, date: string): PlayableSlot => ({
    ...A,
    id,
    version: { ...A.version, archive_org_url: null, show_date: date } as PlayableSlot["version"],
  });

  const Racer = ({ first, second }: { first: PlayableSlot; second: PlayableSlot }) => {
    const { playSingle, playingSlot } = useAudioPlayer();
    return (
      <>
        <button onClick={() => void playSingle(first)}>tapA</button>
        <button onClick={() => void playSingle(second)}>tapB</button>
        <div data-testid="night">{playingSlot?.version?.show_date ?? ""}</div>
      </>
    );
  };

  /** An advancedsearch response that really does name a recording. */
  const searchDocs = (date: string) =>
    json({ response: { docs: [{ identifier: `gd-${date}`, date: `${date}T00:00:00Z`, venue: "X" }] } });

  /**
   * Tap `first`, tap `second` while the first is still searching, then let the
   * FIRST one resolve successfully and late. The second tap must keep the
   * player.
   */
  const raceTaps = async (first: PlayableSlot, second: PlayableSlot) => {
    const gates: { date: string; release: (r: Response) => void }[] = [];
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("advancedsearch")) {
        const date = decodeURIComponent(url).match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? "";
        return new Promise<Response>((res) => gates.push({ date, release: res }));
      }
      return Promise.resolve(json(GOOD));
    });
    render(<AudioPlayerProvider><Racer first={first} second={second} /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("tapA"));
    await waitFor(() => expect(gates.length).toBe(1));
    fireEvent.click(screen.getByText("tapB"));
    await waitFor(() => expect(gates.length).toBe(2));

    // Sanity: without this the assertion below passes on an empty player and
    // proves nothing — which is exactly how the first version of this test
    // survived every mutation.
    expect(screen.getByTestId("night")).toHaveTextContent(
      second.version!.show_date as string,
    );

    // The ABANDONED tap now resolves, successfully, last.
    gates[0].release(searchDocs(gates[0].date));
    await new Promise((r) => setTimeout(r, 1500));
  };

  it("the second tap's night survives a late first resolve, even with distinct ids", async () => {
    const ftp = dated("songbook-song-1--1", "1971-02-18");
    const ltp = dated("songbook-song-1--2", "1995-06-25");
    // NB: dates are unique per test on purpose — findRecordingForDate caches by
    // (title, date), so reusing them makes the second test resolve from cache
    // and never issue the request the race depends on.
    await raceTaps(ftp, ltp);
    expect(screen.getByTestId("night")).not.toHaveTextContent("1971-02-18");
  });

  it("and survives it even when the two slots SHARE an id", async () => {
    // Belt and braces: the id fix alone would leave the player one shared id
    // away from the same bug. The sequence guard on the success path is what
    // makes it structurally impossible.
    const ftp = dated("songbook-song-1--1", "1973-11-11");
    const ltp = dated("songbook-song-1--1", "1989-10-09");
    await raceTaps(ftp, ltp);
    expect(screen.getByTestId("night")).not.toHaveTextContent("1973-11-11");
  });
});
