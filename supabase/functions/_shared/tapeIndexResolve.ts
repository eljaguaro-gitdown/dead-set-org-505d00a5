/**
 * Resolve one song on one night against the Archive, for the tape index.
 *
 * The same question the player's by-night lookup asks
 * (src/lib/archiveOrg.ts findRecordingForDate), with the same matcher
 * (tapeMatch.ts), and the same order: the night's recordings, most
 * downloaded first, the first that carries the song wins. What it adds is
 * everything the player needs to start WITHOUT asking again: the item's own
 * servers, the file, its length.
 *
 * Runs in Deno (index-tapes) and in Node (scripts/tape-index/backfill.ts).
 * `fetchFn` is injected so both can supply their own, and tests a fake.
 *
 * Never stores a failure to ask. If any candidate could not be read and none
 * matched, the answer is `unreachable` and the caller writes nothing.
 */
import { findBestTrack, isRestrictedItem, itemServerRoots } from "./tapeMatch.ts";

export interface TapeIndexRow {
  song_id: string;
  show_date: string;
  identifier: string;
  status: "playable" | "no_match" | "no_tape";
  is_default: boolean;
  is_song_default?: boolean;
  track_url: string | null;
  servers: string[];
  file_name: string | null;
  title_on_tape: string | null;
  duration_s: number | null;
  match_score: number | null;
}

export interface ResolveNightResult {
  rows: TapeIndexRow[];
  /** Some lookup failed and nothing settled the night. Store nothing. */
  unreachable: boolean;
  requests: number;
}

type FetchFn = (url: string, init?: { signal?: AbortSignal }) => Promise<Response>;

const PER_REQUEST_MS = 10_000;

async function getJson(fetchFn: FetchFn, url: string, counter: { n: number }): Promise<{ ok: true; json: any } | { ok: false; answer: boolean }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    counter.n++;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), PER_REQUEST_MS);
    try {
      const res = await fetchFn(url, { signal: ctrl.signal });
      if (res.status >= 500 || res.status === 429) {
        if (attempt === 0) { await new Promise((r) => setTimeout(r, 800)); continue; }
        return { ok: false, answer: false };
      }
      // A 404 is an answer: there is no such thing.
      if (!res.ok) return { ok: false, answer: true };
      return { ok: true, json: await res.json() };
    } catch {
      if (attempt === 0) { await new Promise((r) => setTimeout(r, 800)); continue; }
      return { ok: false, answer: false };
    } finally {
      clearTimeout(t);
    }
  }
  return { ok: false, answer: false };
}

/** "312.45", "05:12" or "1:02:03" → seconds. */
export function parseLength(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw !== "string" || !raw.trim()) return null;
  if (/^\d+(\.\d+)?$/.test(raw)) return Number(raw);
  const parts = raw.split(":").map(Number);
  if (parts.some((p) => !Number.isFinite(p))) return null;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

/** The metadata of an item, trying the `.flacNN`-less variant the way the player does. */
async function readItem(fetchFn: FetchFn, identifier: string, counter: { n: number }) {
  const variants = [identifier];
  if (/\.flac\d*$/i.test(identifier)) variants.push(identifier.replace(/\.flac\d*$/i, ""));
  let unreachable = false;
  for (const id of variants) {
    const r = await getJson(fetchFn, `https://archive.org/metadata/${id}`, counter);
    if (!r.ok) {
      if ("answer" in r && !r.answer) unreachable = true;
      continue;
    }
    if (Array.isArray(r.json?.files) && r.json.files.length > 0) return { meta: r.json, id, unreachable: false };
  }
  return { meta: null, id: identifier, unreachable };
}

function playableRow(songId: string, day: string, id: string, meta: any, songTitle: string, isDefault: boolean): TapeIndexRow | null {
  const best = findBestTrack(meta.files, songTitle, { restricted: isRestrictedItem(meta) });
  if (!best) return null;
  return {
    song_id: songId,
    show_date: day,
    identifier: id,
    status: "playable",
    is_default: isDefault,
    track_url: `https://archive.org/download/${id}/${encodeURIComponent(best.file.name)}`,
    servers: itemServerRoots(meta).slice(0, 8),
    file_name: String(best.file.name),
    title_on_tape: best.file.title ? String(best.file.title).slice(0, 300) : null,
    duration_s: parseLength(best.file.length),
    match_score: best.score,
  };
}

export async function resolveNight(
  fetchFn: FetchFn,
  args: { songId: string; songTitle: string; showDate: string; storedIdentifier?: string | null },
): Promise<ResolveNightResult> {
  const day = args.showDate.slice(0, 10);
  const counter = { n: 0 };
  const rows: TapeIndexRow[] = [];
  let unreachable = 0;

  // A recording the catalog or a guide already names: index it under its own
  // identifier, so a slot that stores it can start without asking.
  if (args.storedIdentifier) {
    const item = await readItem(fetchFn, args.storedIdentifier, counter);
    if (item.meta) {
      const row = playableRow(args.songId, day, item.id, item.meta, args.songTitle, false);
      // Not on this recording: say so under its own identifier, so the slot
      // that names it can skip a live read that will fail, and the refresh
      // does not queue it again every hour (migration 20261107020000).
      rows.push(row ?? { song_id: args.songId, show_date: day, identifier: args.storedIdentifier, status: "no_match", is_default: false, track_url: null, servers: [], file_name: null, title_on_tape: null, duration_s: null, match_score: null });
    } else if (item.unreachable) unreachable++;
  }

  const q = encodeURIComponent(`collection:GratefulDead AND date:[${day} TO ${day}]`);
  const search = await getJson(
    fetchFn,
    `https://archive.org/advancedsearch.php?q=${q}&fl[]=identifier&fl[]=date&fl[]=downloads&sort[]=downloads+desc&sort[]=avg_rating+desc&rows=10&output=json`,
    counter,
  );
  if (!search.ok) return { rows: [], unreachable: true, requests: counter.n };
  const docs: Array<{ identifier: string; date?: string }> = (search.json?.response?.docs ?? []).filter(
    (d: { date?: string }) => typeof d.date === "string" && d.date.slice(0, 10) === day,
  );
  if (docs.length === 0) {
    return {
      rows: [{ song_id: args.songId, show_date: day, identifier: "", status: "no_tape", is_default: true, track_url: null, servers: [], file_name: null, title_on_tape: null, duration_s: null, match_score: null }],
      unreachable: false,
      requests: counter.n,
    };
  }

  for (const doc of docs) {
    // Only a playable row can become the night's answer; a "not on this
    // recording" row for the same item means this doc is skipped.
    if (rows.some((r) => r.identifier === doc.identifier && r.status !== "playable")) continue;
    const already = rows.find((r) => r.identifier === doc.identifier);
    if (already) { already.is_default = true; return { rows, unreachable: false, requests: counter.n }; }
    const item = await readItem(fetchFn, doc.identifier, counter);
    if (!item.meta) { if (item.unreachable) unreachable++; continue; }
    const row = playableRow(args.songId, day, item.id, item.meta, args.songTitle, true);
    if (row) {
      const dup = rows.findIndex((r) => r.identifier === row.identifier);
      if (dup >= 0) rows.splice(dup, 1);
      rows.push(row);
      return { rows, unreachable: false, requests: counter.n };
    }
  }

  if (unreachable > 0) return { rows, unreachable: true, requests: counter.n };
  rows.push({ song_id: args.songId, show_date: day, identifier: "", status: "no_match", is_default: true, track_url: null, servers: [], file_name: null, title_on_tape: null, duration_s: null, match_score: null });
  return { rows, unreachable: false, requests: counter.n };
}

/**
 * The song's undated answer: what findArchiveRecording (the player's
 * generic search) would play. Same query — the title as a phrase, best
 * rated first, ten rows — and the same first-with-a-track rule. The row is
 * stored under the tape's own night and flagged is_song_default.
 */
export async function resolveSong(
  fetchFn: FetchFn,
  args: { songId: string; songTitle: string },
): Promise<ResolveNightResult> {
  const counter = { n: 0 };
  const clean = args.songTitle.replace(/["!?.,;:()\[\]]/g, "").trim();
  const q = encodeURIComponent(`collection:GratefulDead "${clean}"`);
  const search = await getJson(fetchFn, `https://archive.org/advancedsearch.php?q=${q}&fl=identifier,date,avg_rating,venue&sort[]=avg_rating+desc&output=json&rows=10`, counter);
  if (!search.ok) return { rows: [], unreachable: true, requests: counter.n };
  const docs: Array<{ identifier: string; date?: string }> = search.json?.response?.docs ?? [];
  let unreachable = 0;
  for (const doc of docs) {
    const day = typeof doc.date === "string" ? doc.date.slice(0, 10) : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < "1965-01-01" || day > "1995-12-31") continue;
    const item = await readItem(fetchFn, doc.identifier, counter);
    if (!item.meta) { if (item.unreachable) unreachable++; continue; }
    const row = playableRow(args.songId, day, item.id, item.meta, args.songTitle, false);
    if (row) return { rows: [{ ...row, is_song_default: true }], unreachable: false, requests: counter.n };
  }
  // Nothing to store either way: an undated slot with no tape is answered by
  // the live search, which already says "no tape circulates".
  return { rows: [], unreachable: unreachable > 0, requests: counter.n };
}
