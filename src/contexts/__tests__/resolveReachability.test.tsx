import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

/**
 * "The song not found — but they ARE there."
 *
 * resolveSlot reported three different failures as one sentence: the song is
 * not on this tape (an answer about the music), the Archive did not respond
 * (an admission about the network), and the search came back empty. A reader
 * got told a tape was missing seconds before that same tape started playing.
 *
 * THESE TESTS DO NOT MOCK archiveOrg. An earlier version did, with
 * `mockRejectedValue` on findTrackInRecording — and the pre-release gate showed
 * that is an input production cannot produce: `fetchMetadataWithFallback`
 * swallows every 5xx and every network error and RESOLVES with a failure
 * result. A rejected promise and a failing status are different inputs, and
 * mocking the one that never happens proves nothing about the one that does.
 *
 * So `fetch` is stubbed and the real resolver runs against it.
 */

const mocks = vi.hoisted(() => ({ error: vi.fn(), info: vi.fn(), success: vi.fn() }));

vi.mock("sonner", () => ({
  toast: { error: mocks.error, info: mocks.info, success: mocks.success },
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
    }),
    auth: { getUser: async () => ({ data: { user: null } }) },
  },
}));
vi.mock("@/lib/player/engineFlag", () => ({ resolvePlayerEngine: () => "legacy" }));

import { AudioPlayerProvider, useAudioPlayer, type PlayableSlot } from "@/contexts/AudioPlayerContext";

const IDENTIFIER = "gd73-02-09.sbd";
const SLOT: PlayableSlot = {
  id: "slot-1",
  song: { id: "song-1", title: "Eyes of the World" },
  version: {
    id: "v1", song_id: "song-1", show_date: "1973-02-09",
    archive_org_url: `https://archive.org/details/${IDENTIFIER}`,
    venue: "Stanford", city: null, era_id: null, rating: null, description: null,
  } as PlayableSlot["version"],
  directTrackUrl: null,
  setNumber: 1,
  position: 0,
  segueToNext: false,
};

/** Same slot with no stored tape — the shape most community nights arrive in. */
const DATED_SLOT: PlayableSlot = {
  ...SLOT,
  id: "slot-2",
  version: { ...SLOT.version, archive_org_url: null } as PlayableSlot["version"],
};

/** A slot with a tape and no usable date: the only route to "not on this tape". */
const UNDATED_SLOT: PlayableSlot = {
  ...SLOT,
  id: "slot-3",
  version: { ...SLOT.version, show_date: "" } as PlayableSlot["version"],
};

const json = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as unknown as Response;
const status = (code: number) =>
  ({ ok: false, status: code, json: async () => ({}) }) as unknown as Response;

/** Metadata for a tape that really does carry the song. */
const GOOD_META = {
  files: [{ name: "gd73-02-09 Eyes of the World.mp3", format: "VBR MP3", length: "600" }],
  metadata: { identifier: IDENTIFIER },
};
/** Read cleanly; the song is simply not on it. */
const WRONG_TAPE_META = {
  files: [{ name: "gd73-02-09 Sugaree.mp3", format: "VBR MP3", length: "300" }],
  metadata: { identifier: IDENTIFIER },
};

const Harness = ({ slot = SLOT }: { slot?: PlayableSlot }) => {
  const { playSingle, transport } = useAudioPlayer();
  return (
    <>
      <button onClick={() => void playSingle(slot)}>play</button>
      <div data-testid="err">{transport.error ?? ""}</div>
    </>
  );
};

const tap = (slot?: PlayableSlot) => {
  render(<AudioPlayerProvider><Harness slot={slot} /></AudioPlayerProvider>);
  fireEvent.click(screen.getAllByText("play")[0]);
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

const err = () => screen.getByTestId("err").textContent ?? "";

describe("a tape we could not ask about is never reported as one that does not exist", () => {
  it("a 503 on every request is UNREACHABLE, not 'not on this tape'", async () => {
    // The commonest production shape, and a RESOLVED promise — which is why a
    // catch on the caller could never see it.
    vi.mocked(fetch).mockResolvedValue(status(503));
    tap();
    await waitFor(() => expect(err()).toMatch(/reach the Archive/i), { timeout: 5000 });
    expect(err()).not.toMatch(/isn't on this tape/i);
  });

  it("a rejected fetch is UNREACHABLE too", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));
    tap();
    await waitFor(() => expect(err()).toMatch(/reach the Archive/i), { timeout: 5000 });
  });

  it("an UNDATED slot on a 503 is still unreachable — the hole the gate found", async () => {
    // With no usable date there is no second leg to reach the throwing
    // resolver, so this used to fall through to "That song isn't on this tape."
    // on a tape nobody had managed to open.
    vi.mocked(fetch).mockResolvedValue(status(503));
    tap(UNDATED_SLOT);
    await waitFor(() => expect(err()).toMatch(/reach the Archive/i), { timeout: 5000 });
    expect(err()).not.toMatch(/isn't on this tape/i);
  });

  it("an UNDATED slot on a REJECTED fetch is unreachable", async () => {
    // A dated slot can still reach the throwing by-night resolver, which masks
    // whether the track-lookup leg flagged anything. With no date, that leg is
    // the only one — so this is the case that actually pins it.
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));
    tap(UNDATED_SLOT);
    await waitFor(() => expect(err()).toMatch(/reach the Archive/i), { timeout: 5000 });
    expect(err()).not.toMatch(/isn't on this tape/i);
  });

  it("a tape read cleanly that lacks the song still says 'not on this tape'", async () => {
    // The Archive answered. This is the one case where the definite claim is
    // earned, and it must survive the fix.
    vi.mocked(fetch).mockResolvedValue(json(WRONG_TAPE_META));
    tap(UNDATED_SLOT);
    await waitFor(() => expect(err()).toMatch(/isn't on this tape/i), { timeout: 5000 });
    expect(err()).not.toMatch(/reach the Archive/i);
  });

  it("says nothing at all when the track resolves", async () => {
    vi.mocked(fetch).mockResolvedValue(json(GOOD_META));
    tap();
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 50));
    expect(err()).toBe("");
  });

  it("a DATED slot with no stored tape reports unreachable on a 503", async () => {
    vi.mocked(fetch).mockResolvedValue(status(503));
    tap(DATED_SLOT);
    await waitFor(() => expect(mocks.error).toHaveBeenCalled(), { timeout: 5000 });
    expect(String(mocks.error.mock.calls[0][0])).toMatch(/reach the Archive/i);
  });
});

describe("a new tap is a new attempt", () => {
  it("clears the previous failure, so the retry it invited is not buried", async () => {
    // The gate's BLOCK: transport.error is keyed to a slot id and was cleared
    // only by the bar's own retry. So the banner from a failed tap survived the
    // re-tap it had just invited — over a tape that was loading fine — and it
    // suppressed CrateDigging, which hides whenever an error is set.
    vi.mocked(fetch).mockResolvedValue(status(503));
    render(<AudioPlayerProvider><Harness /></AudioPlayerProvider>);
    fireEvent.click(screen.getByText("play"));
    await waitFor(() => expect(err()).toMatch(/reach the Archive/i), { timeout: 5000 });

    // The Archive comes back, and the reader does what the message told them.
    vi.mocked(fetch).mockResolvedValue(json(GOOD_META));
    fireEvent.click(screen.getByText("play"));
    await waitFor(() => expect(err()).toBe(""), { timeout: 5000 });
  });
});
