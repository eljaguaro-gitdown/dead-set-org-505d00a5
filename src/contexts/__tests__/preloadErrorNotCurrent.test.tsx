import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

/**
 * A preloaded track failing must not fail the track that is playing.
 * 2026-11-06: Help on the Way played 34 s, then was failed over and filed
 * "won't play" while the queue moved on — consistent with the NEXT track's
 * preload hitting a broken mirror. gapless says which track an element error
 * came from; the engine now listens.
 */
class FakeAudioContext { state = "running"; resume = vi.fn(async () => undefined); close = vi.fn(async () => undefined); }
vi.stubGlobal("AudioContext", FakeAudioContext);
const { queues } = vi.hoisted(() => ({ queues: [] as Array<{ opts: Record<string, (x?: unknown) => void>; added: string[]; currentTrackIndex: number }> }));
vi.mock("gapless", () => {
  class FakeQueue {
    opts: Record<string, (x?: unknown) => void>; added: string[] = []; currentTrackIndex = 0; isPlaying = false;
    constructor(opts: Record<string, (x?: unknown) => void>) { this.opts = opts; queues.push(this); }
    addTrack = vi.fn((u: string) => { this.added.push(u); });
    gotoTrack = vi.fn(); play = vi.fn(); pause = vi.fn(); next = vi.fn(); previous = vi.fn(); seek = vi.fn(); setVolume = vi.fn(); destroy = vi.fn();
    resumeAudioContext = vi.fn(async () => undefined);
  }
  return { default: FakeQueue, Queue: FakeQueue };
});
vi.mock("@/lib/playEventTracker", () => ({ startPlayEvent: vi.fn(async () => undefined), finalizePlayEvent: vi.fn(async () => undefined), pausePlayEvent: vi.fn(), resumePlayEvent: vi.fn(), setPlayEventTrackDuration: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
const rpc = vi.hoisted(() => vi.fn(async (_fn: string, _args?: unknown) => ({ data: null, error: null })));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc,
    auth: { getUser: async () => ({ data: { user: null } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
  },
}));
vi.mock("@/lib/archiveOrg", async (orig) => ({
  ...(await orig<typeof import("@/lib/archiveOrg")>()),
  archiveMirrorUrls: vi.fn(async () => ({ urls: ["https://ia1.us.archive.org/1/items/x/b.mp3"], unreachable: false })),
}));

import { AudioPlayerProvider, useAudioPlayer, type PlayableSlot } from "@/contexts/AudioPlayerContext";
import { SYNTHETIC_VERSION_DEFAULTS } from "@/lib/syntheticVersion";

const slot = (id: string, title: string, pos: number): PlayableSlot => ({
  id, song: { id: `s-${id}`, title },
  version: { ...SYNTHETIC_VERSION_DEFAULTS, id, song_id: `s-${id}`, show_date: "1977-06-09", archive_org_url: "https://archive.org/details/x" },
  directTrackUrl: `https://archive.org/download/x/${id}.mp3`, setNumber: 2, position: pos, segueToNext: true,
});
const HELP = slot("help", "Help on the Way", 3);
const SLIP = slot("slip", "Slipknot!", 4);

const Harness = () => {
  const { playSingle, transport, playbackOops, playingSlot } = useAudioPlayer();
  return (
    <>
      <button onClick={() => void playSingle(HELP, { slots: [HELP, SLIP] })}>tap</button>
      <div data-testid="now">{playingSlot?.song.title ?? ""}</div>
      <div data-testid="err">{transport.error ?? ""}</div>
      <div data-testid="oops">{playbackOops?.kind ?? ""}</div>
    </>
  );
};

beforeEach(() => { queues.length = 0; rpc.mockClear(); });
afterEach(() => { vi.unstubAllGlobals(); vi.stubGlobal("AudioContext", FakeAudioContext); });

describe("a preload that fails", () => {
  it("does not fail over, file, or move off the track that is playing", async () => {
    render(<AudioPlayerProvider><Harness /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("tap"));
    await waitFor(() => expect(queues.at(-1)?.added.length).toBe(2)); // Help, then Slipknot! appended
    const q = queues.at(-1)!;
    const before = queues.length;
    q.currentTrackIndex = 0; // Help is playing
    act(() => q.opts.onError(new Error("HTML5 audio error on track 1 (code 4): MEDIA_ERR_SRC_NOT_SUPPORTED")));
    await new Promise((r) => setTimeout(r, 30));
    expect(queues.length).toBe(before); // no failover reload
    expect(screen.getByTestId("now").textContent).toBe("Help on the Way");
    expect(screen.getByTestId("err").textContent).toBe("");
    expect(screen.getByTestId("oops").textContent).toBe("");
    expect(rpc.mock.calls.filter((c) => c[0] === "report_playback_issue")).toEqual([]);
  });

  it("the control: the same error for the track that IS playing still fails over", async () => {
    render(<AudioPlayerProvider><Harness /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("tap"));
    await waitFor(() => expect(queues.at(-1)?.added.length).toBe(2));
    const q = queues.at(-1)!;
    const before = queues.length;
    act(() => q.opts.onError(new Error("HTML5 audio error on track 0 (code 4): MEDIA_ERR_SRC_NOT_SUPPORTED")));
    await waitFor(() => expect(queues.length).toBeGreaterThan(before));
    expect(queues.at(-1)!.added[0]).toBe("https://ia1.us.archive.org/1/items/x/b.mp3");
  });
});
