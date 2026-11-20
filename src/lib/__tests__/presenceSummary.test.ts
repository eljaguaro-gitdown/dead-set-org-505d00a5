import { describe, expect, it } from "vitest";
import { summarizePresence, STALE_AFTER_MS } from "@/lib/presenceSummary";
import type { PresencePayload } from "@/lib/presenceChannel";

const NOW = Date.parse("2026-11-20T23:36:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const meta = (p: Partial<PresencePayload>): PresencePayload => ({
  visitor_id: "v1",
  user_id: null,
  display_name: null,
  avatar_url: null,
  page: "/",
  joined_at: ago(600_000),
  beat_at: ago(5_000),
  ...p,
});

describe("summarizePresence", () => {
  it("drops entries whose heartbeat stopped and counts them as stale", () => {
    const s = summarizePresence(
      {
        jay: [meta({ visitor_id: "jay", user_id: "u-jay", display_name: "grateful_jaguaro" })],
        ghost: [meta({ visitor_id: "ghost", page: "/join/abc", beat_at: ago(STALE_AFTER_MS + 1) })],
      },
      NOW,
    );
    expect(s.connections).toBe(2);
    expect(s.live).toBe(1);
    expect(s.stale).toBe(1);
    expect(s.visitors.map((v) => v.visitor_id)).toEqual(["jay"]);
  });

  it("merges a device's pre-signup tab into its signed-in tab", () => {
    const s = summarizePresence(
      {
        d7: [
          meta({ visitor_id: "d7", page: "/join/abc", beat_at: ago(40_000), joined_at: ago(900_000) }),
          meta({ visitor_id: "d7", user_id: "u-andrees", display_name: "andrees", page: "/", beat_at: ago(2_000) }),
        ],
      },
      NOW,
    );
    expect(s.visitors).toHaveLength(1);
    expect(s.visitors[0]).toMatchObject({
      user_id: "u-andrees",
      display_name: "andrees",
      page: "/",
      joined_at: ago(900_000),
    });
  });

  it("counts one signed-in user on two devices once", () => {
    const s = summarizePresence(
      {
        phone: [meta({ visitor_id: "phone", user_id: "u-jay", page: "/admin", beat_at: ago(1_000) })],
        mac: [meta({ visitor_id: "mac", user_id: "u-jay", page: "/builder", beat_at: ago(20_000) })],
        lovable: [meta({ visitor_id: "lovable", user_id: "u-jay", page: "/", beat_at: ago(10_000) })],
      },
      NOW,
    );
    expect(s.live).toBe(3);
    expect(s.visitors).toHaveLength(1);
    expect(s.visitors[0].page).toBe("/admin");
  });

  it("keeps entries from clients that predate beat_at", () => {
    const s = summarizePresence({ old: [meta({ visitor_id: "old", beat_at: undefined })] }, NOW);
    expect(s.stale).toBe(0);
    expect(s.visitors).toHaveLength(1);
  });
});
