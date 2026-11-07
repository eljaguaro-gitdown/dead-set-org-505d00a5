import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

/**
 * Plan B through the real player: a tap that cannot make a sound starts a
 * version of the SAME song we know plays, says so, and still files the night
 * that failed. Database and Archive are fakes that answer like the real ones
 * (the query builder filters, so a wrong .eq() would show).
 */
class FakeAudioContext { state = "running"; resume = vi.fn(async () => undefined); close = vi.fn(async () => undefined); }
vi.stubGlobal("AudioContext", FakeAudioContext);
const { queues } = vi.hoisted(() => ({ queues: [] as Array<{ opts: Record<string, (x?: unknown) => void>; added: string[] }> }));
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

const db = vi.hoisted(() => ({
  tables: {} as Record<string, Array<Record<string, unknown>>>,
  verified: null as null | Record<string, unknown>,
  rpc: [] as Array<[string, Record<string, unknown>]>,
  /** How long the sure-thing lookup takes; on a phone it is not instant. */
  sureDelayMs: 0,
}));
vi.mock("@/integrations/supabase/client", () => {
  const builder = (table: string) => {
    const filters: Array<(r: Record<string, unknown>) => boolean> = [];
    let lim = Infinity;
    const result = () => (db.tables[table] ?? []).filter((r) => filters.every((f) => f(r))).slice(0, lim);
    const q: Record<string, unknown> = {
      select: () => q, order: () => q, in: () => q,
      eq: (c: string, v: unknown) => { filters.push((r) => r[c] === v); return q; },
      limit: (n: number) => { lim = n; return q; },
      maybeSingle: async () => ({ data: result()[0] ?? null, error: null }),
      then: (res: (v: unknown) => void) => Promise.resolve({ data: result(), error: null }).then(res),
    };
    return q;
  };
  return {
    supabase: {
      from: (t: string) => builder(t),
      rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
        db.rpc.push([fn, args]);
        if (fn === "suggest_known_good_tape") {
          if (db.sureDelayMs) await new Promise((r) => setTimeout(r, db.sureDelayMs));
          return { data: db.verified ? [db.verified] : [], error: null };
        }
        if (fn === "report_playback_issue") return { data: "11111111-0000-4000-8000-000000000000", error: null };
        return { data: null, error: null };
      }),
      auth: { getUser: async () => ({ data: { user: null } }) },
    },
  };
});

import { AudioPlayerProvider, useAudioPlayer, type PlayableSlot } from "@/contexts/AudioPlayerContext";
import { SYNTHETIC_VERSION_DEFAULTS } from "@/lib/syntheticVersion";
import { resetTapeIndex } from "@/lib/tapeIndex";
import { resetSureThings, PLAN_B_AFTER_MS, SILENCE_LIMIT_MS } from "@/lib/player/planB";
import { resetArchiveMirrors } from "@/lib/archiveOrg";
import { beginTap, resetTaps, type TapRecord } from "@/lib/player/tapTelemetry";

const SONG = "11111111-1111-4111-8111-111111111111";
const OTHER_SONG = "22222222-2222-4222-8222-222222222222";
const SURE_TRACK = "https://archive.org/download/gd72-08-27/d1t09.mp3";
const night = (date: string): PlayableSlot => ({
  id: `n-${date}`, song: { id: SONG, title: "Bertha" },
  version: { ...SYNTHETIC_VERSION_DEFAULTS, id: "v", song_id: SONG, show_date: date, archive_org_url: null },
  directTrackUrl: null, setNumber: 1, position: 0, segueToNext: false,
});
const indexRow = (o: Record<string, unknown>) => ({
  song_id: SONG, show_date: "1972-08-27", identifier: "gd72-08-27", status: "playable", is_default: true, is_song_default: true,
  track_url: SURE_TRACK, servers: ["https://ia801908.us.archive.org/25/items/gd72-08-27"], verified_at: "2026-11-07", ...o,
});

const hang = () => new Promise<Response>(() => undefined);
const fetchSpy = vi.fn((url: string) => (String(url).includes("archive.org") ? hang() : Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as Response)));

let ctx: ReturnType<typeof useAudioPlayer>;
const Harness = ({ slot }: { slot: PlayableSlot }) => {
  ctx = useAudioPlayer();
  return (
    <>
      <button onClick={() => void ctx.playSingle(slot)}>tap</button>
      <div data-testid="planb">{ctx.planB ? `${ctx.planB.reason}|${ctx.planB.sureDate}|${ctx.planB.failedDate}` : ""}</div>
      <div data-testid="oops">{ctx.playbackOops?.kind ?? ""}</div>
    </>
  );
};
const seen: TapRecord[] = [];
const listen = (e: Event) => seen.push((e as CustomEvent<TapRecord>).detail);

beforeEach(() => {
  queues.length = 0; seen.length = 0; db.rpc = []; db.verified = null; db.sureDelayMs = 0;
  db.tables = { tape_index: [indexRow({}), indexRow({ show_date: "1983-10-06", identifier: "", status: "no_tape", is_song_default: false, track_url: null, servers: [] })] };
  resetTapeIndex(); resetArchiveMirrors(); resetTaps(); resetSureThings();
  window.addEventListener("deadset:tap", listen);
  fetchSpy.mockClear(); vi.stubGlobal("fetch", fetchSpy);
  try { localStorage.removeItem("plan_b"); } catch { /* */ }
});
afterEach(() => { window.removeEventListener("deadset:tap", listen); vi.useRealTimers(); vi.unstubAllGlobals(); vi.stubGlobal("AudioContext", FakeAudioContext); });

const engineUrls = () => queues.map((q) => q.added).flat();
const reports = () => db.rpc.filter(([fn]) => fn === "report_playback_issue").map(([, a]) => a);

describe("Plan B", () => {
  it("a night with no tape starts a sure thing of the same song, says which, and files the night", async () => {
    render(<AudioPlayerProvider><Harness slot={night("1983-10-06")} /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("tap"));
    await waitFor(() => expect(screen.getByTestId("planb").textContent).toBe("no_tape|1972-08-27|1983-10-06"));
    await waitFor(() => expect(engineUrls()).toContain("https://ia801908.us.archive.org/25/items/gd72-08-27/d1t09.mp3"));
    expect(screen.getByTestId("oops").textContent).toBe(""); // Plan B, not the apology card
    await waitFor(() => expect(reports()).toHaveLength(1));
    expect(reports()[0]).toEqual(expect.objectContaining({ p_kind: "no_tape", p_show_date: "1983-10-06", p_notify: true }));
    // The original tap failed; Plan B is its own tap, from its own surface.
    expect(seen.filter((r) => r.event === "play_requested").map((r) => r.surface)).toEqual(["landing_hero", "plan_b"]);
  });

  it("prefers a tape that has really played for fans, and never another song's", async () => {
    db.verified = { song_id: OTHER_SONG, song_title: "Althea", show_date: "1980-05-16", archive_url: null, track_url: "https://archive.org/download/x/althea.mp3" };
    render(<AudioPlayerProvider><Harness slot={night("1983-10-06")} /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("tap"));
    // Another song's verified tape is passed over for this song's indexed one.
    await waitFor(() => expect(engineUrls().some((u) => u.endsWith("d1t09.mp3"))).toBe(true));
    expect(engineUrls().some((u) => u.includes("althea"))).toBe(false);
  });

  it("uses the same song's verified tape first", async () => {
    db.verified = { song_id: SONG, song_title: "Bertha", show_date: "1971-02-18", archive_url: null, track_url: "https://archive.org/download/gd71/bertha.mp3" };
    render(<AudioPlayerProvider><Harness slot={night("1983-10-06")} /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("tap"));
    await waitFor(() => expect(engineUrls()).toContain("https://archive.org/download/gd71/bertha.mp3"));
    expect(screen.getByTestId("planb").textContent).toBe("no_tape|1971-02-18|1983-10-06");
  });

  it("with nothing known to play, the apology card as before", async () => {
    db.tables.tape_index = db.tables.tape_index.filter((r) => r.status !== "playable");
    render(<AudioPlayerProvider><Harness slot={night("1983-10-06")} /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("tap"));
    await waitFor(() => expect(screen.getByTestId("oops").textContent).toBe("no_tape"));
    expect(screen.getByTestId("planb").textContent).toBe("");
  });

  it("switched off (plan_b=off), the apology card as before", async () => {
    localStorage.setItem("plan_b", "off");
    render(<AudioPlayerProvider><Harness slot={night("1983-10-06")} /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("tap"));
    await waitFor(() => expect(screen.getByTestId("oops").textContent).toBe("no_tape"));
    expect(screen.getByTestId("planb").textContent).toBe("");
  });

  it("eight seconds of silence is the ceiling: the tap times out and Plan B is on screen BEFORE 8 s", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    db.sureDelayMs = 1_000; // a lookup started AT the ceiling would land past 8 s
    render(<AudioPlayerProvider><Harness slot={night("1977-05-09")} /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("tap"));
    await vi.advanceTimersByTimeAsync(PLAN_B_AFTER_MS - 10);
    expect(screen.getByTestId("planb").textContent).toBe("");
    // The sure thing was looked up while the tap was still silent...
    expect(db.rpc.filter(([fn]) => fn === "suggest_known_good_tape").length).toBe(1);
    // ...so at the ceiling the answer lands at once, inside the 8 s limit.
    await vi.advanceTimersByTimeAsync(SILENCE_LIMIT_MS - PLAN_B_AFTER_MS - 10);
    expect(screen.getByTestId("planb").textContent).toBe("slow|1972-08-27|1977-05-09");
    expect(seen.find((r) => r.event === "play_failed")).toEqual(expect.objectContaining({ kind: "timeout" }));
    expect(reports()).toEqual([]); // slow is the network, not something to fix: nothing filed
  });

  it("a surface's own lookup that outlasts the ceiling is handed off too — and its late answer cannot cut Plan B off", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<AudioPlayerProvider><Harness slot={night("1977-05-09")} /></AudioPlayerProvider>);
    // The version picker begins the tap, then looks the night up itself.
    act(() => { beginTap("version_picker", { songId: SONG, title: "Bertha", showDate: "1977-05-09" }); });
    await vi.advanceTimersByTimeAsync(8_200);
    await waitFor(() => expect(screen.getByTestId("planb").textContent).toBe("slow|1972-08-27|1977-05-09"));
    const loadsBefore = queues.length;
    // ...and its answer arrives late, with no tap behind it.
    act(() => { void ctx.playSingle({ ...night("1977-05-09"), id: "late", directTrackUrl: "https://archive.org/download/late/x.mp3", version: { ...night("1977-05-09").version!, archive_org_url: "https://archive.org/details/late" } }); });
    await vi.advanceTimersByTimeAsync(50);
    expect(queues.length).toBe(loadsBefore);
    expect(screen.getByTestId("planb").textContent).toBe("slow|1972-08-27|1977-05-09");
  });

  it("never offers the night that just failed, even when it is the song's best indexed tape", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // The tapped night is indexed and is the song's own best answer — but it
    // will not make a sound. Plan B must reach past it.
    db.tables.tape_index = [
      indexRow({ show_date: "1977-05-09", identifier: "gd77-05-09", is_song_default: true, track_url: "https://archive.org/download/gd77-05-09/t.mp3", servers: [] }),
      indexRow({ is_song_default: false }),
    ];
    render(<AudioPlayerProvider><Harness slot={night("1977-05-09")} /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("tap"));
    await waitFor(() => expect(engineUrls()).toContain("https://archive.org/download/gd77-05-09/t.mp3"));
    await vi.advanceTimersByTimeAsync(8_500); // no sound: the ceiling
    await waitFor(() => expect(screen.getByTestId("planb").textContent).toBe("slow|1972-08-27|1977-05-09"));
  });

  it("a fan's own new tap still takes over from Plan B", async () => {
    render(<AudioPlayerProvider><Harness slot={night("1983-10-06")} /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("tap"));
    await waitFor(() => expect(screen.getByTestId("planb").textContent).not.toBe(""));
    fireEvent.pointerDown(screen.getByText("tap"));
    fireEvent.click(screen.getByText("tap"));
    await waitFor(() => expect(screen.getByTestId("planb").textContent).toBe("no_tape|1972-08-27|1983-10-06"));
  });
});
