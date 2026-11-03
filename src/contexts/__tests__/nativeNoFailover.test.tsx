import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";

/**
 * In the iOS app the mirror failover deliberately does NOT run, and this
 * pins that it stays off until the plugin can support it.
 *
 * NativeAudioPlugin.swift reports a failed item as `{ message }` alone, for
 * ANY item: AVQueuePlayer preloads the next track, and that preload failing
 * looks exactly like the playing track failing. A failover keyed on "the
 * playing slot" would then reload a track that is playing fine, at its own
 * position, again on every retry. The plugin also skips the failed item
 * itself before JS hears about it. So the app keeps its old behaviour, which
 * files the failure at once, until the plugin names the item.
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

const { listeners, native, rpc, mirrors } = vi.hoisted(() => ({
  listeners: {} as Record<string, (data: unknown) => void>,
  native: {} as Record<string, ReturnType<typeof vi.fn>>,
  rpc: vi.fn(),
  mirrors: vi.fn(),
}));

vi.mock("@/lib/nativeApp", () => ({ isNativeApp: () => true }));
vi.mock("@/lib/player/nativeBridge", () => {
  for (const m of ["load", "append", "play", "pause", "seek", "gotoIndex", "setVolume", "stop", "removeAllListeners"]) {
    native[m] = vi.fn(async () => undefined);
  }
  return {
    NativeAudio: {
      ...native,
      addListener: vi.fn(async (event: string, cb: (data: unknown) => void) => {
        listeners[event] = cb;
        return { remove: vi.fn(async () => undefined) };
      }),
    },
  };
});
vi.mock("@/lib/archiveOrg", () => ({
  archiveKeyDate: () => null,
  archiveMirrorUrls: (...a: unknown[]) => mirrors(...a),
  findArchiveRecording: vi.fn(async () => null),
  findRecordingForDate: vi.fn(async () => null),
  findTrackInRecording: vi.fn(async () => null),
  findTrackInRecordingDetailed: vi.fn(async () => ({ url: null, unreachable: false })),
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
      select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })),
    })),
  },
}));

import { AudioPlayerProvider, useAudioPlayer, type PlayableSlot } from "@/contexts/AudioPlayerContext";
import { SYNTHETIC_VERSION_DEFAULTS } from "@/lib/syntheticVersion";
import { resetPlayedHere } from "@/lib/playbackIssues";

const ID = "gd71-10-19.orefm.clugston.3301.sbeok.shnf";
const TRACK = `https://archive.org/download/${ID}/gd71-10-19d1t09.mp3`;
const SONG = "71717171-7171-4717-8717-717171717171";
const JACK: PlayableSlot = {
  id: "jack-straw",
  song: { id: SONG, title: "Jack Straw" },
  setNumber: 1,
  position: 0,
  segueToNext: false,
  version: { ...SYNTHETIC_VERSION_DEFAULTS, id: "v1", song_id: SONG, show_date: "1971-10-19", archive_org_url: `https://archive.org/details/${ID}` },
  directTrackUrl: TRACK,
};

const wrapper = ({ children }: { children: ReactNode }) => <AudioPlayerProvider>{children}</AudioPlayerProvider>;
const reports = () => rpc.mock.calls.filter((c) => c[0] === "report_playback_issue");

beforeEach(() => {
  vi.clearAllMocks();
  resetPlayedHere();
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => true });
  rpc.mockImplementation(async (fn: string) =>
    fn === "report_playback_issue" ? { data: "issue-1", error: null } : { data: [], error: null },
  );
  mirrors.mockImplementation(async () => ({ urls: ["https://ia600906.us.archive.org/31/items/x/y.mp3"], unreachable: false }));
});
afterEach(() => undefined);

describe("the app's native engine keeps its old behaviour on an engine error", () => {
  it("files the failure at once and loads nothing else: no failover", async () => {
    const { result } = renderHook(() => useAudioPlayer(), { wrapper });
    await act(async () => { await result.current.playSingle(JACK); });
    await waitFor(() => expect(native.load).toHaveBeenCalledTimes(1));
    expect(native.load.mock.calls[0][0].tracks[0].url).toBe(TRACK);
    await waitFor(() => expect(listeners.error).toBeTypeOf("function"));

    await act(async () => { listeners.error({ message: "The operation could not be completed" }); });
    await waitFor(() => expect(reports()).toHaveLength(1));
    expect(reports()[0][1]).toEqual(expect.objectContaining({ p_kind: "wont_play", p_track_url: TRACK }));
    await waitFor(() => expect(result.current.transport.error).toBe("That tape won't play. The source may be offline."));
    expect(mirrors).not.toHaveBeenCalled();
    expect(native.load).toHaveBeenCalledTimes(1);
  });
});
