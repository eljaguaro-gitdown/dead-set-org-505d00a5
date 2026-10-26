import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

/**
 * When a tap will not play, which failures are FILED and apologised for, and
 * which are not. The line: an answer about the music (the song is not on the
 * tape, no tape of the night) gets the card and a report; anything we could
 * not ask about (a 5xx, a rejected fetch, the generic search that swallows
 * its errors) gets the old message and no report — a promise to say when
 * something is "fixed" is only honest about something that is broken.
 *
 * As in resolveReachability.test.tsx, archiveOrg is NOT mocked: fetch is
 * stubbed and the real resolver runs, because a mocked resolver can produce
 * inputs production never does.
 */

const mocks = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  success: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { error: mocks.error, info: mocks.info, success: mocks.success } }));

/** Any query-builder chain, ending in an empty answer. */
const chain = (): unknown =>
  new Proxy(() => undefined, {
    get: (_t, prop) =>
      prop === "then"
        ? (resolve: (v: unknown) => void) => resolve({ data: null, error: null })
        : () => chain(),
  });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => chain(),
    rpc: (...a: unknown[]) => mocks.rpc(...a),
    auth: { getUser: async () => ({ data: { user: null } }) },
  },
}));
vi.mock("@/lib/player/engineFlag", () => ({ resolvePlayerEngine: () => "legacy" }));

import { AudioPlayerProvider, useAudioPlayer, type PlayableSlot, type PlaybackOops } from "@/contexts/AudioPlayerContext";
import { knownGoodToSlot } from "@/lib/playbackIssues";

const ID = "gd73-02-09.sbd";
const SONG = "51515151-5151-4515-8515-515151515151";
const base = {
  song: { id: SONG, title: "Eyes of the World" },
  setNumber: 1,
  position: 0,
  segueToNext: false,
  directTrackUrl: null,
};
const version = (over: Record<string, unknown>) =>
  ({ id: "v", song_id: SONG, venue: null, city: null, era_id: null, rating: null, description: null, ...over }) as PlayableSlot["version"];

/** A stored tape, no usable date: the only route to "not on this tape". */
const STORED: PlayableSlot = { ...base, id: "stored", version: version({ show_date: "", archive_org_url: `https://archive.org/details/${ID}` }) };
/** A night with no stored tape: resolved by date. */
const NIGHT: PlayableSlot = { ...base, id: "night", version: version({ show_date: "1973-02-09", archive_org_url: null }) };
/** Neither: the generic search, which cannot tell absent from failed. */
const BARE: PlayableSlot = { ...base, id: "bare", version: version({ show_date: "", archive_org_url: null }) };

const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as unknown as Response;
const status = (code: number) => ({ ok: false, status: code, json: async () => ({}) }) as unknown as Response;
const WRONG_TAPE = { files: [{ name: "gd73-02-09 Sugaree.mp3", format: "VBR MP3", length: "300" }], metadata: { identifier: ID } };
const GOOD_TAPE = { files: [{ name: "gd73-02-09 Eyes of the World.mp3", format: "VBR MP3", length: "600" }], metadata: { identifier: ID } };

/** Archive stub: metadata answers with `meta`, every search finds nothing. */
const archive = (meta: unknown) =>
  vi.mocked(fetch).mockImplementation(async (input) =>
    String(input).includes("advancedsearch") ? json({ response: { docs: [] } }) : json(meta),
  );

let ctx: ReturnType<typeof useAudioPlayer>;
const Harness = () => {
  ctx = useAudioPlayer();
  return <div data-testid="err">{ctx.transport.error ?? ""}</div>;
};
const mount = () => render(<AudioPlayerProvider><Harness /></AudioPlayerProvider>);
const oops = (): PlaybackOops | null => ctx.playbackOops;
const reportCalls = () => mocks.rpc.mock.calls.filter((c) => c[0] === "report_playback_issue");

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
  mocks.rpc.mockImplementation(async (fn: string) =>
    fn === "report_playback_issue" ? { data: "issue-1", error: null } : { data: [], error: null },
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("a tap that will not play, for a reason a fix can address", () => {
  it("the song is not on the tape: the bar says so, the card apologises, and it is filed", async () => {
    archive(WRONG_TAPE);
    mount();
    act(() => void ctx.playSingle(STORED));
    await waitFor(() => expect(oops()?.kind).toBe("not_on_tape"), { timeout: 5000 });
    expect(screen.getByTestId("err").textContent).toBe("That song isn't on this tape.");
    await waitFor(() => expect(oops()?.issueId).toBe("issue-1"));
    await waitFor(() => expect(oops()?.suggestion).toBeNull());
    expect(reportCalls()[0][1]).toEqual(
      expect.objectContaining({ p_kind: "not_on_tape", p_song_id: SONG, p_archive_url: `https://archive.org/details/${ID}`, p_notify: true }),
    );
    expect(oops()?.slotId).toBe("stored");
  });

  it("no tape of the night: the card replaces the toast, with the night on it", async () => {
    archive(WRONG_TAPE);
    mount();
    act(() => void ctx.playSingle(NIGHT));
    await waitFor(() => expect(oops()?.kind).toBe("no_tape"), { timeout: 5000 });
    expect(oops()?.showDate).toBe("1973-02-09");
    expect(mocks.error).not.toHaveBeenCalled();
    expect(reportCalls()).toHaveLength(1);
  });

  it("nothing in a setlist plays: one card for the set, filed against it", async () => {
    archive(WRONG_TAPE);
    mount();
    await act(async () => {
      await ctx.playSetlist([NIGHT, { ...NIGHT, id: "night-2", version: version({ show_date: "1974-06-18", archive_org_url: null }) }], "77777777-7777-4777-8777-777777777777");
    });
    await waitFor(() => expect(oops()?.kind).toBe("none_in_setlist"), { timeout: 5000 });
    expect(reportCalls()[0][1]).toEqual(expect.objectContaining({ p_kind: "none_in_setlist", p_setlist_id: "77777777-7777-4777-8777-777777777777" }));
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("a slot the QUEUE skipped is filed, but the fan is promised nothing", async () => {
    // The next slot is a song that IS on this tape, so the queue has somewhere
    // to go. It used to be a second copy of the dead slot, which made it the
    // case below, and pinned "End of setlist" with no card as correct.
    archive(WRONG_TAPE);
    mount();
    const next = { ...STORED, id: "next", position: 1, song: { id: SONG, title: "Sugaree" } };
    act(() => void ctx.playSingle(STORED, { slots: [STORED, next] }));
    await waitFor(() => expect(ctx.playingSlot?.id).toBe("next"), { timeout: 5000 });
    expect(reportCalls()).toHaveLength(1);
    expect(reportCalls()[0][1]).toEqual(expect.objectContaining({ p_kind: "not_on_tape", p_notify: false }));
    expect(oops()).toBeNull();
  });

  it("skipped onto a last slot that will not resolve either: the card is for that one", async () => {
    // Listed as a residual of #131: a dead slot followed only by unresolvable
    // ones still ended in "End of setlist" with no card.
    archive(WRONG_TAPE);
    mount();
    act(() => void ctx.playSingle(STORED, { slots: [STORED, { ...STORED, id: "next", position: 1 }] }));
    await waitFor(() => expect(oops()?.slotId).toBe("next"), { timeout: 5000 });
    await waitFor(() => expect(reportCalls()).toHaveLength(2));
    expect(reportCalls()[0][1]).toEqual(expect.objectContaining({ p_kind: "not_on_tape", p_notify: false }));
    expect(reportCalls()[1][1]).toEqual(expect.objectContaining({ p_kind: "not_on_tape", p_notify: true }));
    expect(screen.getByTestId("err").textContent).toBe("That song isn't on this tape.");
    expect(mocks.info).not.toHaveBeenCalledWith("End of setlist");
  });

  it("the LAST slot has nothing to skip to: it is the fan's dead tap, and gets the card", async () => {
    // Was "Skipping Eyes of the World — not on this tape", then "End of
    // setlist", and no word to the fan about the song they had just tapped.
    archive(WRONG_TAPE);
    mount();
    const last = { ...STORED, id: "last", position: 1 };
    act(() => void ctx.playSingle(last, { slots: [{ ...STORED, id: "first" }, last] }));
    await waitFor(() => expect(oops()?.kind).toBe("not_on_tape"), { timeout: 5000 });
    expect(oops()?.slotId).toBe("last");
    expect(screen.getByTestId("err").textContent).toBe("That song isn't on this tape.");
    expect(reportCalls()).toHaveLength(1);
    expect(reportCalls()[0][1]).toEqual(expect.objectContaining({ p_kind: "not_on_tape", p_notify: true }));
    expect(mocks.info).not.toHaveBeenCalledWith(expect.stringMatching(/^Skipping/));
    expect(mocks.info).not.toHaveBeenCalledWith("End of setlist");
  });
});

describe("nothing is filed about what we could not ask", () => {
  it("a 503 on every request: the old message, no card, no report", async () => {
    vi.mocked(fetch).mockResolvedValue(status(503));
    mount();
    act(() => void ctx.playSingle(STORED));
    await waitFor(() => expect(screen.getByTestId("err").textContent).toMatch(/reach the Archive/i), { timeout: 5000 });
    expect(oops()).toBeNull();
    expect(reportCalls()).toHaveLength(0);
  });

  it("a rejected fetch on a night: the old message, no card, no report", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));
    mount();
    // Its own night: archiveOrg caches an ANSWER per night for the session,
    // and an earlier test already got "no tape" for NIGHT. Reusing it here
    // resolved from that cache and never asked the stubbed fetch at all.
    act(() => void ctx.playSingle({ ...NIGHT, id: "night-unasked", version: version({ show_date: "1972-08-27", archive_org_url: null }) }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringMatching(/reach the Archive/i)), { timeout: 5000 });
    expect(oops()).toBeNull();
    expect(reportCalls()).toHaveLength(0);
  });

  it("the generic search, which cannot tell absent from failed: the toast, never a filed promise", async () => {
    vi.mocked(fetch).mockResolvedValue(status(503));
    mount();
    act(() => void ctx.playSingle(BARE));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("No tape of this one circulates yet"), { timeout: 5000 });
    expect(oops()).toBeNull();
    expect(reportCalls()).toHaveLength(0);
  });
});

describe("the tape the card offers", () => {
  it("plays the track we know plays, with no Archive lookup at all", async () => {
    // Found in a browser: a known-good slot with no recording url was treated
    // as "resolve this night", the resolver missed, and the offered tape
    // re-raised the card that offered it.
    vi.mocked(fetch).mockResolvedValue(status(503));
    mount();
    const slot = knownGoodToSlot({
      songId: SONG,
      songTitle: "Eyes of the World",
      showDate: "1974-06-18",
      archiveUrl: null,
      trackUrl: "https://archive.org/download/gd74-06-18.sbd/eyes.mp3",
    });
    await act(async () => { await ctx.playSingle(slot); });
    expect(fetch).not.toHaveBeenCalled();
    expect(oops()).toBeNull();
    expect(ctx.playingSlot?.directTrackUrl).toBe("https://archive.org/download/gd74-06-18.sbd/eyes.mp3");
  });
});

describe("the card belongs to one tap", () => {
  it("a fresh tap takes it down", async () => {
    archive(WRONG_TAPE);
    mount();
    act(() => void ctx.playSingle(STORED));
    await waitFor(() => expect(oops()).not.toBeNull(), { timeout: 5000 });
    archive(GOOD_TAPE);
    act(() => void ctx.playSingle({ ...STORED, id: "other" }));
    expect(oops()).toBeNull();
  });

  it("a slow report about an earlier failure never lands on a later card", async () => {
    archive(WRONG_TAPE);
    let releaseFirst: (v: unknown) => void = () => undefined;
    let n = 0;
    mocks.rpc.mockImplementation((fn: string) => {
      if (fn !== "report_playback_issue") return Promise.resolve({ data: [], error: null });
      n += 1;
      return n === 1
        ? new Promise((r) => { releaseFirst = r; })
        : Promise.resolve({ data: "issue-2", error: null });
    });
    mount();
    act(() => void ctx.playSingle(STORED));
    await waitFor(() => expect(oops()?.key).toBeDefined(), { timeout: 5000 });
    const firstKey = oops()!.key;
    act(() => void ctx.playSingle({ ...STORED, id: "stored-2" }));
    await waitFor(() => expect(oops()?.key).not.toBe(firstKey), { timeout: 5000 });
    await waitFor(() => expect(oops()?.issueId).toBe("issue-2"));
    await act(async () => releaseFirst({ data: "issue-1", error: null }));
    expect(oops()?.issueId).toBe("issue-2");
  });

  it("dismiss takes it down", async () => {
    archive(WRONG_TAPE);
    mount();
    act(() => void ctx.playSingle(STORED));
    await waitFor(() => expect(oops()).not.toBeNull(), { timeout: 5000 });
    act(() => ctx.dismissPlaybackOops());
    expect(oops()).toBeNull();
  });
});

/**
 * Seen in a real browser by the 2026-10-26 gate (run 5): a tap whose answer
 * came back after the fan had moved on raised its card on the page they had
 * gone to. The card takes itself down on a route change, but that had already
 * happened by the time the answer arrived.
 */
describe("an answer that comes back after the fan has left the page", () => {
  /** Hold every Archive answer until `release`, so a navigation can cross it. */
  const held = (meta: unknown) => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => { release = r; });
    vi.mocked(fetch).mockImplementation(async (input) => {
      await gate;
      return String(input).includes("advancedsearch") ? json({ response: { docs: [] } }) : json(meta);
    });
    return () => act(async () => { release(); });
  };
  const at = (path: string) => window.history.pushState({}, "", path);
  afterEach(() => at("/"));
  /** Each its own night: archiveOrg caches an answer per night for the session. */
  const nightOf = (id: string, show_date: string): PlayableSlot => ({ ...NIGHT, id, version: version({ show_date, archive_org_url: null }) });

  it("a tap's own lookup: filed the quiet way, and no card on the page they went to", async () => {
    const release = held(WRONG_TAPE);
    mount();
    at("/songbook/eyes-of-the-world");
    act(() => void ctx.playSingle(nightOf("left-1", "1975-03-23")));
    at("/songbook");
    await release();
    await waitFor(() => expect(reportCalls()).toHaveLength(1), { timeout: 5000 });
    expect(reportCalls()[0][1]).toEqual(expect.objectContaining({ p_kind: "no_tape", p_notify: false }));
    expect(oops()).toBeNull();
  });

  it("staying on the page, the same slow answer still gets the card", async () => {
    const release = held(WRONG_TAPE);
    mount();
    at("/songbook/eyes-of-the-world");
    act(() => void ctx.playSingle(nightOf("stayed-1", "1976-06-03")));
    await release();
    await waitFor(() => expect(oops()?.kind).toBe("no_tape"), { timeout: 5000 });
    expect(reportCalls()[0][1]).toEqual(expect.objectContaining({ p_notify: true }));
  });

  it("a query-string change is the same page, as it is for the card's own dismissal", async () => {
    const release = held(WRONG_TAPE);
    mount();
    at("/songbook/eyes-of-the-world");
    act(() => void ctx.playSingle(nightOf("query-1", "1976-06-04")));
    at("/songbook/eyes-of-the-world?then=share");
    await release();
    await waitFor(() => expect(oops()?.kind).toBe("no_tape"), { timeout: 5000 });
  });

  it("the last stored tape of a tap: the bar still says why, but the card stays off the new page", async () => {
    const release = held(WRONG_TAPE);
    mount();
    at("/setlist/abc");
    const last = { ...STORED, id: "left-last", position: 1 };
    act(() => void ctx.playSingle(last, { slots: [{ ...STORED, id: "left-first" }, last] }));
    at("/");
    await release();
    await waitFor(() => expect(reportCalls()).toHaveLength(1), { timeout: 5000 });
    expect(reportCalls()[0][1]).toEqual(expect.objectContaining({ p_kind: "not_on_tape", p_notify: false }));
    expect(oops()).toBeNull();
    // The global bar is still on the song and still says why.
    expect(screen.getByTestId("err").textContent).toBe("That song isn't on this tape.");
  });

  it("Play All with nothing in it that plays: the same", async () => {
    const release = held(WRONG_TAPE);
    mount();
    at("/songbook/eyes-of-the-world");
    let done: Promise<void> = Promise.resolve();
    act(() => { done = ctx.playSetlist([nightOf("set-1", "1977-04-30"), nightOf("set-2", "1977-05-01")], "77777777-7777-4777-8777-777777777777"); });
    at("/songbook");
    await release();
    await act(async () => { await done; });
    await waitFor(() => expect(reportCalls()).toHaveLength(1), { timeout: 5000 });
    expect(reportCalls()[0][1]).toEqual(expect.objectContaining({ p_kind: "none_in_setlist", p_notify: false }));
    expect(oops()).toBeNull();
  });

  it("a page's own report carries the page it was tapped on, and is held to it", async () => {
    mount();
    const failure = { kind: "no_tape" as const, songId: SONG, songTitle: "Eyes of the World", showDate: "1974-06-18" };
    at("/songbook");
    act(() => ctx.reportPlaybackFailure(failure, { from: "/versions/eyes-of-the-world" }));
    expect(oops()).toBeNull();
    await waitFor(() => expect(reportCalls()).toHaveLength(1));
    expect(reportCalls()[0][1]).toEqual(expect.objectContaining({ p_notify: false }));

    act(() => ctx.reportPlaybackFailure(failure, { from: "/songbook" }));
    expect(oops()?.kind).toBe("no_tape");
    act(() => ctx.dismissPlaybackOops());
    // A synchronous report, with no await to cross, needs no page at all.
    act(() => ctx.reportPlaybackFailure(failure));
    expect(oops()?.kind).toBe("no_tape");
  });
});

describe("a queue that runs out on a night with no tape, through the real resolver", () => {
  it("gets the card for that night instead of 'End of setlist'", async () => {
    archive(GOOD_TAPE);
    mount();
    const first = { ...STORED, id: "q-first" };
    const lastNight = { ...NIGHT, id: "q-last", position: 1, version: version({ show_date: "1978-07-08", archive_org_url: null }) };
    await act(async () => { await ctx.playSingle(first, { slots: [first, lastNight] }); });
    await waitFor(() => expect(ctx.playingSlot?.directTrackUrl).toBeTruthy(), { timeout: 5000 });
    await act(async () => { await ctx.advancePlaylist(1); });
    await waitFor(() => expect(oops()?.kind).toBe("no_tape"), { timeout: 5000 });
    expect(oops()).toEqual(expect.objectContaining({ slotId: "q-last", showDate: "1978-07-08" }));
    expect(reportCalls()[0][1]).toEqual(expect.objectContaining({ p_kind: "no_tape", p_notify: true }));
    expect(mocks.info).not.toHaveBeenCalledWith("End of setlist");
  });
});
