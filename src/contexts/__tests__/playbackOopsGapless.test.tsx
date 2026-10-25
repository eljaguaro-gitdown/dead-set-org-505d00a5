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
