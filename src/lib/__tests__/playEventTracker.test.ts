import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Regression tests for the two instrumentation bugs that corrupted
 * play_events in production:
 *
 *  1. Backgrounding the tab froze the listen clock for the rest of the track,
 *     because a visibilitychange handler called pausePlayEvent() and nothing
 *     resumed it. 92 'finished' rows recorded ~33% of the wall-clock time the
 *     row was actually open.
 *  2. Two starts in the same tick both inserted, orphaning the first row at
 *     ended_reason='in_progress' forever. 19 such rows in production.
 */

interface InsertedRow { id: string; [k: string]: unknown }

const inserted: InsertedRow[] = [];
const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];
let nextId = 1;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      // Async on purpose: this await is the window the start race opened.
      getUser: vi.fn(async () => {
        await new Promise((r) => setTimeout(r, 5));
        return { data: { user: null } };
      }),
    },
    from: vi.fn(() => ({
      insert: (row: Record<string, unknown>) => ({
        select: () => ({
          single: async () => {
            await new Promise((r) => setTimeout(r, 5));
            const created = { id: `row-${nextId++}`, ...row };
            inserted.push(created);
            return { data: { id: created.id }, error: null };
          },
        }),
      }),
      update: (patch: Record<string, unknown>) => ({
        eq: async (_col: string, id: string) => {
          updates.push({ id, patch });
          return { error: null };
        },
      }),
    })),
  },
}));

let tracker: typeof import("@/lib/playEventTracker");

beforeEach(async () => {
  inserted.length = 0;
  updates.length = 0;
  nextId = 1;
  localStorage.setItem("ds_visitor_id", "visitor-under-test");
  vi.resetModules();
  tracker = await import("@/lib/playEventTracker");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("playEventTracker — tab visibility", () => {
  it("keeps counting listened time while the tab is hidden", async () => {
    vi.useFakeTimers();
    await vi.advanceTimersByTimeAsync(0);

    const start = tracker.startPlayEvent({ songTitle: "Eyes of the World" });
    await vi.advanceTimersByTimeAsync(20);
    await start;

    tracker.setPlayEventTrackDuration(600_000);

    // Listen for a minute in the foreground.
    await vi.advanceTimersByTimeAsync(60_000);

    // Background the tab — audio keeps playing, so the clock must keep running.
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));

    await vi.advanceTimersByTimeAsync(240_000);

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));

    await tracker.finalizePlayEvent("finished");

    expect(updates).toHaveLength(1);
    const played = updates[0].patch.duration_played_ms as number;

    // ~300s listened. The old handler froze this at ~60s.
    expect(played).toBeGreaterThanOrEqual(295_000);
    expect(played).toBeLessThanOrEqual(305_000);
    expect(updates[0].patch.ended_reason).toBe("finished");
  });

  it("still stops counting on a real pause", async () => {
    vi.useFakeTimers();
    await vi.advanceTimersByTimeAsync(0);

    const start = tracker.startPlayEvent({ songTitle: "Brown Eyed Women" });
    await vi.advanceTimersByTimeAsync(20);
    await start;

    await vi.advanceTimersByTimeAsync(30_000);
    tracker.pausePlayEvent();
    await vi.advanceTimersByTimeAsync(120_000); // paused — must not accrue
    tracker.resumePlayEvent();
    await vi.advanceTimersByTimeAsync(30_000);

    await tracker.finalizePlayEvent("skipped");

    const played = updates[0].patch.duration_played_ms as number;
    expect(played).toBeGreaterThanOrEqual(58_000);
    expect(played).toBeLessThanOrEqual(62_000);
  });
});

describe("playEventTracker — concurrent starts", () => {
  it("finalizes the first row when two starts fire in the same tick", async () => {
    await Promise.all([
      tracker.startPlayEvent({ songTitle: "Samson and Delilah" }),
      tracker.startPlayEvent({ songTitle: "Gimme Some Lovin'" }),
    ]);

    expect(inserted).toHaveLength(2);

    // The first row must have been closed out, not orphaned at 'in_progress'.
    const firstId = inserted[0].id;
    const closed = updates.find((u) => u.id === firstId);
    expect(closed, "first row was orphaned at in_progress").toBeDefined();
    expect(closed!.patch.ended_reason).toBe("skipped");

    // The second row stays open as the active event.
    await tracker.finalizePlayEvent("finished");
    const secondClosed = updates.find((u) => u.id === inserted[1].id);
    expect(secondClosed).toBeDefined();
    expect(secondClosed!.patch.ended_reason).toBe("finished");
  });
});
