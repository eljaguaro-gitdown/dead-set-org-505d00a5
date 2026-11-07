import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * findSureThing caches its answer so a prefetch 4 s into a silent tap makes
 * the 7.6 s Plan B immediate. The cache is keyed without the track (the
 * prefetch does not know yet which track is failing), so it must never hand
 * back the very track it is asked to avoid.
 */
const SONG = "22222222-2222-4222-8222-222222222222";
const A = "https://archive.org/download/gd72-08-27/a.mp3";
const B = "https://archive.org/download/gd73-06-10/b.mp3";
const calls: Array<Record<string, unknown>> = [];
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(async (_fn: string, args: Record<string, unknown>) => {
      calls.push(args);
      const track = args.p_exclude_track === A ? B : A;
      return { data: [{ song_id: SONG, song_title: "Bertha", show_date: track === A ? "1972-08-27" : "1973-06-10", archive_url: null, track_url: track }], error: null };
    }),
    from: () => { throw new Error("index not needed"); },
  },
}));

import { findSureThing, resetSureThings } from "@/lib/player/planB";

beforeEach(() => { resetSureThings(); calls.length = 0; });

describe("findSureThing's cache", () => {
  it("answers a second ask from the cache", async () => {
    expect((await findSureThing({ songId: SONG, songTitle: "Bertha", excludeDate: "1977-05-09" }))?.trackUrl).toBe(A);
    expect((await findSureThing({ songId: SONG, songTitle: "Bertha", excludeDate: "1977-05-09" }))?.trackUrl).toBe(A);
    expect(calls).toHaveLength(1);
  });

  it("asks again rather than offer the track that is failing", async () => {
    await findSureThing({ songId: SONG, songTitle: "Bertha", excludeDate: "1977-05-09" }); // the prefetch: A
    const t = await findSureThing({ songId: SONG, songTitle: "Bertha", excludeDate: "1977-05-09", excludeTrack: A });
    expect(t?.trackUrl).toBe(B);
    expect(calls).toHaveLength(2);
  });

  it("keys by the failed night: another night's ask is not served from it", async () => {
    await findSureThing({ songId: SONG, songTitle: "Bertha", excludeDate: "1977-05-09" });
    await findSureThing({ songId: SONG, songTitle: "Bertha", excludeDate: "1972-08-27" });
    expect(calls).toHaveLength(2);
  });
});
