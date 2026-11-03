import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, screen, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

/**
 * The same failover on the legacy player, which still mounts for anyone with
 * localStorage.player_engine = "legacy" (the rollback lever). Its <audio>
 * element is its own, so it fails over itself: a failing /download/ address
 * moves to the item's own servers at the position it died, and only when they
 * are spent does the old retry-then-give-up run, once, and stop.
 */

const { mirrors, findTrack } = vi.hoisted(() => ({ mirrors: vi.fn(), findTrack: vi.fn() }));

vi.mock("@/lib/archiveOrg", () => ({
  archiveMirrorUrls: (...a: unknown[]) => mirrors(...a),
  findTrackInRecording: (...a: unknown[]) => findTrack(...a),
  matchScore: () => 0,
}));
vi.mock("@/lib/playEventTracker", () => ({
  startPlayEvent: vi.fn(async () => undefined),
  finalizePlayEvent: vi.fn(async () => undefined),
  pausePlayEvent: vi.fn(),
  resumePlayEvent: vi.fn(),
  setPlayEventTrackDuration: vi.fn(),
}));
vi.mock("@/lib/nativeApp", () => ({ isNativeApp: () => false }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import AudioPlayer from "@/components/AudioPlayer";

const ID = "gd71-10-19.orefm.clugston.3301.sbeok.shnf";
const FILE = "gd71-10-19d1t09.mp3";
const TRACK = `https://archive.org/download/${ID}/${FILE}`;
const S0 = `https://ia600906.us.archive.org/31/items/${ID}/${FILE}`;
const S1 = `https://ia800906.us.archive.org/31/items/${ID}/${FILE}`;

const load = vi.fn();
const playEl = vi.fn(async () => undefined);
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => true });
  Object.defineProperty(HTMLMediaElement.prototype, "load", { configurable: true, value: load });
  Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: playEl });
  Object.defineProperty(HTMLMediaElement.prototype, "pause", { configurable: true, value: vi.fn() });
  mirrors.mockImplementation(async () => ({ urls: [S0, S1], unreachable: false }));
  findTrack.mockImplementation(async () => TRACK);
});

const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 80)); });

const mount = (props: Partial<Parameters<typeof AudioPlayer>[0]> = {}) => {
  const view = render(
    <MemoryRouter>
      <AudioPlayer
        archiveUrl={`https://archive.org/details/${ID}`}
        songTitle="Jack Straw"
        showDate="1971-10-19"
        autoPlay
        directTrackUrl={TRACK}
        onClose={() => undefined}
        {...props}
      />
    </MemoryRouter>,
  );
  const audio = view.container.querySelector("audio")!;
  let t = 0;
  Object.defineProperty(audio, "currentTime", { configurable: true, get: () => t, set: (v: number) => { t = v; } });
  return { ...view, audio, at: (s: number) => { t = s; }, now: () => t };
};

const failNow = async (audio: HTMLAudioElement) => {
  await act(async () => { fireEvent.error(audio); });
  await tick();
};

describe("the legacy player fails over too", () => {
  it("moves to the item's first server and picks up where the track died", async () => {
    const { audio, at, now } = mount();
    expect(audio.getAttribute("src")).toBe(TRACK);
    at(312);
    await failNow(audio);
    expect(mirrors).toHaveBeenCalledWith(TRACK);
    expect(audio.getAttribute("src")).toBe(S0);
    expect(load).toHaveBeenCalled();
    await act(async () => { fireEvent.loadedMetadata(audio); });
    expect(now()).toBe(311);
    expect(playEl).toHaveBeenCalled();
    expect(screen.queryByText("Couldn't play this track")).toBeNull();
    // The old retry re-resolves to the very redirect that just failed.
    expect(findTrack).not.toHaveBeenCalled();
  });

  it("tries the servers in order, then gives up once, without starting the servers over", async () => {
    const { audio } = mount();
    const srcs: string[] = [audio.getAttribute("src")!];
    for (let i = 0; i < 6; i++) {
      await failNow(audio);
      const src = audio.getAttribute("src")!;
      if (src !== srcs[srcs.length - 1]) srcs.push(src);
    }
    // Its own url, each server, then the old retry back to its own url.
    expect(srcs).toEqual([TRACK, S0, S1, TRACK]);
    expect(screen.getByText("Couldn't play this track")).toBeTruthy();
  });

  it("in a set, a server that plays does not skip the song; spent servers do, once", async () => {
    const onEnded = vi.fn();
    const { audio } = mount({ singleTrackMode: true, onEnded });
    await failNow(audio);
    expect(audio.getAttribute("src")).toBe(S0);
    expect(onEnded).not.toHaveBeenCalled();
    for (let i = 0; i < 5; i++) await failNow(audio);
    expect(onEnded).toHaveBeenCalled();
  });

  it("an answer that comes back after the player moved to another track touches nothing", async () => {
    const OTHER = `https://archive.org/download/${ID}/gd71-10-19d1t10.mp3`;
    let answer: (v: { urls: string[]; unreachable: boolean }) => void = () => undefined;
    mirrors.mockImplementationOnce(() => new Promise((r) => { answer = r; }));
    const props = {
      archiveUrl: `https://archive.org/details/${ID}`,
      songTitle: "Jack Straw",
      showDate: "1971-10-19",
      autoPlay: true,
      onClose: () => undefined,
    };
    const view = render(<MemoryRouter><AudioPlayer {...props} directTrackUrl={TRACK} /></MemoryRouter>);
    const audio = view.container.querySelector("audio")!;
    await act(async () => { fireEvent.error(audio); });
    view.rerender(<MemoryRouter><AudioPlayer {...props} directTrackUrl={OTHER} /></MemoryRouter>);
    expect(audio.getAttribute("src")).toBe(OTHER);
    await act(async () => { answer({ urls: [S0, S1], unreachable: false }); });
    await tick();
    expect(audio.getAttribute("src")).toBe(OTHER);
    expect(findTrack).not.toHaveBeenCalled();
  });

  it("offline, it asks no server and goes straight to the old retry", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    const { audio } = mount();
    await failNow(audio);
    expect(mirrors).not.toHaveBeenCalled();
    expect(findTrack).toHaveBeenCalled();
  });
});
