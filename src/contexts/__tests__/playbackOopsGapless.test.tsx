import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";

/**
 * The two halves of the oops flow that only exist on the GAPLESS engine (what
 * every real device runs; jsdom downgrades to legacy without an AudioContext,
 * so this file supplies one — same harness as AudioPlayerContext.recovery):
 *
 *  1. "That tape won't play": an engine error on a single tap is filed and
 *     apologised for — unless the browser is offline, when the tape is not
 *     the problem.
 *  2. "A tape we KNOW plays": 20s of real audio records the track, once.
 *     It is the only evidence the card may offer a tape on.
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

class FakeAudioContext {
  state = "running";
  resume = vi.fn(async () => undefined);
  close = vi.fn(async () => undefined);
}
vi.stubGlobal("AudioContext", FakeAudioContext);

const { queues, rpc } = vi.hoisted(() => ({
  queues: [] as Array<{
    opts: Record<string, (info?: unknown) => void>;
    addTrack: ReturnType<typeof vi.fn>;
    gotoTrack: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  }>,
  rpc: vi.fn(),
}));

vi.mock("gapless", () => {
  class FakeQueue {
    opts: Record<string, (info?: unknown) => void>;
    constructor(opts: Record<string, (info?: unknown) => void>) {
      this.opts = opts;
      queues.push(this);
    }
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

const IDENT = "gd1977-05-08.sbd.hicks.4982";
const TRACK = `https://archive.org/download/${IDENT}/gd77-05-08eaton-d3t01.mp3`;

vi.mock("@/lib/archiveOrg", () => ({
  archiveKeyDate: (d?: string | null) => {
    const day = (d || "").slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
  },
  findArchiveRecording: vi.fn(async () => null),
  findRecordingForDate: vi.fn(async () => null),
  findTrackInRecording: vi.fn(async () => TRACK),
  findTrackInRecordingDetailed: vi.fn(async () => ({ url: TRACK, unreachable: false })),
}));
vi.mock("@/lib/playEventTracker", () => ({
  startPlayEvent: vi.fn(async () => undefined),
  finalizePlayEvent: vi.fn(async () => undefined),
  pausePlayEvent: vi.fn(),
  resumePlayEvent: vi.fn(),
  setPlayEventTrackDuration: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpc(...a),
    auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
    from: vi.fn(() => ({
      insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(async () => ({ data: null })) })) })),
      update: vi.fn(() => ({ eq: vi.fn(async () => ({ data: null })) })),
      select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })),
    })),
  },
}));

import { toast } from "sonner";
import { findArchiveRecording, findRecordingForDate, findTrackInRecordingDetailed } from "@/lib/archiveOrg";
import { AudioPlayerProvider, useAudioPlayer, type PlayableSlot } from "@/contexts/AudioPlayerContext";
import { SYNTHETIC_VERSION_DEFAULTS } from "@/lib/syntheticVersion";
import { resetPlayedHere } from "@/lib/playbackIssues";

const SONG = "51515151-5151-4515-8515-515151515151";
const SLOT: PlayableSlot = {
  id: "cornell-scarlet",
  song: { id: SONG, title: "Scarlet Begonias" },
  setNumber: 1,
  position: 0,
  segueToNext: false,
  version: {
    ...SYNTHETIC_VERSION_DEFAULTS,
    id: "v1",
    song_id: SONG,
    show_date: "1977-05-08",
    archive_org_url: `https://archive.org/details/${IDENT}`,
  },
  directTrackUrl: TRACK,
};

const wrapper = ({ children }: { children: ReactNode }) => <AudioPlayerProvider>{children}</AudioPlayerProvider>;
const progress = (currentTime: number) =>
  queues[queues.length - 1].opts.onProgress({ index: 0, isPlaying: true, currentTime, duration: 600 });
const recorded = () => rpc.mock.calls.filter((c) => c[0] === "record_tape_ok");
const reports = () => rpc.mock.calls.filter((c) => c[0] === "report_playback_issue");
/** Past PROGRESS_NOTIFY_INTERVAL_MS, so the next tick is not throttled away. */
const pastThrottle = () => new Promise((r) => setTimeout(r, 300));

let online = true;
beforeEach(() => {
  vi.clearAllMocks();
  queues.length = 0;
  resetPlayedHere();
  online = true;
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => online });
  rpc.mockImplementation(async (fn: string) =>
    fn === "report_playback_issue" ? { data: "issue-1", error: null } : { data: [], error: null },
  );
  vi.mocked(findTrackInRecordingDetailed).mockReset().mockImplementation(async () => ({ url: TRACK, unreachable: false }));
  vi.mocked(findRecordingForDate).mockReset().mockImplementation(async () => null);
  // clearAllMocks keeps implementations, so a test that holds this one would leak.
  vi.mocked(findArchiveRecording).mockReset().mockImplementation(async () => null);
});
afterEach(() => {
  online = true;
  vi.useRealTimers();
});

const start = async () => {
  const hook = renderHook(() => useAudioPlayer(), { wrapper });
  expect(hook.result.current.transport.engine).toBe("gapless");
  await act(async () => { await hook.result.current.playSingle(SLOT); });
  await waitFor(() => expect(queues.length).toBeGreaterThan(0));
  return hook;
};

describe("'that tape won't play' on the engine that ships", () => {
  it("an engine error on a single tap is apologised for and filed, with the track", async () => {
    const { result } = await start();
    await act(async () => { queues[queues.length - 1].opts.onError(new Error("MEDIA_ERR_DECODE") as unknown); });
    await waitFor(() => expect(result.current.playbackOops?.kind).toBe("wont_play"));
    expect(result.current.transport.error).toBe("That tape won't play. The source may be offline.");
    await waitFor(() => expect(reports()).toHaveLength(1));
    expect(reports()[0][1]).toEqual(expect.objectContaining({ p_kind: "wont_play", p_track_url: TRACK, p_notify: true }));
  });

  it("offline, the tape is not the problem: the old message, nothing filed", async () => {
    const { result } = await start();
    online = false;
    await act(async () => { queues[queues.length - 1].opts.onError(new Error("MEDIA_ERR_NETWORK") as unknown); });
    await waitFor(() => expect(result.current.transport.error).toBeTruthy());
    expect(result.current.playbackOops).toBeNull();
    expect(reports()).toHaveLength(0);
  });
});

/**
 * `gapless` reports one dead track twice: the <audio> element's error event,
 * then the play() promise rejecting with the same failure. Seen by the
 * 2026-10-26 gate as two report_playback_issue calls per dead tap — doubling
 * report_count and re-raising the card — and two "End of setlist" toasts.
 */
const engineFails = (message: string) => queues[queues.length - 1].opts.onError(new Error(message) as unknown);
/**
 * Queues a track was actually loaded into: one per engine.load(). Counting
 * constructions would miscount, because unlock() builds an empty queue on
 * the first gesture of a session as well.
 */
const loads = () => queues.filter((q) => q.addTrack.mock.calls.length > 0);
const FIRST = "HTML5 audio error on track 0 (code 4): MEDIA_ELEMENT_ERROR";
const SECOND = "NotSupportedError: The element has no supported sources.";

describe("one dead track is one failure, however many times the engine says so", () => {
  it("files once, and the card it raised stays the same card", async () => {
    const { result } = await start();
    await act(async () => { engineFails(FIRST); });
    await waitFor(() => expect(result.current.playbackOops?.issueId).toBe("issue-1"));
    const key = result.current.playbackOops!.key;
    await act(async () => { engineFails(SECOND); });
    expect(reports()).toHaveLength(1);
    expect(result.current.playbackOops?.key).toBe(key);
    expect(result.current.playbackOops?.issueId).toBe("issue-1");
  });

  it("a fresh tap on the same tape is a fresh attempt: the engine is asked again, and may fail again", async () => {
    // Found in a real browser by the 2026-10-26 gate (run 5). The second tap
    // changed neither the slot id nor the track url the anchor effect keys
    // on, so the engine was never asked again: the card and the error cleared,
    // nothing was filed, and the bar sat on Pause at 0:00 / 0:00. This test
    // used to fire the second failure on the FIRST tap's queue, which passed
    // whether or not the tap had reached the engine.
    const { result } = await start();
    await act(async () => { engineFails(FIRST); });
    await act(async () => { engineFails(SECOND); });
    await waitFor(() => expect(reports()).toHaveLength(1));
    expect(loads()).toHaveLength(1);
    await act(async () => { await result.current.playSingle(SLOT); });
    await waitFor(() => expect(loads()).toHaveLength(2));
    expect(loads()[1].addTrack).toHaveBeenCalledWith(TRACK, expect.anything());
    expect(loads()[1].gotoTrack).toHaveBeenCalledWith(0, true);
    await pastThrottle();
    expect(loads()).toHaveLength(2); // one tap, one load
    await act(async () => { loads()[1].opts.onError(new Error(FIRST) as unknown); });
    await waitFor(() => expect(reports()).toHaveLength(2));
    expect(result.current.playbackOops?.kind).toBe("wont_play");
    expect(result.current.transport.error).toBe("That tape won't play. The source may be offline.");
  });

  it("a tape healed onto a new track still reports when that track fails too", async () => {
    // N03 in the gate's mutation run: the repeat key carries the track url as
    // well as the slot id. Here the old track's failure lands while the tap
    // is re-reading the tape, which records it against this slot; the read
    // then heals onto another track of the same slot. Keyed on the id alone,
    // that track's own failure was taken for an echo and swallowed.
    const HEALED = `https://archive.org/download/${IDENT}/gd77-05-08eaton-d3t02.mp3`;
    const { result } = await start();
    let read: (v: { url: string; unreachable: boolean }) => void = () => undefined;
    vi.mocked(findTrackInRecordingDetailed).mockImplementationOnce(() => new Promise((r) => { read = r; }));
    await act(async () => { void result.current.playSingle({ ...SLOT, directTrackUrl: null }); });
    await act(async () => { loads()[0].opts.onError(new Error(FIRST) as unknown); });
    await waitFor(() => expect(reports()).toHaveLength(1));
    await act(async () => { read({ url: HEALED, unreachable: false }); });
    await waitFor(() => expect(loads()).toHaveLength(2));
    expect(loads()[1].addTrack).toHaveBeenCalledWith(HEALED, expect.anything());
    await act(async () => { loads()[1].opts.onError(new Error(FIRST) as unknown); });
    await waitFor(() => expect(reports()).toHaveLength(2));
    expect(reports()[1][1]).toEqual(expect.objectContaining({ p_kind: "wont_play", p_track_url: HEALED }));
  });

  it("a slow tap overtaken by a second tap on the same slot changes nothing when it lands", async () => {
    // The re-anchor above must not undo the stale-tap guards: the first tap's
    // late answer may not move the player, nor reach the engine.
    const LATE = `https://archive.org/download/${IDENT}/gd77-05-08eaton-d1t01.mp3`;
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });
    let read: (v: { url: string; unreachable: boolean }) => void = () => undefined;
    vi.mocked(findTrackInRecordingDetailed).mockImplementationOnce(() => new Promise((r) => { read = r; }));
    await act(async () => { void result.current.playSingle({ ...SLOT, directTrackUrl: null }); });
    await act(async () => { await result.current.playSingle(SLOT); });
    await waitFor(() => expect(loads()).toHaveLength(1));
    await act(async () => { read({ url: LATE, unreachable: false }); });
    await pastThrottle();
    expect(result.current.playingSlot?.directTrackUrl).toBe(TRACK);
    expect(loads()).toHaveLength(1);
    expect(loads()[0].addTrack).toHaveBeenCalledWith(TRACK, expect.anything());
  });

  it("in a queue, it is skipped once and filed once", async () => {
    const NEXT: PlayableSlot = { ...SLOT, id: "cornell-fire", position: 1, song: { id: SONG, title: "Fire on the Mountain" } };
    const AFTER: PlayableSlot = { ...SLOT, id: "cornell-estimated", position: 2, song: { id: SONG, title: "Estimated Prophet" } };
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });
    await act(async () => { await result.current.playSingle(SLOT, { slots: [SLOT, NEXT, AFTER] }); });
    await waitFor(() => expect(queues.length).toBeGreaterThan(0));
    await act(async () => { engineFails(FIRST); engineFails(SECOND); });
    await waitFor(() => expect(result.current.playingSlot?.id).toBe("cornell-fire"));
    expect(reports()).toHaveLength(1);
    expect(reports()[0][1]).toEqual(expect.objectContaining({ p_kind: "wont_play", p_notify: false }));
    expect(result.current.playbackOops).toBeNull();
  });

  it("going back to it and having it fail again is a new failure, not an echo", async () => {
    // Without the slot-change reset, the marker still named this track when
    // the fan went back to it, so its next failure was dropped as a repeat:
    // no report, no skip, a dead bar sitting on it in silence.
    const NEXT: PlayableSlot = { ...SLOT, id: "cornell-fire", position: 1, song: { id: SONG, title: "Fire on the Mountain" } };
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });
    await act(async () => { await result.current.playSingle(SLOT, { slots: [SLOT, NEXT] }); });
    await waitFor(() => expect(queues.length).toBeGreaterThan(0));
    await act(async () => { engineFails(FIRST); engineFails(SECOND); });
    await waitFor(() => expect(result.current.playingSlot?.id).toBe("cornell-fire"));
    await act(async () => { result.current.transport.previous(); });
    await waitFor(() => expect(result.current.playingSlot?.id).toBe("cornell-scarlet"));
    await act(async () => { engineFails(FIRST); });
    await waitFor(() => expect(reports()).toHaveLength(2));
    await waitFor(() => expect(result.current.playingSlot?.id).toBe("cornell-fire"));
  });
});

/**
 * Skipping needs somewhere to skip to. A dead LAST track used to be filed
 * quietly and "skipped" into "End of setlist" — the fan was never told the
 * song the set was heading for did not play.
 */
describe("a queue that ends on a dead track", () => {
  const OPENER: PlayableSlot = { ...SLOT, id: "cornell-opener", position: 0, song: { id: SONG, title: "Minglewood Blues" } };
  const CLOSER: PlayableSlot = { ...SLOT, id: "cornell-closer", position: 1 };

  it("apologises for that song like a dead tap, once, with no 'End of setlist'", async () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });
    await act(async () => { await result.current.playSingle(CLOSER, { slots: [OPENER, CLOSER] }); });
    await waitFor(() => expect(queues.length).toBeGreaterThan(0));
    await act(async () => { engineFails(FIRST); engineFails(SECOND); });
    await waitFor(() => expect(result.current.playbackOops?.issueId).toBe("issue-1"));
    expect(result.current.playbackOops).toEqual(expect.objectContaining({ kind: "wont_play", slotId: "cornell-closer" }));
    expect(reports()).toHaveLength(1);
    expect(reports()[0][1]).toEqual(expect.objectContaining({ p_kind: "wont_play", p_notify: true }));
    expect(vi.mocked(toast.info)).not.toHaveBeenCalledWith("End of setlist");
    // The bar stays on the song with the reason and a retry, as for a single tap.
    expect(result.current.playingSlot?.id).toBe("cornell-closer");
    expect(result.current.transport.error).toBe("That tape won't play. The source may be offline.");
  });

  it("a dead track with more to come still skips quietly", async () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });
    await act(async () => { await result.current.playSingle(OPENER, { slots: [OPENER, CLOSER] }); });
    await waitFor(() => expect(queues.length).toBeGreaterThan(0));
    await act(async () => { engineFails(FIRST); });
    await waitFor(() => expect(result.current.playingSlot?.id).toBe("cornell-closer"));
    expect(result.current.playbackOops).toBeNull();
    expect(reports()[0][1]).toEqual(expect.objectContaining({ p_notify: false }));
  });
});

describe("a tape we know plays", () => {
  it("is not recorded before twenty seconds of real audio", async () => {
    await start();
    await act(async () => { progress(12); });
    await pastThrottle();
    await act(async () => { progress(19); });
    expect(recorded()).toHaveLength(0);
  });

  it("is recorded at twenty seconds, with the night and the exact track", async () => {
    await start();
    await act(async () => { progress(21); });
    await waitFor(() => expect(recorded()).toHaveLength(1));
    expect(recorded()[0][1]).toEqual({
      p_song_id: SONG,
      p_show_date: "1977-05-08",
      p_archive_url: `https://archive.org/details/${IDENT}`,
      p_track_url: TRACK,
    });
  });

  it("is recorded once per track, however long it plays", async () => {
    await start();
    await act(async () => { progress(21); });
    await waitFor(() => expect(recorded()).toHaveLength(1));
    await pastThrottle();
    await act(async () => { progress(45); });
    await pastThrottle();
    await act(async () => { progress(90); });
    expect(recorded()).toHaveLength(1);
  });
});

/** A night with no stored tape, looked up by date: how a Songbook ladder row arrives. */
const night = (id: string, position: number, show_date: string): PlayableSlot => ({
  id,
  song: { id: SONG, title: "Shakedown Street" },
  setNumber: 1,
  position,
  segueToNext: false,
  version: { ...SYNTHETIC_VERSION_DEFAULTS, id: `v-${id}`, song_id: SONG, show_date, archive_org_url: null },
  directTrackUrl: null,
});
/** A stored tape that does not carry its song, with no night to look it up by instead. */
const STORED_WITHOUT: PlayableSlot = {
  ...SLOT,
  id: "stored-without",
  position: 1,
  song: { id: SONG, title: "Morning Dew" },
  version: { ...SLOT.version!, show_date: "" },
  directTrackUrl: null,
};
const OPENER: PlayableSlot = { ...SLOT, id: "opener", position: 0 };
const noMorningDew = () =>
  vi.mocked(findTrackInRecordingDetailed).mockImplementation(async (_url: string, title: string) =>
    title === "Morning Dew" ? { url: null, unreachable: false } : { url: TRACK, unreachable: false },
  );

/**
 * #131 gave a dead last slot the card on the tap path and the engine path.
 * Play All's own resolve loop was the third way to reach the last slot, and
 * the 2026-10-26 gate (run 5) watched it in a browser: the song before it
 * played, then one "End of setlist", with no card and no report.
 */
describe("a Play All that runs out on a night that will not resolve", () => {
  const playToTheEnd = async (last: PlayableSlot) => {
    const hook = renderHook(() => useAudioPlayer(), { wrapper });
    await act(async () => { await hook.result.current.playSetlist([OPENER, last]); });
    await waitFor(() => expect(loads()).toHaveLength(1));
    await act(async () => { loads()[0].opts.onEnded(); });
    return hook;
  };

  it("a night with no tape: the card for that night, filed, and no 'End of setlist'", async () => {
    const { result } = await playToTheEnd(night("last-night", 1, "1991-09-10"));
    await waitFor(() => expect(result.current.playbackOops?.kind).toBe("no_tape"));
    expect(result.current.playbackOops).toEqual(expect.objectContaining({ slotId: "last-night", showDate: "1991-09-10" }));
    await waitFor(() => expect(reports()).toHaveLength(1));
    expect(reports()[0][1]).toEqual(expect.objectContaining({ p_kind: "no_tape", p_show_date: "1991-09-10", p_notify: true }));
    expect(vi.mocked(toast.info)).not.toHaveBeenCalledWith("End of setlist");
    // With no recording the bar cannot draw (GlobalAudioPlayer), so the player
    // stops, as it does for a tap on a night with no tape.
    expect(result.current.playingSlot).toBeNull();
  });

  it("a stored tape without the song: the bar stays on it with the reason, and a retry that works", async () => {
    noMorningDew();
    const { result } = await playToTheEnd(STORED_WITHOUT);
    await waitFor(() => expect(result.current.playbackOops?.kind).toBe("not_on_tape"));
    expect(result.current.playingSlot?.id).toBe("stored-without");
    expect(result.current.transport.error).toBe("That song isn't on this tape.");
    await waitFor(() => expect(reports()).toHaveLength(1));
    expect(reports()[0][1]).toEqual(expect.objectContaining({ p_kind: "not_on_tape", p_notify: true }));
    expect(vi.mocked(toast.info)).not.toHaveBeenCalledWith("End of setlist");

    vi.mocked(findTrackInRecordingDetailed).mockImplementation(async () => ({ url: TRACK, unreachable: false }));
    await act(async () => { result.current.transport.retry(); });
    await waitFor(() => expect(loads()).toHaveLength(2));
    expect(result.current.transport.error).toBeNull();
  });

  it("an Archive that does not answer about the last night: the network message, nothing filed", async () => {
    // A rejection, not a null: findRecordingForDate throws when it could not ask.
    vi.mocked(findRecordingForDate).mockRejectedValue(new Error("archive.org 503"));
    const { result } = await playToTheEnd(night("last-night", 1, "1991-09-10"));
    await waitFor(() =>
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Couldn't reach the Archive just now — tap play to try again."),
    );
    expect(result.current.playbackOops).toBeNull();
    expect(reports()).toHaveLength(0);
    expect(vi.mocked(toast.info)).not.toHaveBeenCalledWith("End of setlist");
  });

  it("a stored tape that could not be read: the bar says so and offers the retry, nothing filed", async () => {
    vi.mocked(findTrackInRecordingDetailed).mockImplementation(async (_url: string, title: string) =>
      title === "Morning Dew" ? { url: null, unreachable: true } : { url: TRACK, unreachable: false },
    );
    const { result } = await playToTheEnd(STORED_WITHOUT);
    await waitFor(() => expect(result.current.transport.error).toBe("Couldn't reach the Archive just now. Tap play to try again."));
    expect(result.current.playingSlot?.id).toBe("stored-without");
    expect(result.current.playbackOops).toBeNull();
    expect(reports()).toHaveLength(0);
  });

  it("Next on the song before it: that song stops, rather than playing on under the last one's name", async () => {
    noMorningDew();
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });
    await act(async () => { await result.current.playSetlist([OPENER, STORED_WITHOUT]); });
    await waitFor(() => expect(loads()).toHaveLength(1));
    const playing = loads()[0];
    expect(playing.destroy).not.toHaveBeenCalled();
    await act(async () => { result.current.transport.next(); });
    await waitFor(() => expect(result.current.transport.error).toBe("That song isn't on this tape."));
    expect(result.current.playingSlot?.id).toBe("stored-without");
    await waitFor(() => expect(playing.destroy).toHaveBeenCalled());
  });

  it("Previous off the front of the set is still just the end of it", async () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });
    await act(async () => { await result.current.playSingle(OPENER, { slots: [night("first-night", -1, "1991-09-10"), OPENER] }); });
    await waitFor(() => expect(loads()).toHaveLength(1));
    await act(async () => { result.current.transport.previous(); });
    await waitFor(() => expect(vi.mocked(toast.info)).toHaveBeenCalledWith("End of setlist"));
    expect(result.current.playbackOops).toBeNull();
    expect(reports()).toHaveLength(0);
  });
});

/**
 * The resolve watchdog's only test was "the slot has no track yet", and a
 * resolve that FAILED leaves the slot without a track too. 25s after "That
 * song isn't on this tape." the bar changed its mind to "Still looking for
 * that tape" (seen in a browser on 6d98516).
 */
describe("the resolve watchdog", () => {
  const LONE: PlayableSlot = { ...STORED_WITHOUT, id: "lone", position: 0 };

  it("does not overwrite an answer it arrives after", async () => {
    vi.useFakeTimers();
    noMorningDew();
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });
    await act(async () => { await result.current.playSingle(LONE); });
    expect(result.current.transport.error).toBe("That song isn't on this tape.");
    await act(async () => { await vi.advanceTimersByTimeAsync(26_000); });
    expect(result.current.transport.error).toBe("That song isn't on this tape.");
  });

  it("still speaks up for a tape that is genuinely still being looked for", async () => {
    vi.useFakeTimers();
    vi.mocked(findTrackInRecordingDetailed).mockImplementation(() => new Promise(() => undefined));
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });
    await act(async () => { void result.current.playSingle(LONE); });
    expect(result.current.transport.error).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(26_000); });
    expect(result.current.transport.error).toBe("Still looking for that tape. Archive.org may be slow right now.");
  });
});

describe("moving on takes the card down", () => {
  const A: PlayableSlot = { ...SLOT, id: "a", position: 0 };
  const B: PlayableSlot = { ...SLOT, id: "b", position: 1 };
  const C: PlayableSlot = { ...SLOT, id: "c", position: 2 };
  const somethingElse = { kind: "no_tape" as const, songId: SONG, songTitle: "Althea", showDate: "1979-12-26" };

  it("Next and Previous, as any fresh tap does", async () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });
    await act(async () => { await result.current.playSingle(B, { slots: [A, B, C] }); });
    await waitFor(() => expect(loads()).toHaveLength(1));
    act(() => result.current.reportPlaybackFailure(somethingElse));
    expect(result.current.playbackOops).not.toBeNull();
    act(() => result.current.transport.next());
    expect(result.current.playbackOops).toBeNull();
    act(() => result.current.reportPlaybackFailure(somethingElse));
    expect(result.current.playbackOops).not.toBeNull();
    act(() => result.current.transport.previous());
    expect(result.current.playbackOops).toBeNull();
  });
});

/**
 * advancePlaylist had no supersession check at all. A skip still resolving
 * when the fan tapped something else landed anyway: on a hit it took the
 * player back into the old queue, and with the last-night handling above, a
 * miss would have stopped the new tape and raised a card over it.
 */
describe("a skip still resolving when the fan taps something else", () => {
  const NEXT = night("next-night", 1, "1978-09-16");
  const OTHER: PlayableSlot = { ...SLOT, id: "other", song: { id: SONG, title: "Fire on the Mountain" } };

  const skipThenTap = async () => {
    const answers: Array<(v: unknown) => void> = [];
    vi.mocked(findRecordingForDate).mockImplementation(() => new Promise((r) => { answers.push(r); }) as never);
    const hook = renderHook(() => useAudioPlayer(), { wrapper });
    await act(async () => { await hook.result.current.playSetlist([OPENER, NEXT]); });
    await waitFor(() => expect(loads()).toHaveLength(1));
    await act(async () => { hook.result.current.transport.next(); });
    await waitFor(() => expect(answers.length).toBeGreaterThan(0));
    await act(async () => { await hook.result.current.playSingle(OTHER); });
    const answer = async (v: unknown) => {
      await act(async () => { answers.forEach((a) => a(v)); });
      await pastThrottle();
    };
    return { ...hook, answer };
  };

  it("a hit does not take the player back into the old queue", async () => {
    const { result, answer } = await skipThenTap();
    await answer({ url: `https://archive.org/details/${IDENT}`, date: "1978-09-16", venue: null, directTrackUrl: TRACK });
    expect(result.current.playingSlot?.id).toBe("other");
    expect(result.current.playlistMode).toBe(false);
  });

  it("a miss neither stops the new tape nor raises a card over it", async () => {
    const { result, answer } = await skipThenTap();
    await answer(null);
    expect(result.current.playingSlot?.id).toBe("other");
    expect(result.current.playbackOops).toBeNull();
    expect(reports()).toHaveLength(0);
  });
});

/**
 * The 2026-10-26 gate (run 6) BLOCKED #133 on this. Previous, Next and the
 * engine's own advances move the player without a newer tap, so the
 * stale-tap `seq` checks cannot see them; and failUnresolvedSlot stops the
 * engine. A late "not on this tape" about the last row therefore stopped song
 * 3, which Previous had put on, and put a card about the last row over it. A
 * late 503 stopped it in silence: no card, no alert, no report.
 */
describe("a late answer about a slot the player has since left", () => {
  const row = (id: string, position: number, title: string, carried = true): PlayableSlot => ({
    ...SLOT,
    id,
    position,
    song: { id: SONG, title },
    version: { ...SLOT.version!, show_date: "" },
    directTrackUrl: carried ? TRACK : null,
  });
  const R1 = row("r1", 0, "Bertha");
  const R2 = row("r2", 1, "Sugaree");
  const R3 = row("r3", 2, "Sugar Magnolia");
  const R4 = row("r4", 3, "Casey Jones");
  const SET = [R1, R2, R3, R4];

  /** Every read of `title`'s tape waits for `answer`, however many there are. */
  const holdTape = (title: string) => {
    const waiting: Array<(v: { url: string | null; unreachable: boolean }) => void> = [];
    vi.mocked(findTrackInRecordingDetailed).mockImplementation((_url: string, t: string) =>
      t === title ? new Promise((r) => { waiting.push(r); }) : Promise.resolve({ url: TRACK, unreachable: false }),
    );
    return async (v: { url: string | null; unreachable: boolean }) => {
      await act(async () => { waiting.forEach((r) => r(v)); });
      await pastThrottle();
    };
  };

  /**
   * Row 2 plays; `tapped` is tapped and its tape held; then `move` (Previous
   * or Next). The tapped row carries no track, so the engine never queued it
   * and the move goes through advancePlaylist, as it did in the browser.
   */
  const tapThenMove = async (tapped: PlayableSlot, move: "previous" | "next") => {
    const answer = holdTape(tapped.song.title);
    const set = SET.map((r) => (r.id === tapped.id ? { ...r, directTrackUrl: null } : r));
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });
    await act(async () => { await result.current.playSingle(R2, { slots: set }); });
    await waitFor(() => expect(loads()).toHaveLength(1));
    await act(async () => { void result.current.playSingle({ ...tapped, directTrackUrl: null }, { slots: set }); });
    await act(async () => { result.current.transport[move](); });
    return { result, answer };
  };

  it("Previous, then 'not on this tape' for the last row: song 3 plays on, and it is filed quietly", async () => {
    const { result, answer } = await tapThenMove(R4, "previous");
    await waitFor(() => expect(result.current.playingSlot?.id).toBe("r3"));
    await waitFor(() => expect(loads()).toHaveLength(2));
    const playing = loads()[1];
    await answer({ url: null, unreachable: false });
    expect(playing.destroy).not.toHaveBeenCalled();
    expect(loads()).toHaveLength(2);
    expect(result.current.playingSlot?.id).toBe("r3");
    expect(result.current.transport.error).toBeNull();
    expect(result.current.playbackOops).toBeNull();
    await waitFor(() => expect(reports()).toHaveLength(1));
    expect(reports()[0][1]).toEqual(expect.objectContaining({ p_kind: "not_on_tape", p_notify: false }));
  });

  it("Previous, then a 503 for the last row: song 3 plays on, and nothing is filed", async () => {
    const { result, answer } = await tapThenMove(R4, "previous");
    await waitFor(() => expect(result.current.playingSlot?.id).toBe("r3"));
    await waitFor(() => expect(loads()).toHaveLength(2));
    const playing = loads()[1];
    await answer({ url: null, unreachable: true });
    expect(playing.destroy).not.toHaveBeenCalled();
    expect(result.current.playingSlot?.id).toBe("r3");
    expect(result.current.transport.error).toBeNull();
    expect(result.current.playbackOops).toBeNull();
    expect(reports()).toHaveLength(0);
  });

  it("Next, then 'not on this tape' for the row it left: no second skip, and the set does not end", async () => {
    // A middle row takes the "Skipping…" branch, which advanced the queue
    // again from wherever the fan had gone: from the last row, into "End of
    // setlist", stopping it.
    const { result, answer } = await tapThenMove(R3, "next");
    await waitFor(() => expect(result.current.playingSlot?.id).toBe("r4"));
    await waitFor(() => expect(loads()).toHaveLength(2));
    const playing = loads()[1];
    await answer({ url: null, unreachable: false });
    expect(playing.destroy).not.toHaveBeenCalled();
    expect(result.current.playingSlot?.id).toBe("r4");
    expect(result.current.transport.error).toBeNull();
    expect(vi.mocked(toast.info)).not.toHaveBeenCalledWith(expect.stringMatching(/^Skipping/));
    expect(vi.mocked(toast.info)).not.toHaveBeenCalledWith("End of setlist");
    await waitFor(() => expect(reports()).toHaveLength(1));
    expect(reports()[0][1]).toEqual(expect.objectContaining({ p_kind: "not_on_tape", p_notify: false }));
  });

  it("Previous, then 'no tape of this night' for a last row with no recording: song 3 plays on", async () => {
    // A night with no tape stops the player (failUnresolvedSlot), so the same
    // late answer about it stopped song 3 too.
    const LAST_NIGHT = night("r4-night", 3, "1991-09-10");
    const set = [R1, R2, R3, LAST_NIGHT];
    const waiting: Array<(v: null) => void> = [];
    vi.mocked(findRecordingForDate).mockImplementation(() => new Promise((r) => { waiting.push(r); }) as never);
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });
    await act(async () => { await result.current.playSingle(R2, { slots: set }); });
    await waitFor(() => expect(loads()).toHaveLength(1));
    await act(async () => { void result.current.playSingle(LAST_NIGHT, { slots: set }); });
    await act(async () => { result.current.transport.previous(); });
    await waitFor(() => expect(result.current.playingSlot?.id).toBe("r3"));
    await waitFor(() => expect(loads()).toHaveLength(2));
    const playing = loads()[1];
    await act(async () => { waiting.forEach((r) => r(null)); });
    await pastThrottle();
    expect(playing.destroy).not.toHaveBeenCalled();
    expect(result.current.playingSlot?.id).toBe("r3");
    expect(result.current.playbackOops).toBeNull();
    await waitFor(() => expect(reports()).toHaveLength(1));
    expect(reports()[0][1]).toEqual(expect.objectContaining({ p_kind: "no_tape", p_notify: false }));
  });

  it("the queue running out onto a held last row, then Previous: the answer does not stop the song Previous chose", async () => {
    // advancePlaylist's own resolve has the same hole: its supersession check
    // watched seq, which Previous does not move.
    const answer = holdTape(R4.song.title);
    const set = [R1, R2, R3, { ...R4, directTrackUrl: null }];
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });
    await act(async () => { await result.current.playSingle(R3, { slots: set }); });
    await waitFor(() => expect(loads()).toHaveLength(1));
    await act(async () => { loads()[0].opts.onEnded(); });
    await act(async () => { result.current.transport.previous(); });
    await waitFor(() => expect(result.current.playingSlot?.id).toBe("r2"));
    await waitFor(() => expect(loads()).toHaveLength(2));
    const playing = loads()[1];
    await answer({ url: null, unreachable: false });
    expect(playing.destroy).not.toHaveBeenCalled();
    expect(result.current.playingSlot?.id).toBe("r2");
    expect(result.current.transport.error).toBeNull();
    expect(result.current.playbackOops).toBeNull();
  });

  it("the engine moving on by itself, then 'not on this tape' for the tapped row: the new song plays on", async () => {
    const answer = holdTape(R4.song.title);
    const set = [R1, R2, R3, { ...R4, directTrackUrl: null }];
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });
    await act(async () => { await result.current.playSingle(R2, { slots: set }); });
    await waitFor(() => expect(loads()).toHaveLength(1));
    await waitFor(() => expect(loads()[0].addTrack).toHaveBeenCalledTimes(2)); // R2, then R3 appended
    await act(async () => { void result.current.playSingle(set[3], { slots: set }); });
    // R2 finishes while the tapped row is still being read, and the queue the
    // engine still holds carries on into R3: a gapless advance, no tap at all.
    await act(async () => { loads()[0].opts.onStartNewTrack({ index: 1, isPlaying: true, currentTime: 0, duration: 300 }); });
    await waitFor(() => expect(result.current.playingSlot?.id).toBe("r3"));
    await answer({ url: null, unreachable: false });
    expect(loads()[0].destroy).not.toHaveBeenCalled();
    expect(result.current.playingSlot?.id).toBe("r3");
    expect(result.current.transport.error).toBeNull();
    expect(result.current.playbackOops).toBeNull();
  });

  it("with the player still on the row, the same late answer still fails it like a tap", async () => {
    // The control: the guard is about having moved, not about being late.
    const answer = holdTape(R4.song.title);
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });
    await act(async () => { await result.current.playSingle(R2, { slots: SET }); });
    await waitFor(() => expect(loads()).toHaveLength(1));
    await act(async () => { void result.current.playSingle({ ...R4, directTrackUrl: null }, { slots: SET }); });
    await answer({ url: null, unreachable: false });
    expect(result.current.playingSlot?.id).toBe("r4");
    expect(result.current.transport.error).toBe("That song isn't on this tape.");
    await waitFor(() => expect(result.current.playbackOops?.kind).toBe("not_on_tape"));
    expect(loads()[0].destroy).toHaveBeenCalled();
  });

  /**
   * Q09 in the 2026-10-26 gate (run 7). The no-recording branch files a late
   * answer only when it is an answer about the music: `!cantReach &&
   * !uncertain`. The test above for this branch answers null, a definite "no
   * tape of this night", so either conjunct could be deleted with every test
   * green, and a 503 would have been filed as `no_tape`. There is no kind for
   * "could not ask" (see PlaybackIssueKind), so the right thing to file for
   * either answer here is nothing at all: no report_playback_issue call, quiet
   * or otherwise.
   *
   * Two ways for a row with no recording to fail without an answer, one per
   * conjunct: a dated night whose lookup THROWS (findRecordingForDate rejects
   * when it could not ask), and an undated row whose generic search comes back
   * empty (findArchiveRecording swallows its errors, so empty is "uncertain").
   */
  const noAnswer = (how: "unreachable" | "uncertain") => {
    const pending: Array<() => void> = [];
    if (how === "unreachable") {
      vi.mocked(findRecordingForDate).mockImplementation(
        () => new Promise((_, rej) => { pending.push(() => rej(new Error("archive.org 503"))); }) as never,
      );
    } else {
      vi.mocked(findArchiveRecording).mockImplementation(
        () => new Promise((res) => { pending.push(() => res(null)); }) as never,
      );
    }
    const last = how === "unreachable" ? night("r4-night", 3, "1991-09-10") : night("r4-undated", 3, "");
    const settle = async () => {
      await act(async () => { pending.forEach((p) => p()); });
      await pastThrottle();
    };
    return { last, set: [R1, R2, R3, last], pending, settle };
  };
  const NO_ANSWER = [
    ["a night whose lookup could not reach the Archive", "unreachable"],
    ["an undated row whose search came back empty", "uncertain"],
  ] as const;

  it.each(NO_ANSWER)("Previous, then no answer for the last row (%s): song 3 plays on, nothing filed, nothing said", async (_how, how) => {
    const { last, set, pending, settle } = noAnswer(how);
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });
    await act(async () => { await result.current.playSingle(R2, { slots: set }); });
    await waitFor(() => expect(loads()).toHaveLength(1));
    await act(async () => { void result.current.playSingle(last, { slots: set }); });
    await waitFor(() => expect(pending.length).toBeGreaterThanOrEqual(2)); // the queue's read, and the tap's
    await act(async () => { result.current.transport.previous(); });
    await waitFor(() => expect(result.current.playingSlot?.id).toBe("r3"));
    await waitFor(() => expect(loads()).toHaveLength(2));
    const playing = loads()[1];
    await settle();
    expect(playing.destroy).not.toHaveBeenCalled();
    expect(result.current.playingSlot?.id).toBe("r3");
    expect(result.current.transport.error).toBeNull();
    expect(result.current.playbackOops).toBeNull();
    expect(vi.mocked(toast.error)).not.toHaveBeenCalled();
    // What reaches report_playback_issue: nothing, so in particular no `no_tape`.
    expect(reports()).toHaveLength(0);
  });

  it.each(NO_ANSWER)("the control: still on the last row, the same answer (%s) stops it and says so, and files nothing", async (_how, how) => {
    // Without this, the test above would pass just as well if the answer
    // never reached playSingle at all.
    const { last, set, pending, settle } = noAnswer(how);
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });
    await act(async () => { await result.current.playSingle(R2, { slots: set }); });
    await waitFor(() => expect(loads()).toHaveLength(1));
    await act(async () => { void result.current.playSingle(last, { slots: set }); });
    await waitFor(() => expect(pending.length).toBeGreaterThanOrEqual(2));
    await settle();
    expect(result.current.playingSlot).toBeNull();
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      how === "unreachable"
        ? "Couldn't reach the Archive just now — tap play to try again."
        : "No tape of this one circulates yet",
    );
    expect(result.current.playbackOops).toBeNull();
    expect(reports()).toHaveLength(0);
  });

  /**
   * Q14 in the same gate run. advancePlaylist checks `startedOn` after every
   * slot it reads, not only the first. The queue-end test above holds the very
   * next row, so the check that refuses it runs on the loop's first iteration,
   * and a check made only there would pass it. Here the row after song 3 is a
   * night with no tape, so the loop skips it (its first iteration, which the
   * check passes) and is reading the last row, its SECOND iteration, when
   * Previous moves the player. Previous does not start a newer run, so `seq`
   * is unchanged and `startedOn` is the only thing that can refuse.
   *
   * Both answers are wrong to act on: a miss would stop song 2 and put a card
   * about the last row over it, and a hit would take the player back to it.
   */
  it.each([
    ["'not on this tape'", { url: null, unreachable: false }],
    ["its tape", { url: TRACK, unreachable: false }],
  ] as const)("the queue skipping a dead night, then Previous while it reads the row after: %s for that row moves nothing", async (_what, reply) => {
    const answer = holdTape(R4.song.title);
    const last: PlayableSlot = { ...R4, position: 4, directTrackUrl: null };
    const set = [R1, R2, R3, night("gap", 3, "1991-09-10"), last];
    const readsOfLast = () =>
      vi.mocked(findTrackInRecordingDetailed).mock.calls.filter(([, title]) => title === R4.song.title).length;
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });
    await act(async () => { await result.current.playSingle(R3, { slots: set }); });
    await waitFor(() => expect(loads()).toHaveLength(1));
    await waitFor(() => expect(readsOfLast()).toBe(1)); // the engine's own queue, reading ahead
    await act(async () => { loads()[0].opts.onEnded(); });
    // The advance has passed the gap and is now waiting on the last row.
    await waitFor(() => expect(readsOfLast()).toBe(2));
    expect(result.current.playingSlot?.id).toBe("r3");
    await act(async () => { result.current.transport.previous(); });
    await waitFor(() => expect(result.current.playingSlot?.id).toBe("r2"));
    await waitFor(() => expect(loads()).toHaveLength(2));
    const playing = loads()[1];
    await answer(reply);
    expect(playing.destroy).not.toHaveBeenCalled();
    expect(loads()).toHaveLength(2);
    expect(result.current.playingSlot?.id).toBe("r2");
    expect(result.current.playlistIndex).toBe(1);
    expect(result.current.transport.error).toBeNull();
    expect(result.current.playbackOops).toBeNull();
    expect(reports()).toHaveLength(0);
  });
});

/**
 * Q13 in the 2026-10-26 gate (run 7). advancePlaylist refuses a stale run on
 * either of two grounds: `seq !== playSetlistSeqRef.current` (a newer run has
 * started) or `onSlotIdRef.current !== startedOn` (the player has moved off
 * the slot it started from). The second half has its own tests above:
 * Previous moves the player without starting a newer run. The first had none.
 * Every newer run the tests above start is on a DIFFERENT slot, so the id half
 * refuses it as well, and the seq half could be deleted with every test green.
 *
 * The seq half is the only refusal when the newer run starts on the SAME slot
 * the advance started from: Play All pressed again on the same set, while a
 * Next is still reading the next tape. Each of the two halves needs a fixture
 * that makes the other one true, or the half under test cannot be reached.
 * The second case puts a dead night in between, so the refusal happens on the
 * loop's second iteration rather than its first.
 */
describe("Play All pressed again while Next is still reading the next tape", () => {
  const OPENING: PlayableSlot = { ...SLOT, id: "opening", position: 0, song: { id: SONG, title: "Bertha" } };
  const NEXT_ROW: PlayableSlot = {
    ...SLOT,
    id: "next-row",
    position: 2,
    song: { id: SONG, title: "Sugaree" },
    version: { ...SLOT.version!, show_date: "" },
    directTrackUrl: null,
  };

  it.each([
    ["the next row", false],
    ["the row after a night that will not resolve", true],
  ] as const)("the old Next's answer for %s does not take the player off the restarted set", async (_where, gap) => {
    const waiting: Array<(v: { url: string | null; unreachable: boolean }) => void> = [];
    vi.mocked(findTrackInRecordingDetailed).mockImplementation((_url: string, title: string) =>
      title === NEXT_ROW.song.title
        ? new Promise((r) => { waiting.push(r); })
        : Promise.resolve({ url: TRACK, unreachable: false }),
    );
    const set = gap ? [OPENING, night("gap", 1, "1991-09-10"), NEXT_ROW] : [OPENING, NEXT_ROW];
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });
    await act(async () => { await result.current.playSetlist(set, "set-1"); });
    await waitFor(() => expect(loads()).toHaveLength(1));
    await waitFor(() => expect(waiting).toHaveLength(1)); // the engine's own queue, reading ahead
    await act(async () => { result.current.transport.next(); });
    await waitFor(() => expect(waiting).toHaveLength(2)); // Next's advance, waiting on the same tape
    expect(result.current.playingSlot?.id).toBe("opening");
    // A newer run, starting on the slot the advance started from.
    await act(async () => { await result.current.playSetlist(set, "set-1"); });
    expect(result.current.playingSlot?.id).toBe("opening");
    await act(async () => { waiting.forEach((r) => r({ url: TRACK, unreachable: false })); });
    await pastThrottle();
    expect(result.current.playingSlot?.id).toBe("opening");
    expect(result.current.playlistIndex).toBe(0);
  });
});
