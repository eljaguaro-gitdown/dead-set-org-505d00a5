import { describe, expect, it } from "vitest";
import {
  judgeNight,
  jerrybaseEvent,
  performedIn,
  relistenTapes,
  type NightSources,
} from "../../../scripts/tape-desk/nightCheck";

// Shapes taken from the live sources on 2026-11-24 (Relisten v2, JerryBase).
const WEMBLEY_SET = [
  "Bertha", "Me And My Uncle", "Mr. Charlie", "Deal", "Black Throated Wind", "Next Time You See Me",
  "Cumberland Blues", "Brown Eyed Women", "Beat It On Down The Line", "Tennessee Jed", "Playing In The Band",
  "Good Lovin'", "Looks Like Rain", "Casey Jones", "Truckin'", "Big Railroad Blues", "Hurts Me Too",
  "Dark Star", "Mind Left Body Jam", "Sugar Magnolia", "Caution", "One More Saturday Night",
];
const tape = (identifier: string, titles: string[]) => ({
  identifier,
  tracks: titles.map((title) => ({ title, duration_s: 300 })),
});
const night = (over: Partial<NightSources>): NightSources => ({
  song: "Bird Song",
  date: "1972-04-08",
  relisten: { tapes: [tape("gd72-04-08.sbd.giles-jeffm.2534.sbeok.shnf", WEMBLEY_SET)] },
  jerrybase: { events: [{ url: "https://jerrybase.com/events/19720408-01", songs: WEMBLEY_SET }] },
  archiveIdentifiers: ["gd72-04-08.sbd.giles-jeffm.2534.sbeok.shnf"],
  ...over,
});

describe("judgeNight", () => {
  it("Bird Song 1972-04-08 (#153): not in the setlist and on no tape → N", () => {
    const j = judgeNight(night({}));
    expect(j.setlistPlayed).toBe("no");
    expect(j.onTape).toBe("no");
    expect(j.supports).toBe("N");
    expect(j.carrying).toEqual([]);
  });

  it("the 1971-02-19 debut: performed and on tape → on_tape, with the carrying tape named", () => {
    const set = ["Bertha", "Bird Song", "Playing in the Band"];
    const j = judgeNight(
      night({
        date: "1971-02-19",
        relisten: { tapes: [tape("gd71-02-19.sbd.orf.1029.sbeok.shnf", set), tape("gd71-02-19.aud", ["Bertha"])] },
        jerrybase: { events: [{ url: "x", songs: set }] },
      }),
    );
    expect(j.supports).toBe("on_tape");
    expect(j.carrying.map((c) => c.identifier)).toEqual(["gd71-02-19.sbd.orf.1029.sbeok.shnf"]);
    expect(j.carrying[0]).toMatchObject({ title: "Bird Song", duration_s: 300, score: 100 });
  });

  it("a song filed inside a segue suite is on the tape (the November Slipknot! shape)", () => {
    const j = judgeNight(
      night({
        song: "Slipknot!",
        relisten: { tapes: [tape("gd76", ["Help On The Way > Slipknot! > Franklin's Tower"])] },
        jerrybase: { events: [{ url: "x", songs: ["Help On The Way", "Slipknot!", "Franklin's Tower"] }] },
      }),
    );
    expect(j.onTape).toBe("yes");
    expect(j.supports).toBe("on_tape");
  });

  it("on tape while JerryBase does not list it still says on_tape, and says the setlist may be short", () => {
    const j = judgeNight(night({ relisten: { tapes: [tape("t", ["Bird Song"])] } }));
    expect(j.supports).toBe("on_tape");
    expect(j.why).toMatch(/JerryBase does not list it/);
  });

  it("performed, no title matches, a title sharing a word and scoring 0 → M, with the miss listed", () => {
    // "Bird Jam" shares "bird" with the song and scores 0 with the player's matcher.
    const j = judgeNight(
      night({
        relisten: { tapes: [tape("t", ["Bertha", "Bird Jam"])] },
        jerrybase: { events: [{ url: "x", songs: ["Bertha", "Bird Song"] }] },
      }),
    );
    expect(j.onTape).toBe("no");
    expect(j.supports).toBe("M");
    expect(j.nearMisses).toEqual([{ identifier: "t", title: "Bird Jam", score: 0 }]);
  });

  it("a title the matcher accepts is never a near miss: it carries the song", () => {
    // "Turn On Your Love-Light Jam" contains the whole song title (score 90).
    const j = judgeNight(
      night({
        song: "Turn on Your Love Light",
        relisten: { tapes: [tape("t", ["Bertha", "Turn On Your Love-Light Jam"])] },
        jerrybase: { events: [{ url: "x", songs: ["Turn On Your Lovelight"] }] },
      }),
    );
    expect(j.nearMisses).toEqual([]);
    expect(j.carrying.map((c) => c.title)).toEqual(["Turn On Your Love-Light Jam"]);
  });

  it("performed, no title matches, an untitled track → M", () => {
    const j = judgeNight(
      night({
        relisten: { tapes: [tape("t", ["Bertha", "Untitled", "Sugar Magnolia"])] },
        jerrybase: { events: [{ url: "x", songs: ["Bertha", "Bird Song", "Sugar Magnolia"] }] },
      }),
    );
    expect(j.supports).toBe("M");
    expect(j.untitled).toEqual([{ identifier: "t", title: "Untitled" }]);
  });

  it("performed and on no tape under any title → G", () => {
    const j = judgeNight(night({ jerrybase: { events: [{ url: "x", songs: [...WEMBLEY_SET, "Bird Song"] }] } }));
    expect(j.setlistPlayed).toBe("yes");
    expect(j.supports).toBe("G");
  });

  it("a word shared with an unrelated song does not turn an N into an M when the setlist says no", () => {
    const j = judgeNight(
      night({
        song: "Going Down the Road Feeling Bad",
        relisten: { tapes: [tape("t", ["Six Days On The Road"])] },
        jerrybase: { events: [{ url: "x", songs: ["Six Days On The Road"] }] },
      }),
    );
    expect(j.nearMisses.length).toBeGreaterThan(0);
    expect(j.supports).toBe("N");
  });

  it("Relisten did not answer → no class, never N", () => {
    const j = judgeNight(night({ relisten: null }));
    expect(j.onTape).toBe("unknown");
    expect(j.supports).toBeNull();
  });

  it("JerryBase did not answer → no class, never N", () => {
    const j = judgeNight(night({ jerrybase: null }));
    expect(j.setlistPlayed).toBe("unknown");
    expect(j.supports).toBeNull();
  });

  it("no show on Relisten (an empty answer) with no setlist entry is still N, because empty is an answer", () => {
    const j = judgeNight(night({ relisten: { tapes: [] } }));
    expect(j.supports).toBe("N");
  });

  it("an early and a late show are both read", () => {
    const j = judgeNight(
      night({
        song: "Dark Star",
        relisten: { tapes: [] },
        jerrybase: { events: [{ url: "early", songs: ["Casey Jones"] }, { url: "late", songs: ["Dark Star"] }] },
      }),
    );
    expect(j.setlistPlayed).toBe("yes");
  });
});

describe("performedIn", () => {
  it("uses the player's matcher, so spelling and spacing do not decide it", () => {
    expect(performedIn({ events: [{ url: "x", songs: ["Birdsong"] }] }, "Bird Song")).toBe(true);
    expect(performedIn({ events: [{ url: "x", songs: ["Truckin'"] }] }, "Truckin")).toBe(true);
    expect(performedIn({ events: [{ url: "x", songs: ["Sugar Magnolia"] }] }, "Sugaree")).toBe(false);
  });
});

describe("source parsers", () => {
  it("relistenTapes reads every source's sets in order, with durations", () => {
    const show = {
      sources: [
        { upstream_identifier: "gd1", sets: [{ tracks: [{ title: "Bertha", duration: 401 }] }, { tracks: [{ title: "Dark Star", duration: null }] }] },
        { upstream_identifier: "gd2", sets: [] },
      ],
    };
    expect(relistenTapes(show)).toEqual([
      { identifier: "gd1", tracks: [{ title: "Bertha", duration_s: 401 }, { title: "Dark Star", duration_s: null }] },
      { identifier: "gd2", tracks: [] },
    ]);
    expect(relistenTapes(null)).toEqual([]);
  });

  it("jerrybaseEvent reads the act from the title and each song once, decoded", () => {
    const html =
      "<title>Grateful Dead – 1972-04-08</title>" +
      '<a href="/songs/230">Good Lovin&#39;</a><a href="/songs/230" class="v">Good Lovin&#39;</a><a href="/songs/91">Dark Star</a>';
    expect(jerrybaseEvent(html)).toEqual({ act: "Grateful Dead", songs: ["Good Lovin'", "Dark Star"] });
  });

  it("jerrybaseEvent names another act so the caller can skip it", () => {
    expect(jerrybaseEvent("<title>Jerry Garcia Band – 1971-03-24</title>").act).toBe("Jerry Garcia Band");
  });
});
