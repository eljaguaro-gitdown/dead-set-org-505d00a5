import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

/**
 * The tape index through the player itself: a tap on an indexed night goes to
 * the engine as the ITEM'S OWN SERVER address with no Archive request at all;
 * a night the index knows has no tape fails at once; and a direct stream that
 * dies falls over to the item's other servers, then to the redirect.
 */
class FakeAudioContext { state = "running"; resume = vi.fn(async () => undefined); close = vi.fn(async () => undefined); }
vi.stubGlobal("AudioContext", FakeAudioContext);

const { queues } = vi.hoisted(() => ({ queues: [] as Array<{ opts: Record<string, (x?: unknown) => void>; added: string[] }> }));
vi.mock("gapless", () => {
  class FakeQueue {
    opts: Record<string, (x?: unknown) => void>;
    added: string[] = [];
    constructor(opts: Record<string, (x?: unknown) => void>) { this.opts = opts; queues.push(this); }
    addTrack = vi.fn((url: string) => { this.added.push(url); });
    gotoTrack = vi.fn(); play = vi.fn(); pause = vi.fn(); next = vi.fn(); previous = vi.fn(); seek = vi.fn(); setVolume = vi.fn(); destroy = vi.fn();
    resumeAudioContext = vi.fn(async () => undefined);
    currentTrackIndex = 0; isPlaying = false;
  }
  return { default: FakeQueue, Queue: FakeQueue };
});
vi.mock("@/lib/playEventTracker", () => ({
  startPlayEvent: vi.fn(async () => undefined), finalizePlayEvent: vi.fn(async () => undefined),
  pausePlayEvent: vi.fn(), resumePlayEvent: vi.fn(), setPlayEventTrackDuration: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const db = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>> }));
vi.mock("@/integrations/supabase/client", () => {
  const builder = (table: string) => {
    const filters: Array<(r: Record<string, unknown>) => boolean> = [];
    const result = () => (table === "tape_index" ? db.rows.filter((r) => filters.every((f) => f(r))) : []);
    const q: Record<string, unknown> = {
      select: () => q,
      eq: (c: string, v: unknown) => { filters.push((r) => r[c] === v); return q; },
      in: () => q,
      limit: () => q,
      maybeSingle: async () => ({ data: result()[0] ?? null, error: null }),
      then: (res: (v: unknown) => void) => Promise.resolve({ data: result(), error: null }).then(res),
    };
    return q;
  };
  return { supabase: { from: (t: string) => builder(t), rpc: vi.fn(async () => ({ data: null, error: null })), auth: { getUser: async () => ({ data: { user: null } }) } } };
});

import { AudioPlayerProvider, useAudioPlayer, type PlayableSlot } from "@/contexts/AudioPlayerContext";
import { SYNTHETIC_VERSION_DEFAULTS } from "@/lib/syntheticVersion";
import { resetTapeIndex } from "@/lib/tapeIndex";
import { resetArchiveMirrors } from "@/lib/archiveOrg";

const S = "11111111-1111-4111-8111-111111111111";
const TRACK = "https://archive.org/download/gd71/t01.mp3";
const ROOTS = ["https://ia800107.us.archive.org/1/items/gd71", "https://ia600107.us.archive.org/1/items/gd71"];
const night = (date: string): PlayableSlot => ({
  id: `n-${date}`,
  song: { id: S, title: "Bertha" },
  version: { ...SYNTHETIC_VERSION_DEFAULTS, id: "v", song_id: S, show_date: date, archive_org_url: null },
  directTrackUrl: null, setNumber: 1, position: 0, segueToNext: false,
});

const fetchSpy = vi.fn(async (url: string) => {
  // An Archive search would answer "nothing" — the tests below assert it is never asked.
  if (String(url).includes("archive.org")) return { ok: true, status: 200, json: async () => ({ response: { docs: [] } }) } as unknown as Response;
  return { ok: true, status: 200, json: async () => ({}) } as unknown as Response;
});

const Harness = ({ slot }: { slot: PlayableSlot }) => {
  const { playSingle, transport, playbackOops } = useAudioPlayer();
  return (
    <>
      <button onClick={() => void playSingle(slot)}>tap</button>
      <div data-testid="err">{transport.error ?? ""}</div>
      <div data-testid="oops">{playbackOops?.kind ?? ""}</div>
    </>
  );
};

beforeEach(() => {
  queues.length = 0; resetTapeIndex(); resetArchiveMirrors(); fetchSpy.mockClear();
  vi.stubGlobal("fetch", fetchSpy);
  db.rows = [
    { song_id: S, show_date: "1971-02-18", identifier: "gd71", status: "playable", is_default: true, is_song_default: false, track_url: TRACK, servers: ROOTS, file_name: "t01.mp3", duration_s: 300 },
    { song_id: S, show_date: "1983-10-06", identifier: "", status: "no_tape", is_default: true, is_song_default: false, track_url: null, servers: [], file_name: null, duration_s: null },
  ];
});
afterEach(() => { vi.unstubAllGlobals(); vi.stubGlobal("AudioContext", FakeAudioContext); });

const archiveCalls = () => fetchSpy.mock.calls.map((c) => String(c[0])).filter((u) => u.includes("archive.org"));

describe("a tap on an indexed night", () => {
  it("reaches the engine as the item's own server address, with no Archive request", async () => {
    render(<AudioPlayerProvider><Harness slot={night("1971-02-18")} /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("tap"));
    await waitFor(() => expect(queues.at(-1)?.added).toEqual([`${ROOTS[0]}/t01.mp3`]));
    expect(archiveCalls()).toEqual([]);
  });

  it("a night the index knows has no tape fails at once — the card, no Archive request", async () => {
    render(<AudioPlayerProvider><Harness slot={night("1983-10-06")} /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("tap"));
    await waitFor(() => expect(screen.getByTestId("oops").textContent).toBe("no_tape"));
    expect(archiveCalls()).toEqual([]);
  });

  it("a direct stream that dies tries the item's other server, then the Archive's own redirect", async () => {
    render(<AudioPlayerProvider><Harness slot={night("1971-02-18")} /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("tap"));
    await waitFor(() => expect(queues.at(-1)?.added).toEqual([`${ROOTS[0]}/t01.mp3`]));
    act(() => queues.at(-1)!.opts.onError(new Error("HTML5 audio error on track 0 (code 4)")));
    await waitFor(() => expect(queues.at(-1)?.added).toEqual([`${ROOTS[1]}/t01.mp3`]));
    act(() => queues.at(-1)!.opts.onError(new Error("HTML5 audio error on track 0 (code 4)")));
    await waitFor(() => expect(queues.at(-1)?.added).toEqual([TRACK]));
    // Servers came from the index: failover read no metadata.
    expect(archiveCalls()).toEqual([]);
  });
});
