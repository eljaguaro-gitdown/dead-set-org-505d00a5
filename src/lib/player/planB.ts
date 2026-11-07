/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Plan B: when a tap cannot make a sound — the night has no tape, or eight
 * seconds pass in silence — start a version of the SAME SONG we know plays,
 * and say so honestly. The fan hears music; the night that failed is still
 * filed (when a fix can address it) and still owed a fix.
 *
 * Owner decision 2026-11-06: on by default. `localStorage.plan_b = "off"`
 * turns it off for one browser, for testing the bare failure path.
 *
 * "A sure thing" means, in order:
 *   1. a tape of this song that has really played for fans (verified_tapes,
 *      through suggest_known_good_tape — most-played first), never the night
 *      that just failed;
 *   2. the tape index's undated answer for the song (the tape the generic
 *      search plays), then any indexed playable night of it.
 * Same song only. A different song is not Plan B for this one; with nothing
 * known, the caller falls back to the oops card, which offers what it has.
 */
import { supabase } from "@/integrations/supabase/client";
import { isArchiveTrackUrl, asIsoDate, asUuid, type KnownGoodTape } from "@/lib/playbackIssues";
import { streamUrlFor } from "@/lib/tapeIndex";

/** The brief's ceiling: no tap may sit longer than this without an answer. */
export const SILENCE_LIMIT_MS = 8_000;
/**
 * When Plan B steps in. Under the limit, not at it: at exactly 8 s the card
 * rendered a few ms after the limit, so every slow tap that Plan B rescued
 * still counted as a silent wait (24 of 59 on the 2026-11-07 runner sample).
 */
export const PLAN_B_AFTER_MS = 7_600;
/** When the sure thing is looked up for a tap that is still silent, so it is ready at PLAN_B_AFTER_MS. */
export const PLAN_B_PREFETCH_MS = 4_000;
const FIND_BUDGET_MS = 2_500;

export interface SureThing extends KnownGoodTape {
  /** The item's own server, when the index knows it. */
  streamUrl?: string | null;
}

export function isPlanBEnabled(): boolean {
  try {
    return window.localStorage.getItem("plan_b") !== "off";
  } catch {
    return true;
  }
}

const db = supabase as unknown as {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: any; error: any }>;
  from: (t: string) => any;
};

const within = <T,>(p: PromiseLike<T>, ms: number, fallback: T): Promise<T> =>
  Promise.race([Promise.resolve(p).catch(() => fallback), new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);

async function fromVerified(songId: string, excludeDate: string | null, excludeTrack: string | null): Promise<SureThing | null> {
  const { data, error } = await db.rpc("suggest_known_good_tape", {
    p_song_id: songId,
    p_exclude_date: excludeDate,
    p_exclude_track: excludeTrack,
  });
  const row = !error && Array.isArray(data) ? data[0] : null;
  // The RPC falls back to ANY song; Plan B is the same song or nothing.
  if (!row || row.song_id !== songId || !isArchiveTrackUrl(row.track_url)) return null;
  if (excludeDate && asIsoDate(row.show_date) === excludeDate) return null;
  return {
    songId,
    songTitle: row.song_title,
    showDate: asIsoDate(row.show_date),
    archiveUrl: row.archive_url ?? null,
    trackUrl: row.track_url,
  };
}

async function fromIndex(songId: string, songTitle: string, excludeDate: string | null, excludeTrack: string | null): Promise<SureThing | null> {
  const { data, error } = await db
    .from("tape_index")
    .select("show_date,identifier,track_url,servers,is_song_default,verified_at")
    .eq("song_id", songId)
    .eq("status", "playable")
    .order("is_song_default", { ascending: false })
    .order("verified_at", { ascending: false })
    .limit(10);
  if (error || !Array.isArray(data)) return null;
  const row = data.find((r: any) =>
    isArchiveTrackUrl(r.track_url) && r.track_url !== excludeTrack && asIsoDate(r.show_date) !== excludeDate,
  );
  if (!row) return null;
  return {
    songId,
    songTitle,
    showDate: asIsoDate(row.show_date),
    archiveUrl: `https://archive.org/details/${row.identifier}`,
    trackUrl: row.track_url,
    streamUrl: streamUrlFor(row),
  };
}

/** A version of this song we know plays, other than the one that failed. Never throws. */
/** Recent answers, so a prefetch at 4 s makes the 7.6 s answer immediate. */
const sureCache = new Map<string, { at: number; p: Promise<SureThing | null> }>();
const SURE_TTL_MS = 60_000;
export function resetSureThings(): void { sureCache.clear(); }

export async function findSureThing(args: {
  songId: string | null | undefined;
  songTitle: string;
  excludeDate?: string | null;
  excludeTrack?: string | null;
}): Promise<SureThing | null> {
  const songId = asUuid(args.songId);
  if (!songId) return null;
  const excludeDate = asIsoDate(args.excludeDate ?? null);
  const excludeTrack = args.excludeTrack ?? null;
  // Keyed without the track: a prefetch may not know which track is failing
  // yet. If the cached answer IS that track, ask again rather than offer it.
  const key = `${songId}|${excludeDate ?? ""}`;
  const hit = sureCache.get(key);
  if (hit && Date.now() - hit.at < SURE_TTL_MS) {
    const tape = await hit.p;
    if (!tape || !excludeTrack || tape.trackUrl !== excludeTrack) return tape;
  }
  const p = within(
    (async () =>
      (await fromVerified(songId, excludeDate, excludeTrack).catch(() => null)) ??
      (await fromIndex(songId, args.songTitle, excludeDate, excludeTrack).catch(() => null)))(),
    FIND_BUDGET_MS,
    null,
  );
  sureCache.set(key, { at: Date.now(), p });
  return p;
}

export type PlanBReason = "no_tape" | "slow" | "wont_play";

/** What the card says. Pure, so the voice is testable. House voice; never "AI". */
export function planBCopy(reason: PlanBReason, sureDate: string | null, failedDate: string | null) {
  const sure = sureDate ?? "another night";
  if (reason === "no_tape") {
    return {
      headline: "Here's a sure thing.",
      detail: failedDate
        ? `No tape of ${failedDate} has it — here's ${sure}, a sure thing. We'll keep looking.`
        : `No tape of that night has it — here's ${sure}, a sure thing. We'll keep looking.`,
    };
  }
  return {
    headline: "Here's a sure thing.",
    detail: `That night's tape won't spin right now — here's ${sure}, a sure thing. We'll keep after the other one.`,
  };
}
