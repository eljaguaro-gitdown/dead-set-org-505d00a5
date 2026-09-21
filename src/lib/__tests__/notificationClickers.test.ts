import { describe, it, expect } from "vitest";
import { groupClickers, type ClickRecord } from "@/lib/notificationClickers";

const click = (over: Partial<ClickRecord> = {}): ClickRecord => ({
  created_at: "2026-09-01T00:00:00Z",
  channel: "announcement:a1",
  user_id: "user-1",
  visitor_id: "visitor-1",
  ...over,
});

describe("groupClickers", () => {
  it("groups by user and splits announcements from comment notifications", () => {
    const [person] = groupClickers(
      [
        click({ channel: "announcement:a1", created_at: "2026-09-01T00:00:00Z" }),
        click({ channel: "comment_notif:c1", created_at: "2026-09-02T00:00:00Z" }),
        click({ channel: "comment_notif:c2", created_at: "2026-09-03T00:00:00Z" }),
      ],
      { "user-1": "grateful_jaguaro" },
    );

    expect(person).toMatchObject({
      label: "grateful_jaguaro",
      announcements: 1,
      comments: 2,
      total: 3,
      lastClick: "2026-09-03T00:00:00Z",
      isAnonymous: false,
    });
  });

  it("keeps the latest click even when rows arrive oldest-last", () => {
    // The page loads ascending, but nothing should depend on that.
    const [person] = groupClickers(
      [
        click({ created_at: "2026-09-09T00:00:00Z" }),
        click({ created_at: "2026-09-02T00:00:00Z" }),
      ],
      {},
    );
    expect(person.lastClick).toBe("2026-09-09T00:00:00Z");
  });

  it("prefers the user id over the visitor id, so one person is one row", () => {
    // Same human, two devices: different visitor ids, same account.
    const grouped = groupClickers(
      [
        click({ visitor_id: "visitor-1" }),
        click({ visitor_id: "visitor-2" }),
      ],
      { "user-1": "Terrapin Katie" },
    );
    expect(grouped).toHaveLength(1);
    expect(grouped[0]).toMatchObject({ label: "Terrapin Katie", total: 2 });
  });

  it("labels a signed-in clicker with no profile row without showing a raw uuid", () => {
    const [person] = groupClickers([click({ user_id: "abcdef1234567890" })], {});
    expect(person.label).toBe("Signed-in · abcdef12");
  });

  it("falls back to the visitor id when nobody was signed in", () => {
    const [person] = groupClickers(
      [click({ user_id: null, visitor_id: "9f8e7d6c5b4a" })],
      {},
    );
    expect(person).toMatchObject({ label: "Anonymous · 9f8e7d6c", isAnonymous: true });
  });

  it("skips a row with no identity at all rather than inventing one", () => {
    expect(groupClickers([click({ user_id: null, visitor_id: null })], {})).toEqual([]);
  });

  it("sorts by clicks, then by most recent", () => {
    const grouped = groupClickers(
      [
        click({ user_id: "quiet", created_at: "2026-09-10T00:00:00Z" }),
        click({ user_id: "busy", created_at: "2026-09-01T00:00:00Z" }),
        click({ user_id: "busy", created_at: "2026-09-02T00:00:00Z" }),
      ],
      { busy: "Busy", quiet: "Quiet" },
    );
    expect(grouped.map((c) => c.label)).toEqual(["Busy", "Quiet"]);
  });
});
