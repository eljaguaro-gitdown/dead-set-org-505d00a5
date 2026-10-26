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
  queues: [] as Array<{ opts: Record<string, (info?: unknown) => void> }>,
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
});
afterEach(() => {
  online = true;
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

  it("a fresh tap on the same tape is a fresh attempt, and may fail again", async () => {
    const { result } = await start();
    await act(async () => { engineFails(FIRST); });
    await act(async () => { engineFails(SECOND); });
    await act(async () => { await result.current.playSingle(SLOT); });
    await act(async () => { engineFails(FIRST); });
    await waitFor(() => expect(reports()).toHaveLength(2));
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
