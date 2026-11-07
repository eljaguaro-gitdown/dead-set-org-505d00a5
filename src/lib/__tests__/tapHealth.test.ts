import { describe, it, expect } from "vitest";
import { buildTapHealthSql, toTapHealth, FIELD_MIN_TAPS } from "../../../supabase/functions/admin-users/taps.ts";
import { readTapHealth } from "@/components/AdminTapHealth";

describe("field tap health", () => {
  it("queries the three tap events, a rolling week, through the shared traffic filter", () => {
    const sql = buildTapHealthSql("FILTER_HERE");
    expect(sql).toContain("'play_requested', 'play_first_sound', 'play_failed'");
    expect(sql).toContain("INTERVAL 7 DAY");
    expect(sql).toContain("FILTER_HERE");
    // Plan B's own taps are not fans' taps; their sound still serves the fan.
    expect(sql).toMatch(/event = 'play_requested' AND properties\.surface != 'plan_b'\) AS taps/);
    expect(sql).toMatch(/event = 'play_first_sound' AND toFloat\(properties\.ms\) <= 15000\) AS sounded/);
  });

  it("success is sounded over answered — abandoned taps are not failures", () => {
    const h = toTapHealth([{ taps: 120, abandoned: 20, sounded: 98, blocked: 1, planB: 3, p50: 900, p90: 2600 }]);
    expect(h).toMatchObject({ answered: 100, success: 0.98, p50Ms: 900, p90Ms: 2600, enoughToJudge: true });
  });

  it("is not judged under the field minimum", () => {
    expect(toTapHealth([{ taps: FIELD_MIN_TAPS, abandoned: 0, sounded: 99 }])?.enoughToJudge).toBe(false);
  });

  it("an unanswered query is null ('—'), never zeros; a quantile over nothing is no data, not 0 ms", () => {
    expect(toTapHealth(null)).toBeNull();
    expect(toTapHealth([{ taps: "x", abandoned: 0, sounded: 0 }])).toBeNull();
    expect(toTapHealth([{ taps: 0, abandoned: 0, sounded: 0, p50: NaN, p90: "nan" }])).toMatchObject({ success: null, p50Ms: null, p90Ms: null });
  });

  it("the page reads only a well-formed payload", () => {
    expect(readTapHealth({ taps: 5, answered: 5, sounded: 5, success: 1, enoughToJudge: false })).toMatchObject({ taps: 5, success: 1 });
    expect(readTapHealth({ taps: -1, answered: 5, sounded: 5 })).toBeNull();
    expect(readTapHealth(null)).toBeNull();
  });
});
