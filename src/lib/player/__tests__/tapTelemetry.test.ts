import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  beginTap,
  claimTap,
  tapStage,
  tapSlot,
  tapFirstSound,
  tapFailed,
  activeTap,
  resetTaps,
  surfaceFromPath,
  type TapRecord,
} from "@/lib/player/tapTelemetry";

/**
 * The contract: every tap sends play_requested, then EXACTLY ONE of
 * play_first_sound / play_failed. Observed through the DOM event the module
 * emits, which is also what TapeBench reads — PostHog has no token in tests.
 */
const seen: TapRecord[] = [];
const listen = (e: Event) => seen.push((e as CustomEvent<TapRecord>).detail);

beforeEach(() => {
  seen.length = 0;
  resetTaps();
  window.removeEventListener("deadset:tap", listen);
  window.addEventListener("deadset:tap", listen);
});

const events = () => seen.map((r) => r.event);

describe("one tap, one answer", () => {
  it("sends play_requested at the finger and first_sound once", () => {
    const t = beginTap("version_picker", { songId: "s1", showDate: "1977-05-08", hasPrecomputed: false });
    expect(seen[0]).toMatchObject({ event: "play_requested", tap_id: t.id, surface: "version_picker", song_id: "s1", show_date: "1977-05-08", has_precomputed: false });
    claimTap("other", { slotId: "slot-1" });
    tapFirstSound("slot-1");
    tapFirstSound("slot-1"); // the next tick is not a second answer
    expect(events()).toEqual(["play_requested", "play_first_sound"]);
    expect(seen[1].tap_id).toBe(t.id);
    expect(typeof seen[1].ms).toBe("number");
  });

  it("the player mints the tap when no surface did, naming the route", () => {
    const t = claimTap(surfaceFromPath("/setlist/abc"), { slotId: "x", songId: "s", hasPrecomputed: true });
    expect(seen[0]).toMatchObject({ event: "play_requested", tap_id: t.id, surface: "setlist_poster", has_precomputed: true });
  });

  it("a failure carries the stage the tap was on, and nothing after it counts", () => {
    beginTap("songbook_issue", { songId: "s" });
    claimTap("other", { slotId: "n1" });
    tapStage("metadata");
    tapStage("match");
    tapFailed("not_on_tape");
    tapFirstSound("n1"); // a late tick from somewhere cannot resurrect it
    tapFailed("wont_play", "buffer");
    expect(events()).toEqual(["play_requested", "play_failed"]);
    expect(seen[1]).toMatchObject({ kind: "not_on_tape", stage: "match" });
  });

  it("an explicit stage on failure wins over the tracked one", () => {
    claimTap("other", { slotId: "n1" });
    tapStage("redirect");
    tapFailed("autoplay_blocked", "gesture");
    expect(seen[1]).toMatchObject({ kind: "autoplay_blocked", stage: "gesture" });
  });

  it("a second tap supersedes a first still waiting for sound", () => {
    const a = beginTap("version_picker", { songId: "a" });
    claimTap("other", { slotId: "a" });
    tapStage("lookup");
    const b = beginTap("version_picker", { songId: "b" });
    claimTap("other", { slotId: "b" });
    tapFirstSound("b");
    expect(seen.map((r) => [r.event, r.tap_id])).toEqual([
      ["play_requested", a.id],
      ["play_requested", b.id],
      ["play_failed", a.id],
      ["play_first_sound", b.id],
    ]);
    expect(seen[2]).toMatchObject({ kind: "superseded", stage: "lookup" });
  });

  it("a tick from another slot is not this tap's sound", () => {
    claimTap("other", { slotId: "wanted" });
    tapFirstSound("previous-track");
    expect(events()).toEqual(["play_requested"]);
    tapFirstSound("wanted");
    expect(events()).toEqual(["play_requested", "play_first_sound"]);
  });

  it("Play All moves the tap onto the slot it ends up on", () => {
    claimTap("setlist_button", { slotId: "first" });
    tapSlot("third");
    tapFirstSound("first");
    expect(events()).toEqual(["play_requested"]);
    tapFirstSound("third");
    expect(events()).toEqual(["play_requested", "play_first_sound"]);
  });

  it("the player fills in what the surface could not know at the finger", () => {
    beginTap("landing_hero", { hasPrecomputed: null });
    claimTap("other", { slotId: "s1", songId: "song", showDate: "1972-05-03", hasPrecomputed: true });
    expect(activeTap()).toMatchObject({ surface: "landing_hero", slotId: "s1", songId: "song", hasPrecomputed: true });
  });

  it("a surface's tap older than 30 s is not claimed as this one", () => {
    const spy = vi.spyOn(performance, "now");
    spy.mockReturnValue(1_000);
    const stale = beginTap("version_picker", { songId: "old" });
    spy.mockReturnValue(1_000 + 31_000);
    const fresh = claimTap("setlist_poster", { slotId: "s" });
    expect(fresh.id).not.toBe(stale.id);
    expect(fresh.surface).toBe("setlist_poster");
    spy.mockRestore();
  });

  it("keeps a ring buffer on window for the bench", () => {
    claimTap("other", { slotId: "s" });
    tapFirstSound("s");
    const ring = (window as Window & { __deadSetTaps?: TapRecord[] }).__deadSetTaps ?? [];
    expect(ring.map((r) => r.event)).toEqual(["play_requested", "play_first_sound"]);
  });
});

describe("surfaceFromPath", () => {
  it.each([
    ["/", "landing_hero"],
    ["/versions/dark-star", "version_picker"],
    ["/songbook", "songbook"],
    ["/songbook/althea", "songbook_issue"],
    ["/setlist/abc", "setlist_poster"],
    ["/song/123", "song_page"],
    ["/builder", "builder"],
    ["/my-setlists", "my_setlists"],
    ["/browse", "browse"],
    ["/admin", "other"],
  ])("%s → %s", (path, surface) => {
    expect(surfaceFromPath(path)).toBe(surface);
  });
});
