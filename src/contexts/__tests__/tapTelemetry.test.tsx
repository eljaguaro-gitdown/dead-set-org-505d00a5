import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

/**
 * The player's half of the tap contract, driven through the provider: a tap
 * sends play_requested from the handler, and every way a tap can die settles
 * it as play_failed with the leg it died on. Sound itself is the engine's
 * progress tick, covered on the gapless path in tapTelemetryGapless.test.
 */
const mocks = vi.hoisted(() => ({ error: vi.fn(), info: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: mocks.error, info: mocks.info, success: mocks.success } }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
    auth: { getUser: async () => ({ data: { user: null } }) },
    rpc: async () => ({ data: null, error: null }),
  },
}));
vi.mock("@/lib/player/engineFlag", () => ({ resolvePlayerEngine: () => "legacy" }));

import { AudioPlayerProvider, useAudioPlayer, type PlayableSlot } from "@/contexts/AudioPlayerContext";
import { resetTaps, type TapRecord } from "@/lib/player/tapTelemetry";

const stored = (id: string, identifier: string): PlayableSlot => ({
  id,
  song: { id: `song-${id}`, title: "Althea" },
  version: {
    id: `v-${id}`, song_id: `song-${id}`, show_date: "1980-05-08",
    archive_org_url: `https://archive.org/details/${identifier}`,
    venue: null, city: null, era_id: null, rating: null, description: null,
  } as PlayableSlot["version"],
  directTrackUrl: null,
  setNumber: 1, position: 0, segueToNext: false,
});
const NIGHT_ONLY: PlayableSlot = {
  ...stored("n", "x"),
  id: "n",
  version: { ...stored("n", "x").version, archive_org_url: null } as PlayableSlot["version"],
};
const READY: PlayableSlot = { ...stored("r", "gd-r"), id: "r", directTrackUrl: "https://archive.org/download/gd-r/Althea.mp3" };

const json = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as unknown as Response;
const NO_ALTHEA = { files: [{ name: "Bertha.mp3", format: "VBR MP3" }], metadata: {} };
const EMPTY_SEARCH = { response: { docs: [] } };

const seen: TapRecord[] = [];
const listen = (e: Event) => seen.push((e as CustomEvent<TapRecord>).detail);

const Harness = () => {
  const { playSingle, playSetlist, stopPlayback, transport } = useAudioPlayer();
  return (
    <>
      <button onClick={() => void playSingle(stored("a", "gd-a"))}>storedTap</button>
      <button onClick={() => void playSingle(NIGHT_ONLY)}>nightTap</button>
      <button onClick={() => void playSingle(READY)}>readyTap</button>
      <button onClick={() => void playSetlist([stored("a", "gd-a"), stored("b", "gd-b")], "set-1")}>playAll</button>
      <button onClick={() => stopPlayback()}>stop</button>
      <button onClick={() => transport.next()}>next</button>
      <div data-testid="err">{transport.error ?? ""}</div>
    </>
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  seen.length = 0;
  resetTaps();
  window.addEventListener("deadset:tap", listen);
  vi.stubGlobal("fetch", vi.fn());
  window.history.replaceState({}, "", "/setlist/abc");
});
afterEach(() => {
  window.removeEventListener("deadset:tap", listen);
  vi.unstubAllGlobals();
});

const events = () => seen.map((r) => r.event);
const last = () => seen[seen.length - 1];

describe("the player's half of the tap contract", () => {
  it("a tap on a stored tape that lacks the song: requested, then failed at match", async () => {
    vi.mocked(fetch).mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes("/metadata/")) return json(NO_ALTHEA);
      return json(EMPTY_SEARCH); // the heal finds no other tape of the night
    });
    render(<AudioPlayerProvider><Harness /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("storedTap"));
    expect(seen[0]).toMatchObject({ event: "play_requested", surface: "setlist_poster", song_id: "song-a", show_date: "1980-05-08", has_precomputed: false });
    await waitFor(() => expect(events()).toEqual(["play_requested", "play_failed"]));
    expect(last()).toMatchObject({ kind: "not_on_tape", stage: "match" });
    expect(last().tap_id).toBe(seen[0].tap_id);
  });

  it("a 503 on the tape is failed as unreachable at metadata, not as not-on-tape", async () => {
    // The stored tape 503s (after its retry); the night search answers and
    // has nothing. The verdict is about the tape that could not be read.
    vi.mocked(fetch).mockImplementation(async (url) =>
      String(url).includes("/metadata/") ? json({}, 503) : json(EMPTY_SEARCH),
    );
    render(<AudioPlayerProvider><Harness /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("storedTap"));
    await waitFor(() => expect(events()).toEqual(["play_requested", "play_failed"]), { timeout: 5000 });
    expect(last()).toMatchObject({ kind: "unreachable", stage: "metadata" });
  });

  it("a night with no tape at all is failed as no_tape at lookup", async () => {
    vi.mocked(fetch).mockResolvedValue(json(EMPTY_SEARCH));
    render(<AudioPlayerProvider><Harness /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("nightTap"));
    await waitFor(() => expect(events()).toEqual(["play_requested", "play_failed"]));
    expect(last()).toMatchObject({ kind: "no_tape", stage: "lookup" });
  });

  it("a tap with the track in hand reports has_precomputed and goes straight to redirect", async () => {
    render(<AudioPlayerProvider><Harness /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("readyTap"));
    expect(seen[0]).toMatchObject({ event: "play_requested", has_precomputed: true });
    // Nothing fails it: no fetch, no error. Stopping is the only way it ends here.
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("stop"));
    expect(last()).toMatchObject({ event: "play_failed", kind: "stopped", stage: "redirect" });
  });

  it("Play All that finds nothing is failed once, as none_in_setlist", async () => {
    vi.mocked(fetch).mockImplementation(async (url) =>
      String(url).includes("/metadata/") ? json(NO_ALTHEA) : json(EMPTY_SEARCH),
    );
    render(<AudioPlayerProvider><Harness /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("playAll"));
    await waitFor(() => expect(events()).toEqual(["play_requested", "play_failed"]));
    expect(last()).toMatchObject({ kind: "none_in_setlist" });
  });

  it("a second tap while the first is resolving supersedes it — one answer each", async () => {
    vi.mocked(fetch).mockImplementation(() => new Promise<Response>(() => {}));
    render(<AudioPlayerProvider><Harness /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("storedTap"));
    fireEvent.click(screen.getByText("nightTap"));
    // The player settles the old tap before it mints the new one.
    expect(events()).toEqual(["play_requested", "play_failed", "play_requested"]);
    expect(seen[1]).toMatchObject({ kind: "superseded", tap_id: seen[0].tap_id });
    expect(seen[2].tap_id).not.toBe(seen[0].tap_id);
  });

  it("Next pressed while a tap is still waiting settles it as superseded", async () => {
    vi.mocked(fetch).mockImplementation(() => new Promise<Response>(() => {}));
    render(<AudioPlayerProvider><Harness /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("storedTap"));
    fireEvent.click(screen.getByText("next"));
    await waitFor(() => expect(events()).toContain("play_failed"));
    expect(seen.filter((r) => r.event === "play_failed")).toHaveLength(1);
    expect(last()).toMatchObject({ kind: "superseded" });
  });
});
