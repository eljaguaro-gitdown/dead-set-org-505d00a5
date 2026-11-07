/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * The tape index, read from the browser: which track of which Archive item a
 * song is on a night, known before the tap (supabase/migrations/
 * 20261107010000_tape_index.sql, filled by the index-tapes edge function).
 *
 * The whole point is to take the Archive SEARCH out of the tap. A hit gives
 * the player the track url and the item's own servers in one small read
 * from our own database, so the tap goes straight to bytes. A miss — a night
 * nobody has indexed yet — falls through to the live lookup exactly as
 * before, and asks index-tapes to fill it in for the next fan.
 *
 * The read has its own short budget. A slow or broken index must never make
 * a tap slower than it was without one: past INDEX_BUDGET_MS the answer is
 * "miss", and the live lookup starts.
 *
 * Error contract: same as findRecordingForDate, which `findNight` wraps — it
 * throws when the Archive could not be asked and resolves null only for an
 * answer ("no tape of this night carries the song"). The index never throws.
 */
import { supabase } from "@/integrations/supabase/client";
import { findArchiveRecording, findRecordingForDate, primeMirrorRoots, type ArchiveResult } from "@/lib/archiveOrg";

export interface IndexRow {
  song_id: string;
  show_date: string;
  identifier: string;
  status: "playable" | "no_match" | "no_tape";
  is_default: boolean;
  is_song_default: boolean;
  track_url: string | null;
  servers: string[] | null;
  file_name: string | null;
  duration_s: number | null;
}

/** What the index knows about one night. `rows` empty = a miss. */
export interface IndexedNight {
  rows: IndexRow[];
}

export const INDEX_BUDGET_MS = 1200;
const COLS = "song_id,show_date,identifier,status,is_default,is_song_default,track_url,servers,file_name,duration_s";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const db = supabase as unknown as { from: (t: string) => any };
const nightCache = new Map<string, Promise<IndexRow[] | null>>();
const songDefaultCache = new Map<string, Promise<IndexRow | null>>();
const asked = new Set<string>();
/** Answers already in hand, for the screen to read synchronously. */
const settledNights = new Map<string, IndexRow[] | null>();
const nightListeners = new Set<() => void>();
const remember = (k: string, rows: IndexRow[] | null) => {
  settledNights.set(k, rows);
  nightListeners.forEach((l) => { try { l(); } catch { /* */ } });
};

const keyOf = (songId: string, day: string) => `${songId}@${day}`;
const withBudget = <T,>(p: PromiseLike<T>, fallback: T, ms = INDEX_BUDGET_MS): Promise<T> =>
  Promise.race([
    Promise.resolve(p).catch(() => fallback),
    new Promise<T>((r) => setTimeout(() => r(fallback), ms)),
  ]);

/** The index's rows for a night, or null when the index could not be read in budget. */
export function readNight(songId: string, showDate: string): Promise<IndexRow[] | null> {
  const day = (showDate || "").slice(0, 10);
  if (!UUID.test(songId) || !DAY.test(day)) return Promise.resolve(null);
  const k = keyOf(songId, day);
  const hit = nightCache.get(k);
  if (hit) return hit;
  const p = withBudget(
    (async () => {
      const { data, error } = await db.from("tape_index").select(COLS).eq("song_id", songId).eq("show_date", day);
      if (error || !Array.isArray(data)) return null;
      return data as IndexRow[];
    })(),
    null,
  ).then((rows) => {
    if (rows === null) nightCache.delete(k); // a failed read is not remembered
    else remember(k, rows);
    return rows;
  });
  nightCache.set(k, p);
  return p;
}

/**
 * Warm the index for the nights on screen, in one request, so the tap that
 * follows reads from memory. Fire and forget.
 */
export function prefetchNights(keys: Array<{ songId: string; showDate: string | null | undefined }>): void {
  const want = keys
    .map((k) => ({ songId: k.songId, day: (k.showDate || "").slice(0, 10) }))
    .filter((k) => UUID.test(k.songId) && DAY.test(k.day) && !nightCache.has(keyOf(k.songId, k.day)));
  if (want.length === 0) return;
  const songIds = [...new Set(want.map((k) => k.songId))];
  const days = [...new Set(want.map((k) => k.day))];
  const batch = (async () => {
    try {
      const { data, error } = await db.from("tape_index").select(COLS).in("song_id", songIds).in("show_date", days);
      return error || !Array.isArray(data) ? null : (data as IndexRow[]);
    } catch {
      return null;
    }
  })();
  for (const k of want) {
    const key = keyOf(k.songId, k.day);
    const p = batch.then((rows) => {
      if (rows === null) { nightCache.delete(key); return null; }
      const mine = rows.filter((r) => r.song_id === k.songId && r.show_date.slice(0, 10) === k.day);
      remember(key, mine);
      return mine;
    });
    nightCache.set(key, p);
  }
}

/** Ask index-tapes to fill a night for the next fan. Once per key per session; never awaited. */
export function requestIndexing(songId: string, showDate: string | null, identifier?: string | null): void {
  const day = (showDate || "").slice(0, 10);
  if (!UUID.test(songId) || !DAY.test(day)) return;
  const k = `${keyOf(songId, day)}#${identifier ?? ""}`;
  if (asked.has(k)) return;
  asked.add(k);
  try {
    const base = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!base || !key) return;
    void fetch(`${base}/functions/v1/index-tapes`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: key, authorization: `Bearer ${key}` },
      body: JSON.stringify({ song_id: songId, show_date: day, ...(identifier ? { identifier } : {}) }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* the next fan can ask again */
  }
}

/** A stream address on the item's own server, for the engine. The /download/ url stays the identity. */
export function streamUrlFor(row: Pick<IndexRow, "servers" | "track_url">): string | null {
  const root = row.servers?.[0];
  const file = row.track_url?.match(/^https:\/\/archive\.org\/download\/[^/]+\/(.+)$/)?.[1];
  return root && file ? `${root}/${file}` : null;
}

const toResult = (row: IndexRow): ArchiveResult => {
  // Failover needs the item's servers; hand them over so it never has to ask.
  if (row.servers?.length) primeMirrorRoots(row.identifier, row.servers);
  return {
    url: `https://archive.org/details/${row.identifier}`,
    date: row.show_date.slice(0, 10),
    venue: null,
    directTrackUrl: row.track_url,
    streamUrl: streamUrlFor(row),
  };
};

export type IndexAnswer =
  | { kind: "hit"; result: ArchiveResult }
  | { kind: "none"; why: "no_tape" | "no_match" }
  | { kind: "miss" };

/**
 * What the index says about a song on a night, preferring a recording the
 * slot already names. Never throws, never waits past the budget.
 */
export async function askIndex(songId: string | null | undefined, showDate: string | null | undefined, storedIdentifier?: string | null): Promise<IndexAnswer> {
  if (!songId || !showDate) return { kind: "miss" };
  const rows = await readNight(songId, showDate);
  if (!rows || rows.length === 0) {
    if (rows) requestIndexing(songId, showDate, storedIdentifier);
    return { kind: "miss" };
  }
  if (storedIdentifier) {
    const own = rows.find((r) => r.identifier === storedIdentifier);
    if (own?.status === "playable") return { kind: "hit", result: toResult(own) };
    // The named recording is known NOT to carry the song. The live path would
    // read its metadata (seconds on a phone) only to find that, then heal to
    // the night's best tape; the index already holds that tape, so go there.
    if (own?.status === "no_match") {
      const def = rows.find((r) => r.is_default && r.status === "playable");
      if (def) return { kind: "hit", result: toResult(def) };
      return { kind: "miss" };
    }
    // The night is indexed but not this recording: say nothing about it, and
    // let the live path read it (it may carry the song). Fill it in for later.
    requestIndexing(songId, showDate, storedIdentifier);
    return { kind: "miss" };
  }
  const def = rows.find((r) => r.is_default);
  if (!def) return { kind: "miss" };
  if (def.status === "playable") return { kind: "hit", result: toResult(def) };
  return { kind: "none", why: def.status };
}

/**
 * findRecordingForDate, with the index in front of it. Same contract: an
 * ArchiveResult, null for "no tape of this night carries the song", or a
 * throw for "could not ask the Archive".
 */
export async function findNight(songTitle: string, showDate: string, songId?: string | null): Promise<ArchiveResult | null> {
  const a = await askIndex(songId, showDate);
  if (a.kind === "hit") return a.result;
  if (a.kind === "none") return null;
  return findRecordingForDate(songTitle, showDate);
}

/** The song's undated answer — the generic search, ahead of time. */
export async function findSongDefault(songTitle: string, songId?: string | null): Promise<ArchiveResult | null> {
  if (songId && UUID.test(songId)) {
    let p = songDefaultCache.get(songId);
    if (!p) {
      p = withBudget(
        (async () => {
          const { data, error } = await db.from("tape_index").select(COLS).eq("song_id", songId).eq("is_song_default", true).limit(1);
          return !error && Array.isArray(data) && data[0] ? (data[0] as IndexRow) : null;
        })(),
        null,
      );
      songDefaultCache.set(songId, p);
    }
    const row = await p;
    if (row?.track_url) return toResult(row);
  }
  return findArchiveRecording(songTitle);
}

/**
 * What the index already knows about a night, without asking: "none" when it
 * knows no tape carries the song, "playable" when it has a track, null when
 * it has not been read (or holds nothing). For marking a row BEFORE the tap.
 */
export function peekNight(songId: string | null | undefined, showDate: string | null | undefined): "playable" | "none" | null {
  const day = (showDate || "").slice(0, 10);
  if (!songId || !DAY.test(day)) return null;
  const rows = settledNights.get(keyOf(songId, day));
  const def = rows?.find((r) => r.is_default);
  if (!def) return null;
  return def.status === "playable" ? "playable" : "none";
}
export function subscribeNights(cb: () => void): () => void {
  nightListeners.add(cb);
  return () => nightListeners.delete(cb);
}

/** Test seam. */
export function resetTapeIndex(): void {
  settledNights.clear();
  nightCache.clear();
  songDefaultCache.clear();
  asked.clear();
}
