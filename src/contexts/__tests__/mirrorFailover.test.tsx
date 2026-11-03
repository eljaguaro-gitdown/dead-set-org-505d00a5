import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";

/**
 * A broken mirror is not a dead tape (playback_issues d0916f90: Jack Straw
 * 10/19/71, "tape won't spin"). archive.org's /download/ redirect sent most
 * requests to a mirror answering 500, and Safari reported the HTML error page
 * as MediaError code 4. The item's own servers played it every time. So on
 * the engine every web visitor runs, an engine error on a /download/ track
 * moves the track to those servers, at the position it died, before anything
 * may call it dead.
 *
 * archiveMirrorUrls is the REAL one here, behind a stubbed fetch, so the
 * metadata 5xx and rejection cases go through the same discriminator
 * production uses rather than a mock that hands back its answer.
 */

const waitFor = async (fn: () => void | Promise<void>, timeoutMs = 3000) => {
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

type FakeQueueT = {
  opts: Record<string, (info?: unknown) => void>;
  addTrack: ReturnType<typeof vi.fn>;
  gotoTrack: ReturnType<typeof vi.fn>;
  seek: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
};
const { queues, rpc } = vi.hoisted(() => ({ queues: [] as FakeQueueT[], rpc: vi.fn() }));

vi.mock("gapless", () => {
  class FakeQueue {
    opts: Record<string, (info?: unknown) => void>;
    constructor(opts: Record<string, (info?: unknown) => void>) {
      this.opts = opts;
      queues.push(this as unknown as FakeQueueT);
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

vi.mock("@/lib/archiveOrg", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/archiveOrg")>();
  return {
    archiveKeyDate: actual.archiveKeyDate,
    archiveMirrorUrls: actual.archiveMirrorUrls,
    resetArchiveMirrors: actual.resetArchiveMirrors,
    findArchiveRecording: vi.fn(async () => null),
    findRecordingForDate: vi.fn(async () => null),
    findTrackInRecording: vi.fn(async () => null),
    findTrackInRecordingDetailed: vi.fn(async () => ({ url: null, unreachable: false })),
  };
});
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

import { findTrackInRecordingDetailed, resetArchiveMirrors } from "@/lib/archiveOrg";
import { finalizePlayEvent } from "@/lib/playEventTracker";
import { AudioPlayerProvider, useAudioPlayer, type PlayableSlot } from "@/contexts/AudioPlayerContext";
import { SYNTHETIC_VERSION_DEFAULTS } from "@/lib/syntheticVersion";
import { resetPlayedHere } from "@/lib/playbackIssues";

const ID = "gd71-10-19.orefm.clugston.3301.sbeok.shnf";
const DIR = `/31/items/${ID}`;
const META = {
  d1: "ia600906.us.archive.org",
  d2: "ia800906.us.archive.org",
  dir: DIR,
  workable_servers: ["ia600906.us.archive.org", "ia800906.us.archive.org"],
};
const track = (file: string) => `https://archive.org/download/${ID}/${file}`;
const onServer = (n: 0 | 1, file: string) => `https://${META.workable_servers[n]}${DIR}/${file}`;

const SONG = "71717171-7171-4717-8717-717171717171";
const slot = (id: string, position: number, title: string, file: string): PlayableSlot => ({
  id,
  song: { id: SONG, title },
  setNumber: 1,
  position,
  segueToNext: false,
  version: {
    ...SYNTHETIC_VERSION_DEFAULTS,
    id: `v-${id}`,
    song_id: SONG,
    show_date: "1971-10-19",
    archive_org_url: `https://archive.org/details/${ID}`,
  },
  directTrackUrl: track(file),
});
const JACK = slot("jack-straw", 0, "Jack Straw", "gd71-10-19d1t09.mp3");
const UNCLE = slot("me-and-my-uncle", 1, "Me and My Uncle", "gd71-10-19d1t10.mp3");
const JACK_ON = (n: 0 | 1) => onServer(n, "gd71-10-19d1t09.mp3");

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as unknown as Response;
const status = (code: number) => ({ ok: false, status: code, json: async () => ({}) }) as unknown as Response;
const fetchMock = vi.fn<(url: string) => Promise<Response>>();
const metadataCalls = () => fetchMock.mock.calls.filter(([u]) => String(u).startsWith("https://archive.org/metadata/"));
/** Hold the next metadata request; call the result to answer it. */
const holdMetadata = () => {
  let answer: (r: Response) => void = () => undefined;
  fetchMock.mockImplementationOnce(() => new Promise((r) => { answer = r; }));
  return (r: Response = ok(META)) => answer(r);
};

const capture = vi.fn();
const events = (name: string) => capture.mock.calls.filter((c) => c[0] === name);

const wrapper = ({ children }: { children: ReactNode }) => <AudioPlayerProvider>{children}</AudioPlayerProvider>;
const reports = () => rpc.mock.calls.filter((c) => c[0] === "report_playback_issue");
const recorded = () => rpc.mock.calls.filter((c) => c[0] === "record_tape_ok");
/** Queues a track was loaded into: one per engine.load(). unlock() builds an empty one too. */
const loads = () => queues.filter((q) => q.addTrack.mock.calls.length > 0);
const firstTrackOf = (q: FakeQueueT) => q.addTrack.mock.calls[0]?.[0];
const everyLoadedUrl = () => loads().flatMap((q) => q.addTrack.mock.calls.map((c) => c[0]));
const fails = (q: FakeQueueT, message = "HTML5 audio error on track 0 (code 4): MEDIA_ELEMENT_ERROR") =>
  q.opts.onError(new Error(message) as unknown);
const progress = (q: FakeQueueT, currentTime: number) =>
  q.opts.onProgress({ index: 0, isPlaying: true, currentTime, duration: 600 });
/** Past PROGRESS_NOTIFY_INTERVAL_MS, so the next tick is not throttled away. */
const pastThrottle = () => new Promise((r) => setTimeout(r, 300));
const WONT_PLAY = "That tape won't play. The source may be offline.";

let online = true;
beforeEach(() => {
  vi.clearAllMocks();
  queues.length = 0;
  resetPlayedHere();
  resetArchiveMirrors();
  online = true;
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => online });
  rpc.mockImplementation(async (fn: string) =>
    fn === "report_playback_issue" ? { data: "issue-1", error: null } : { data: [], error: null },
  );
  fetchMock.mockReset().mockImplementation(async (url: string) =>
    url.startsWith("https://archive.org/metadata/") ? ok(META) : status(404),
  );
  vi.stubGlobal("fetch", fetchMock);
  (window as unknown as { posthog: unknown }).posthog = { capture };
  vi.mocked(findTrackInRecordingDetailed).mockReset().mockImplementation(async () => ({ url: null, unreachable: false }));
});
afterEach(() => {
  online = true;
  delete (window as unknown as { posthog?: unknown }).posthog;
});

const play = async (s: PlayableSlot, context?: PlayableSlot[]) => {
  const hook = renderHook(() => useAudioPlayer(), { wrapper });
  expect(hook.result.current.transport.engine).toBe("gapless");
  await act(async () => { await hook.result.current.playSingle(s, context ? { slots: context } : undefined); });
  await waitFor(() => expect(loads()).toHaveLength(1));
  return hook;
};

describe("a track whose mirror fails plays from the item's own servers", () => {
  it("moves to the first server, files nothing, says nothing, and keeps the queue going", async () => {
    const { result } = await play(JACK, [JACK, UNCLE]);
    await waitFor(() => expect(loads()[0].addTrack).toHaveBeenCalledWith(UNCLE.directTrackUrl, expect.anything()));
    // The element's error event, then the play() rejection: one failure.
    await act(async () => {
      fails(loads()[0]);
      fails(loads()[0], "NotSupportedError: The element has no supported sources.");
    });
    await waitFor(() => expect(loads()).toHaveLength(2));
    const fallback = loads()[1];
    expect(firstTrackOf(fallback)).toBe(JACK_ON(0));
    expect(fallback.gotoTrack).toHaveBeenCalledWith(0, true);
    // Nothing had played yet, so there is no position to go back to.
    expect(fallback.seek).not.toHaveBeenCalled();
    // The rest of the set is queued behind it, as on any anchor.
    await waitFor(() => expect(fallback.addTrack).toHaveBeenCalledWith(UNCLE.directTrackUrl, expect.anything()));
    expect(metadataCalls()).toHaveLength(1);

    // It plays. Still nothing filed, no card, no bar error, no skip.
    await pastThrottle();
    await act(async () => { progress(fallback, 25); });
    await waitFor(() => expect(recorded()).toHaveLength(1));
    expect(reports()).toHaveLength(0);
    expect(result.current.playbackOops).toBeNull();
    expect(result.current.transport.error).toBeNull();
    expect(result.current.playingSlot?.id).toBe("jack-straw");
    // The slot keeps its own /download/ url: that is what record_tape_ok takes.
    expect(result.current.playingSlot?.directTrackUrl).toBe(JACK.directTrackUrl);
    expect(recorded()[0][1]).toEqual(expect.objectContaining({ p_track_url: JACK.directTrackUrl }));
    // Measured as a failover, never as a dead track.
    expect(events("audio_failover")).toHaveLength(1);
    expect(events("audio_failover")[0][1]).toEqual(expect.objectContaining({
      track_url: JACK.directTrackUrl, stream_url: JACK_ON(0), attempt: 1,
    }));
    expect(events("audio_error")).toHaveLength(0);
    expect(vi.mocked(finalizePlayEvent)).not.toHaveBeenCalledWith("error");
  });

  it("a track that dies partway resumes where it stopped", async () => {
    // The mirror failed every request for the tail of the file, so a track
    // could start and then die.
    const { result } = await play(JACK);
    await pastThrottle();
    await act(async () => { progress(loads()[0], 312.5); });
    await act(async () => { fails(loads()[0], "HTML5 audio error on track 0 (code 2): MEDIA_ERR_NETWORK"); });
    await waitFor(() => expect(loads()).toHaveLength(2));
    expect(firstTrackOf(loads()[1])).toBe(JACK_ON(0));
    expect(loads()[1].seek).toHaveBeenCalledWith(312.5);
    expect(result.current.transport.error).toBeNull();
  });

  it("a track that dies before its first tick starts at the top, not at the last track's position", async () => {
    // A gapless segue into a dead track: the last progress tick belongs to
    // the song before it, and resuming there would drop the fan minutes
    // into a song they never heard start.
    const { result } = await play(JACK, [JACK, UNCLE]);
    await waitFor(() => expect(loads()[0].addTrack).toHaveBeenCalledWith(UNCLE.directTrackUrl, expect.anything()));
    await pastThrottle();
    await act(async () => { progress(loads()[0], 250); });
    await act(async () => {
      loads()[0].opts.onStartNewTrack({ index: 1, isPlaying: true, currentTime: 0, duration: 300 });
    });
    await waitFor(() => expect(result.current.playingSlot?.id).toBe("me-and-my-uncle"));
    await act(async () => { fails(loads()[0]); });
    await waitFor(() => expect(loads()).toHaveLength(2));
    expect(firstTrackOf(loads()[1])).toBe(onServer(0, "gd71-10-19d1t10.mp3"));
    expect(loads()[1].seek).not.toHaveBeenCalled();
  });

  it("a fresh tap starts over: the Archive's own routing first, then the first server again", async () => {
    const { result } = await play(JACK);
    await act(async () => { fails(loads()[0]); });
    await waitFor(() => expect(loads()).toHaveLength(2));
    expect(firstTrackOf(loads()[1])).toBe(JACK_ON(0));
    await act(async () => { await result.current.playSingle(JACK); });
    await waitFor(() => expect(loads()).toHaveLength(3));
    expect(firstTrackOf(loads()[2])).toBe(JACK.directTrackUrl);
    await act(async () => { fails(loads()[2]); });
    await waitFor(() => expect(loads()).toHaveLength(4));
    expect(firstTrackOf(loads()[3])).toBe(JACK_ON(0));
  });

  it("the bar shows it is busy while the item's servers are looked up, and not after", async () => {
    const { result } = await play(JACK);
    const answer = holdMetadata();
    await act(async () => { fails(loads()[0]); });
    expect(result.current.transport.isLoading).toBe(true);
    await act(async () => { answer(); });
    await waitFor(() => expect(loads()).toHaveLength(2));
    expect(result.current.transport.isLoading).toBe(false);
  });
});

describe("only when every server has failed is it a dead track", () => {
  it("tries each server in order, then files exactly one wont_play against the track's own url", async () => {
    const { result } = await play(JACK);
    await act(async () => { fails(loads()[0]); });
    await waitFor(() => expect(loads()).toHaveLength(2));
    expect(firstTrackOf(loads()[1])).toBe(JACK_ON(0));
    expect(reports()).toHaveLength(0);
    await act(async () => { fails(loads()[1]); });
    await waitFor(() => expect(loads()).toHaveLength(3));
    expect(firstTrackOf(loads()[2])).toBe(JACK_ON(1));
    expect(reports()).toHaveLength(0);
    expect(result.current.transport.error).toBeNull();
    // The last server fails, and says so twice.
    await act(async () => {
      fails(loads()[2]);
      fails(loads()[2], "NotSupportedError: The element has no supported sources.");
    });
    await waitFor(() => expect(reports()).toHaveLength(1));
    expect(reports()[0][1]).toEqual(expect.objectContaining({
      p_kind: "wont_play", p_track_url: JACK.directTrackUrl, p_notify: true,
    }));
    await waitFor(() => expect(result.current.playbackOops?.kind).toBe("wont_play"));
    expect(result.current.transport.error).toBe(WONT_PLAY);
    await pastThrottle();
    expect(reports()).toHaveLength(1);
    expect(loads()).toHaveLength(3);
    // One item, one question, for the whole session.
    expect(metadataCalls()).toHaveLength(1);
    expect(events("audio_failover")).toHaveLength(2);
    expect(events("audio_error")).toHaveLength(1);
  });

  it("an item that lists no servers is a dead track at once, as before", async () => {
    fetchMock.mockImplementation(async () => ok({ ...META, workable_servers: [], d1: undefined, d2: undefined }));
    const { result } = await play(JACK);
    await act(async () => { fails(loads()[0]); });
    await waitFor(() => expect(reports()).toHaveLength(1));
    await waitFor(() => expect(result.current.transport.error).toBe(WONT_PLAY));
    expect(loads()).toHaveLength(1);
  });

  it("a metadata request that rejects: one wont_play, and the next failure asks again", async () => {
    fetchMock.mockImplementation(async () => { throw new TypeError("Failed to fetch"); });
    const { result } = await play(JACK);
    await act(async () => { fails(loads()[0]); });
    await waitFor(() => expect(reports()).toHaveLength(1));
    expect(reports()[0][1]).toEqual(expect.objectContaining({ p_kind: "wont_play", p_track_url: JACK.directTrackUrl }));
    await waitFor(() => expect(result.current.transport.error).toBe(WONT_PLAY));
    expect(loads()).toHaveLength(1);
    expect(metadataCalls()).toHaveLength(2); // the request and its one retry

    // Not remembered as "no servers": the Archive answers now.
    fetchMock.mockImplementation(async () => ok(META));
    await act(async () => { await result.current.playSingle(JACK); });
    await waitFor(() => expect(loads()).toHaveLength(2));
    await act(async () => { fails(loads()[1]); });
    await waitFor(() => expect(loads()).toHaveLength(3));
    expect(firstTrackOf(loads()[2])).toBe(JACK_ON(0));
    expect(reports()).toHaveLength(1);
  });

  it("a metadata 5xx is a resolved promise and the same answer: one wont_play, and asked again next time", async () => {
    fetchMock.mockImplementation(async () => status(503));
    const { result } = await play(JACK);
    await act(async () => { fails(loads()[0]); });
    await waitFor(() => expect(reports()).toHaveLength(1));
    await waitFor(() => expect(result.current.transport.error).toBe(WONT_PLAY));
    expect(loads()).toHaveLength(1);
    expect(metadataCalls()).toHaveLength(2);

    fetchMock.mockImplementation(async () => ok(META));
    await act(async () => { await result.current.playSingle(JACK); });
    await waitFor(() => expect(loads()).toHaveLength(2));
    await act(async () => { fails(loads()[1]); });
    await waitFor(() => expect(loads()).toHaveLength(3));
    expect(firstTrackOf(loads()[2])).toBe(JACK_ON(0));
  });

  it("offline, no server will answer: nothing is asked, and it fails as it always did", async () => {
    const { result } = await play(JACK);
    online = false;
    await act(async () => { fails(loads()[0], "HTML5 audio error on track 0 (code 2): MEDIA_ERR_NETWORK"); });
    await waitFor(() => expect(result.current.transport.error).toBe(WONT_PLAY));
    expect(metadataCalls()).toHaveLength(0);
    expect(reports()).toHaveLength(0);
    expect(loads()).toHaveLength(1);
  });

  it("a failover is not a dead track: it does not count toward the three in a row that stop a set", async () => {
    // One server per item, so every dead track fails twice (its own url,
    // then the server). Counted once each, the cap of three stops the set on
    // the FOURTH dead track. Counting the failovers too stopped it on the second.
    fetchMock.mockImplementation(async () => ok({ ...META, workable_servers: ["ia600906.us.archive.org"], d1: undefined, d2: undefined }));
    const set = [0, 1, 2, 3, 4].map((i) => slot(`s${i}`, i, `Song ${i}`, `gd71-10-19d1t0${i}.mp3`));
    const { result } = await play(set[0], set);
    for (let i = 0; i < 4; i++) {
      await waitFor(() => expect(result.current.playingSlot?.id).toBe(`s${i}`));
      const before = loads().length;
      await act(async () => { fails(loads()[before - 1]); });
      await waitFor(() => expect(loads()).toHaveLength(before + 1));
      expect(firstTrackOf(loads()[before])).toBe(onServer(0, `gd71-10-19d1t0${i}.mp3`));
      await act(async () => { fails(loads()[before]); });
      if (i < 3) await waitFor(() => expect(result.current.playingSlot?.id).toBe(`s${i + 1}`));
    }
    await waitFor(() => expect(result.current.transport.error).toBe(WONT_PLAY));
    expect(result.current.playingSlot?.id).toBe("s3");
    expect(reports()).toHaveLength(4);
  });
});

describe("a late failover answer about a slot the player has left acts on nothing", () => {
  it("the engine moved on to the next track while the servers were looked up", async () => {
    const { result } = await play(JACK, [JACK, UNCLE]);
    await waitFor(() => expect(loads()[0].addTrack).toHaveBeenCalledWith(UNCLE.directTrackUrl, expect.anything()));
    const answer = holdMetadata();
    await act(async () => { fails(loads()[0]); });
    // Neither a tap nor a re-anchor: only the slot moves.
    await act(async () => {
      loads()[0].opts.onStartNewTrack({ index: 1, isPlaying: true, currentTime: 0, duration: 300 });
    });
    await waitFor(() => expect(result.current.playingSlot?.id).toBe("me-and-my-uncle"));
    await act(async () => { answer(); });
    await pastThrottle();
    expect(loads()).toHaveLength(1);
    expect(everyLoadedUrl()).not.toContain(JACK_ON(0));
    expect(reports()).toHaveLength(0);
    expect(result.current.playbackOops).toBeNull();
    expect(result.current.transport.isLoading).toBe(false);
  });

  it("a new tap on the same slot, still reading its tape, owns the player", async () => {
    // Same slot id, so only the tap counter can tell the answer is stale.
    const { result } = await play(JACK);
    const answer = holdMetadata();
    await act(async () => { fails(loads()[0]); });
    let read: (v: { url: string | null; unreachable: boolean }) => void = () => undefined;
    vi.mocked(findTrackInRecordingDetailed).mockImplementationOnce(() => new Promise((r) => { read = r; }));
    await act(async () => { void result.current.playSingle({ ...JACK, directTrackUrl: null }); });
    await act(async () => { answer(); });
    await pastThrottle();
    expect(everyLoadedUrl()).not.toContain(JACK_ON(0));
    expect(loads()).toHaveLength(1);
    await act(async () => { read({ url: JACK.directTrackUrl!, unreachable: false }); });
    await waitFor(() => expect(loads()).toHaveLength(2));
    expect(firstTrackOf(loads()[1])).toBe(JACK.directTrackUrl);
    expect(everyLoadedUrl()).not.toContain(JACK_ON(0));
    expect(reports()).toHaveLength(0);
  });

  it("Next then Previous comes back to the same slot, on a queue rebuilt from the Archive's own routing", async () => {
    // Same slot, no tap: only the queue generation can tell.
    const { result } = await play(JACK, [JACK, UNCLE]);
    const answer = holdMetadata();
    await act(async () => { fails(loads()[0]); });
    await act(async () => { await result.current.advancePlaylist(1); });
    await waitFor(() => expect(firstTrackOf(loads()[loads().length - 1])).toBe(UNCLE.directTrackUrl));
    await act(async () => { await result.current.advancePlaylist(-1); });
    await waitFor(() => expect(firstTrackOf(loads()[loads().length - 1])).toBe(JACK.directTrackUrl));
    expect(result.current.playingSlot?.id).toBe("jack-straw");
    const settled = loads().length;
    await act(async () => { answer(); });
    await pastThrottle();
    expect(loads()).toHaveLength(settled);
    expect(everyLoadedUrl()).not.toContain(JACK_ON(0));
    expect(reports()).toHaveLength(0);
  });

  it("a re-tap that is already playing is not shown as busy while the old lookup hangs", async () => {
    const { result } = await play(JACK);
    const answer = holdMetadata();
    await act(async () => { fails(loads()[0]); });
    expect(result.current.transport.isLoading).toBe(true);
    await act(async () => { await result.current.playSingle(JACK); });
    await waitFor(() => expect(loads()).toHaveLength(2));
    expect(result.current.transport.isLoading).toBe(false);
    await act(async () => { answer(); });
    await pastThrottle();
    expect(everyLoadedUrl()).not.toContain(JACK_ON(0));
  });

  it("Play All pressed while the old lookup hangs is not shown as busy either", async () => {
    const { result } = await play(JACK);
    const answer = holdMetadata();
    await act(async () => { fails(loads()[0]); });
    expect(result.current.transport.isLoading).toBe(true);
    // No wait on a reload: under act() Play All's null and its start slot
    // batch into one render, so the anchor effect sees the same slot and does
    // not run. A click flushes the null first. The busy state is the claim.
    await act(async () => { await result.current.playSetlist([JACK]); });
    await waitFor(() => expect(result.current.playingSlot?.id).toBe("jack-straw"));
    expect(result.current.transport.isLoading).toBe(false);
    await act(async () => { answer(); });
    await pastThrottle();
    expect(everyLoadedUrl()).not.toContain(JACK_ON(0));
  });

  it("closing the bar while the servers are looked up", async () => {
    const { result } = await play(JACK);
    const answer = holdMetadata();
    await act(async () => { fails(loads()[0]); });
    await act(async () => { result.current.stopPlayback(); });
    await act(async () => { answer(); });
    await pastThrottle();
    expect(everyLoadedUrl()).not.toContain(JACK_ON(0));
    expect(reports()).toHaveLength(0);
    expect(result.current.playingSlot).toBeNull();
  });
});

/**
 * One dead track reports twice: the element's error event, then the play()
 * rejection after it. With the servers not yet known, a network round trip
 * sits between the failover and that second report, so both carry the same
 * key and the second is an echo. Once the servers are cached, the lookup
 * answers in microtasks, and the failover has already put the next server on
 * when the rejection lands. It then read as that server failing: server 0 was
 * skipped, and a one-server item filed wont_play over a healthy server. In a
 * real Chrome, 5 of 6 second taps went silent and 3 of 3 one-server second
 * taps filed (2026-11-02 gate on PR #138). Every test before these fired both
 * reports in one synchronous burst, which is only the cold case.
 */
const microtaskCheckpoint = async () => { for (let i = 0; i < 50; i++) await Promise.resolve(); };
const ECHO = "NotSupportedError: The element has no supported sources.";
/** The element's error, then the play() rejection, with the microtasks between them run. */
const failsWithEcho = async (q: FakeQueueT) => {
  fails(q);
  await microtaskCheckpoint();
  fails(q, ECHO);
};

describe("a failure said twice, when the item's servers are already known", () => {
  it("a second tap on the same song goes to the first server, not past it", async () => {
    const { result } = await play(JACK);
    await act(async () => { fails(loads()[0]); });
    await waitFor(() => expect(loads()).toHaveLength(2)); // the servers are cached now
    await act(async () => { await result.current.playSingle(JACK); });
    await waitFor(() => expect(loads()).toHaveLength(3));
    expect(firstTrackOf(loads()[2])).toBe(JACK.directTrackUrl);
    await act(async () => { await failsWithEcho(loads()[2]); });
    await pastThrottle();
    expect(loads()).toHaveLength(4);
    expect(firstTrackOf(loads()[3])).toBe(JACK_ON(0));
    expect(events("audio_failover")).toHaveLength(2);
    expect(reports()).toHaveLength(0);
    expect(result.current.transport.error).toBeNull();
  });

  it("a one-server item plays from its server on the second tap, and nothing is filed", async () => {
    fetchMock.mockImplementation(async () => ok({ ...META, workable_servers: ["ia600906.us.archive.org"], d1: undefined, d2: undefined }));
    const { result } = await play(JACK);
    await act(async () => { fails(loads()[0]); });
    await waitFor(() => expect(loads()).toHaveLength(2));
    await act(async () => { await result.current.playSingle(JACK); });
    await waitFor(() => expect(loads()).toHaveLength(3));
    await act(async () => { await failsWithEcho(loads()[2]); });
    await pastThrottle();
    expect(firstTrackOf(loads()[3])).toBe(JACK_ON(0));
    expect(reports()).toHaveLength(0);
    expect(events("audio_error")).toHaveLength(0);
    expect(result.current.transport.error).toBeNull();
    expect(result.current.playbackOops).toBeNull();
  });

  it("a first server that is itself dead still gives the second its turn", async () => {
    const { result } = await play(JACK);
    await act(async () => { fails(loads()[0]); });
    await waitFor(() => expect(loads()).toHaveLength(2)); // on server 0, servers cached
    await act(async () => { await failsWithEcho(loads()[1]); });
    await pastThrottle();
    expect(loads()).toHaveLength(3);
    expect(firstTrackOf(loads()[2])).toBe(JACK_ON(1));
    expect(reports()).toHaveLength(0);
    expect(result.current.transport.error).toBeNull();
  });

  it("a real failure of the server just put on is still a failure", async () => {
    // Reports are dropped from the queue a failover replaced, never from the
    // one it loaded.
    const { result } = await play(JACK);
    await act(async () => { await failsWithEcho(loads()[0]); });
    await waitFor(() => expect(loads()).toHaveLength(2));
    await act(async () => { await failsWithEcho(loads()[1]); });
    await waitFor(() => expect(loads()).toHaveLength(3));
    await act(async () => { await failsWithEcho(loads()[2]); });
    await waitFor(() => expect(reports()).toHaveLength(1));
    await pastThrottle();
    expect(reports()).toHaveLength(1);
    expect(loads()).toHaveLength(3);
    await waitFor(() => expect(result.current.transport.error).toBe(WONT_PLAY));
  });
});

describe("where a failover resumes, and what it leaves alone", () => {
  it("a fresh tap on a song already heard starts at the top, not where the last play reached", async () => {
    // lastProgressRef was only ever overwritten by a tick, so a re-tap whose
    // redirect died before its first tick resumed at the old play's position.
    const { result } = await play(JACK);
    await pastThrottle();
    await act(async () => { progress(loads()[0], 300); });
    await act(async () => { await result.current.playSingle(JACK); });
    await waitFor(() => expect(loads()).toHaveLength(2));
    await act(async () => { fails(loads()[1]); });
    await waitFor(() => expect(loads()).toHaveLength(3));
    expect(firstTrackOf(loads()[2])).toBe(JACK_ON(0));
    expect(loads()[2].seek).not.toHaveBeenCalled();
  });

  it("Next pressed while the servers are looked up: the song being left is not restarted", async () => {
    const UNRESOLVED_UNCLE: PlayableSlot = { ...UNCLE, directTrackUrl: null };
    const { result } = await play(JACK, [JACK, UNRESOLVED_UNCLE]);
    const pending: Array<(v: { url: string | null; unreachable: boolean }) => void> = [];
    vi.mocked(findTrackInRecordingDetailed).mockImplementation(() => new Promise((r) => { pending.push(r); }));
    const answer = holdMetadata();
    await act(async () => { fails(loads()[0]); });
    // Next waits on song 2's tape: the player has not moved yet, but the fan has.
    await act(async () => { void result.current.advancePlaylist(1); });
    await waitFor(() => expect(pending.length).toBeGreaterThan(0));
    await act(async () => { answer(); });
    await pastThrottle();
    expect(everyLoadedUrl()).not.toContain(JACK_ON(0));
    await act(async () => { pending.forEach((r) => r({ url: UNCLE.directTrackUrl!, unreachable: false })); });
    await waitFor(() => expect(result.current.playingSlot?.id).toBe("me-and-my-uncle"));
    await waitFor(() => expect(firstTrackOf(loads()[loads().length - 1])).toBe(UNCLE.directTrackUrl));
    expect(everyLoadedUrl()).not.toContain(JACK_ON(0));
    expect(reports()).toHaveLength(0);
  });

  it("the rest of the set is queued once behind the server, not by the old queue's loop as well", async () => {
    const pending: Array<(v: { url: string | null; unreachable: boolean }) => void> = [];
    vi.mocked(findTrackInRecordingDetailed).mockImplementation(() => new Promise((r) => { pending.push(r); }));
    const UNRESOLVED_UNCLE: PlayableSlot = { ...UNCLE, directTrackUrl: null };
    const { result } = await play(JACK, [JACK, UNRESOLVED_UNCLE]);
    await waitFor(() => expect(pending.length).toBe(1)); // the anchor's loop is reading song 2
    await act(async () => { fails(loads()[0]); });
    await waitFor(() => expect(loads()).toHaveLength(2));
    await waitFor(() => expect(pending.length).toBe(2)); // the failover's loop reads it too
    await act(async () => { pending.forEach((r) => r({ url: UNCLE.directTrackUrl!, unreachable: false })); });
    await pastThrottle();
    expect(loads()[1].addTrack.mock.calls.filter((c) => c[0] === UNCLE.directTrackUrl)).toHaveLength(1);
    expect(result.current.playingSlot?.id).toBe("jack-straw");
  });

  it("a track not on a /download/ address is not failed over: it is dead at once, and nothing is asked", async () => {
    const DIRECT: PlayableSlot = { ...JACK, directTrackUrl: JACK_ON(1) };
    const { result } = await play(DIRECT);
    await act(async () => { fails(loads()[0]); });
    await waitFor(() => expect(reports()).toHaveLength(1));
    await waitFor(() => expect(result.current.transport.error).toBe(WONT_PLAY));
    expect(metadataCalls()).toHaveLength(0);
    expect(loads()).toHaveLength(1);
  });
});
