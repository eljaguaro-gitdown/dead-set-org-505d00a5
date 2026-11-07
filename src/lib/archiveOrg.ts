/**
 * Archive.org Grateful Dead collection lookup.
 * Searches the public API for the highest-rated recording of a given song
 * and returns the archive.org details URL along with show metadata.
 */

export interface ArchiveResult {
  url: string;
  date: string | null;
  venue: string | null;
  /** Direct track URL for the specific song if found */
  directTrackUrl?: string | null;
  /**
   * The same track on the item's own server, when the tape index knows it
   * (src/lib/tapeIndex.ts). The engine streams from here and skips the
   * /download/ redirect; directTrackUrl stays the track's identity.
   */
  streamUrl?: string | null;
}

/**
 * The day part of a show date, or null when there is no usable night.
 * Tolerates the empty strings decodeArchiveNotes writes for an unknown date
 * and the full timestamps the catalog sometimes carries.
 */
export const archiveKeyDate = (showDate: string | null | undefined): string | null => {
  const day = (showDate || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
};

/**
 * Lookup key for a resolved recording: a song on a specific night, or the song
 * alone when no night is known. Resolving by title alone is only correct when
 * no two slots of the same song want different nights — which is exactly what a
 * listening guide is, so anything holding a map of these must key on the night.
 */
export const archiveKey = (title: string, date: string | null): string =>
  date ? `${title.toLowerCase().trim()}@${date}` : title.toLowerCase().trim();

const cache = new Map<string, ArchiveResult | null>();
const inflight = new Map<string, Promise<ArchiveResult | null>>();

/** Build a stable cache key that includes the era window (if any). */
function cacheKey(songTitle: string, yearStart?: number | null, yearEnd?: number | null): string {
  const base = songTitle.toLowerCase().trim();
  if (yearStart && yearEnd) return `${base}::${yearStart}-${yearEnd}`;
  return base;
}

/**
 * True when an archive.org date string falls inside an inclusive year window.
 * Tolerates the malformed/missing dates the Archive occasionally carries.
 */
export function isYearInWindow(
  date: string | null | undefined,
  yearStart: number,
  yearEnd: number,
): boolean {
  if (!date) return false;
  const yr = parseInt(String(date).slice(0, 4), 10);
  return Number.isFinite(yr) && yr >= yearStart && yr <= yearEnd;
}

import {
  findBestTrack,
  isRestrictedItem,
  itemServerRoots,
  matchScore,
  normalize,
} from "../../supabase/functions/_shared/tapeMatch.ts";

export { matchScore, normalize };

/**
 * Given a specific archive.org URL and a song title, find the direct track URL
 * within that specific recording. This avoids the generic search which can
 * return tracks from entirely different shows.
 */
/**
 * archive.org can hang rather than fail. Nothing here carried an
 * AbortController, so a stalled request left the player's isLoading state
 * (defined as !directTrackUrl) true forever. The player now has a watchdog,
 * but failing fast at the source is better than being rescued at 25s.
 */
const ARCHIVE_TIMEOUT_MS = 12_000;

async function fetchArchive(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ARCHIVE_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Try fetching metadata for an identifier, with fallback variants
 * (e.g. stripping .flac16 suffix which often has empty metadata).
 */
/**
 * Why this reports `unreachable` rather than just `null`.
 *
 * It used to return `null` for two different things: the item was READ and has
 * no files (an answer), and the request never completed — a 5xx after its
 * retry, a timeout, a rejected fetch (not an answer). `findTrackInRecording`
 * collapsed both into `null`, so with the network down the player said "That
 * song isn't on this tape" about a tape nobody had managed to open.
 *
 * A failing STATUS is a resolved promise, which is why a `catch` on the caller
 * could never see it — the exact trap banked in CLAUDE.md, walked into again.
 */
type MetadataResult =
  | { kind: "read"; files: any[]; resolvedId: string; restricted: boolean }
  | { kind: "failed"; unreachable: boolean };

async function fetchMetadataWithFallback(
  identifier: string,
): Promise<MetadataResult> {
  const variants = [identifier];
  // Many AI-generated URLs use .flac16 suffix identifiers that have empty metadata;
  // the base identifier (without .flac16) usually works
  if (/\.flac\d*$/i.test(identifier)) {
    variants.push(identifier.replace(/\.flac\d*$/i, ""));
  }
  // Sticky across variants: if ANY attempt failed to complete, we never got a
  // clean answer about this item, whatever a later variant returned.
  let unreachable = false;
  for (const id of variants) {
    // One retry for transient archive.org failures (504/503 are common).
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetchArchive(`https://archive.org/metadata/${id}`);
        if (!res.ok) {
          if (res.status >= 500 || res.status === 429) {
            // A server failure is not an answer about the music, even after
            // the retry is spent.
            unreachable = true;
            if (attempt === 0) {
              await new Promise((r) => setTimeout(r, 600));
              continue;
            }
          }
          break;
        }
        const meta = await res.json();
        const files = meta.files || [];
        if (files.length > 0) {
          return { kind: "read", files, resolvedId: id, restricted: isRestrictedItem(meta) };
        }
        break;
      } catch {
        unreachable = true;
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 600));
          continue;
        }
      }
    }
  }
  return { kind: "failed", unreachable };
}

/**
 * The track URL, AND whether we actually got to ask.
 *
 * `findTrackInRecording` below keeps the old `string | null` contract for the
 * legacy player; anything that needs to tell "not on this tape" from "could
 * not reach the Archive" must call this one.
 */
export async function findTrackInRecordingDetailed(
  archiveUrl: string,
  songTitle: string,
): Promise<{ url: string | null; unreachable: boolean }> {
  const res = await findTrackInner(archiveUrl, songTitle);
  return res;
}

export async function findTrackInRecording(
  archiveUrl: string,
  songTitle: string
): Promise<string | null> {
  return (await findTrackInner(archiveUrl, songTitle)).url;
}

async function findTrackInner(
  archiveUrl: string,
  songTitle: string
): Promise<{ url: string | null; unreachable: boolean }> {
  const match = archiveUrl.match(/archive\.org\/details\/([^/?#]+)/);
  const identifier = match?.[1];
  if (!identifier) return { url: null, unreachable: false };

  const meta = await fetchMetadataWithFallback(identifier);
  if (meta.kind === "failed") return { url: null, unreachable: meta.unreachable };

  const best = findBestTrack(meta.files, songTitle, { restricted: meta.restricted });
  if (best) {
    return {
      url: `https://archive.org/download/${meta.resolvedId}/${encodeURIComponent(best.file.name)}`,
      unreachable: false,
    };
  }

  if (meta.restricted) {
    console.warn(
      `[QA] "${songTitle}" in ${meta.resolvedId}: stream-only item with no MP3 derivative — skipping rather than reaching for the restricted original`,
    );
    return { url: null, unreachable: false };
  }

  console.warn(
    `[QA] No track match for "${songTitle}" in ${meta.resolvedId} (best score: 0)`
  );
  // Read the tape, the song is not on it. A real answer.
  return { url: null, unreachable: false };
}

/**
 * The other addresses a /download/ track can be streamed from: the item's own
 * servers, as the metadata API lists them, in the order it lists them.
 *
 * Why this exists. `archive.org/download/<id>/<file>` is a redirect, and the
 * Archive picks the mirror. On 2026-10-31 it sent about 11 of 12 requests for
 * Jack Straw 10/19/71 (that song's debut) to a mirror answering 500. A full GET
 * came back as an HTML error page, which Safari reports as MediaError code 4.
 * The item's own servers (`workable_servers`, with `dir`) returned 206 every
 * time. The tape was fine. The player gave up on the first error.
 *
 * The player only calls this after the Archive's own routing has failed. The
 * redirect stays the first try for every track, because a mirror the Archive
 * routes around is its decision to make, not ours.
 *
 * Two answers, kept apart for the same reason as findTrackInRecordingDetailed:
 *
 *   urls        — the metadata read, and these are its servers. Empty means
 *                 the item lists none, which is an answer. Cached per
 *                 identifier for the session, since every track of an item
 *                 lives on the same servers.
 *   unreachable — the metadata request failed: a rejection, a timeout (on the
 *                 headers or the body), a 5xx or 429 after its retry, or a
 *                 body that was not JSON. We
 *                 learned nothing. Not cached, so the next failure asks again.
 *
 * Never throws. A failing status is a resolved promise, so a `catch` at the
 * call site could not have seen one anyway.
 */
export async function archiveMirrorUrls(
  trackUrl: string,
): Promise<{ urls: string[]; unreachable: boolean }> {
  const m = trackUrl.match(/^https:\/\/archive\.org\/download\/([^/?#]+)\/([^?#]+)$/);
  if (!m) return { urls: [], unreachable: false };
  const [, identifier, file] = m;
  let roots = mirrorRoots.get(identifier);
  if (!roots) {
    const read = await readItemServers(identifier);
    if (!read) return { urls: [], unreachable: true };
    roots = read;
    mirrorRoots.set(identifier, roots);
  }
  return { urls: roots.map((root) => `${root}/${file}`), unreachable: false };
}

/** identifier → `https://<server><dir>` for each of the item's own servers. */
const mirrorRoots = new Map<string, string[]>();

/**
 * Seed an item's servers from the tape index, so a failover off a broken
 * address needs no metadata read. Only Archive roots are accepted.
 */
export function primeMirrorRoots(identifier: string, roots: string[]): void {
  const ok = roots.filter((r) => /^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.archive\.org\/[^?#\s]*$/i.test(r));
  if (identifier && ok.length > 0 && !mirrorRoots.has(identifier)) mirrorRoots.set(identifier, ok);
}

/** Test seam: forget every item's servers. */
export function resetArchiveMirrors(): void {
  mirrorRoots.clear();
}

/**
 * fetchArchive's timer covers the headers only: it is cleared once fetch()
 * resolves. A body that then stops arriving left a failover looking forever,
 * with the bar busy and nothing filed. Give the body the same cap.
 */
async function readJsonWithin(res: Response, ms = ARCHIVE_TIMEOUT_MS): Promise<any> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      res.json(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("archive.org body timed out")), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** The item's server roots, or null when the metadata could not be read. */
async function readItemServers(identifier: string): Promise<string[] | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchArchive(`https://archive.org/metadata/${identifier}`);
      if (res.status >= 500 || res.status === 429) {
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 600));
          continue;
        }
        return null;
      }
      // A 404 is an answer: there is no such item, so it has no servers.
      if (!res.ok) return [];
      const meta = await readJsonWithin(res);
      const roots = itemServerRoots(meta);
      return roots;
    } catch {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 600));
        continue;
      }
    }
  }
  return null;
}

/** The fields we ask advancedsearch.php for, and the only ones we read. */
interface ArchiveSearchDoc {
  identifier: string;
  date?: string;
  venue?: string;
  avg_rating?: string | number;
  downloads?: number;
}

/**
 * Thrown when every candidate recording was passed over because we could not
 * read it — a 5xx, a 429, a timeout. It means "could not ask the Archive",
 * which is categorically different from "the song is not on these tapes", and
 * the two must not collapse into one null (see the error-contract rule in
 * CLAUDE.md). Callers decide: the by-date lookup lets it out so nothing is
 * cached, the by-song lookup swallows it like every other failure.
 */
export class ArchiveUnreachable extends Error {
  constructor(readonly tried: number) {
    super(`archive.org unreadable for all ${tried} candidate recordings`);
    this.name = "ArchiveUnreachable";
  }
}

/**
 * Given search hits, return the first recording we can pin the song to an
 * actual track inside. Shared by the by-song and by-date lookups — the two
 * disagreeing about what counts as a match is exactly the kind of silent
 * divergence a second copy of this loop would create.
 *
 * Candidates arrive most-downloaded first (ties by rating) and are walked in
 * that order, so a tape we cannot read costs only its own turn.
 *
 * TWO WAYS TO PASS OVER A CANDIDATE, and they are not the same answer:
 *
 *   unreachable — the metadata request failed. We learned nothing about this
 *                 tape. Counted, and if NOTHING matched and at least one
 *                 candidate was unreachable, this throws rather than
 *                 reporting a negative we did not establish.
 *   no match    — the metadata read fine and carries no track for this song.
 *                 That is a real finding about this tape. An item that no
 *                 longer exists answers `{}`, which lands here correctly: we
 *                 successfully learned it has no files.
 *
 * Returning null therefore means "every candidate was read, none had it".
 * Only that is safe to cache.
 *
 * Scoring goes through findBestTrack rather than a private copy of the loop.
 * The copy that used to live here filtered with the equivalent of
 * `isDerivative`, i.e. as though every item were stream-restricted, so a
 * FLAC-only tape was invisible to the search while the stored-URL path
 * accepted it — the same two-copies divergence this function's own docstring
 * warns about, one level down.
 */
async function pickRecordingWithTrack(
  docs: ArchiveSearchDoc[],
  songTitle: string,
): Promise<ArchiveResult | null> {
  let unreachable = 0;
  for (const doc of docs) {
    const identifier = doc.identifier;
    try {
      const metaRes = await fetchArchive(`https://archive.org/metadata/${identifier}`);
      if (!metaRes.ok) {
        unreachable++;
        continue;
      }
      const meta = await metaRes.json();
      const best = findBestTrack(meta.files || [], songTitle, {
        restricted: isRestrictedItem(meta),
      });
      if (best) {
        return {
          url: `https://archive.org/details/${identifier}`,
          date: doc.date ? doc.date.split("T")[0] : null,
          venue: doc.venue || meta.metadata?.venue || meta.metadata?.coverage || null,
          directTrackUrl: `https://archive.org/download/${identifier}/${encodeURIComponent(best.file.name)}`,
        };
      }
    } catch {
      unreachable++;
    }
  }
  if (unreachable > 0) throw new ArchiveUnreachable(unreachable);
  return null;
}

const dateCache = new Map<string, ArchiveResult | null>();
const dateInflight = new Map<string, Promise<ArchiveResult | null>>();

/**
 * Find a circulating recording of one specific night that contains one
 * specific song — the lookup behind "first time played" / "last time played".
 *
 * Unlike findArchiveRecording, a miss here is a real answer, not a failure:
 * plenty of nights the Dead played were never taped, or the tape never
 * reached the Archive. Callers show the date anyway and say so.
 *
 * A failed request is not a miss. It throws and is not cached, so a 503 or a
 * timeout never turns into "no tape of this night circulates", and the next
 * lookup tries again.
 */
export async function findRecordingForDate(
  songTitle: string,
  date: string,
): Promise<ArchiveResult | null> {
  const day = date.slice(0, 10);
  const key = `${songTitle.toLowerCase().trim()}@${day}`;
  if (dateCache.has(key)) return dateCache.get(key)!;
  if (dateInflight.has(key)) return dateInflight.get(key)!;

  const promise = (async () => {
    try {
      const q = encodeURIComponent(`collection:GratefulDead AND date:[${day} TO ${day}]`);
      const apiUrl = `https://archive.org/advancedsearch.php?q=${q}&fl[]=identifier&fl[]=date&fl[]=venue&fl[]=avg_rating&fl[]=downloads&sort[]=downloads+desc&sort[]=avg_rating+desc&rows=10&output=json`;
      const res = await fetchArchive(apiUrl);
      if (!res.ok) throw new Error(`archive.org search ${res.status}`);
      const data = await res.json();
      const docs: ArchiveSearchDoc[] = (
        (data?.response?.docs || []) as ArchiveSearchDoc[]
      ).filter((d) => isSameArchiveDay(d.date, day));
      if (docs.length === 0) {
        dateCache.set(key, null);
        return null;
      }

      const withTrack = await pickRecordingWithTrack(docs, songTitle);
      if (withTrack) {
        dateCache.set(key, withTrack);
        return withTrack;
      }

      // Every candidate was read and none carried the song — a partial
      // recording, or a title we could not match. Still the night, so keep it
      // and cache it. (Had any candidate been unreadable, pickRecordingWithTrack
      // would have thrown instead, and this `try` has no `catch`, so the
      // rejection leaves without touching dateCache and the night is retried.)
      const doc = docs[0];
      const result: ArchiveResult = {
        url: `https://archive.org/details/${doc.identifier}`,
        date: day,
        venue: doc.venue || null,
        directTrackUrl: null,
      };
      dateCache.set(key, result);
      return result;
    } finally {
      dateInflight.delete(key);
    }
  })();

  dateInflight.set(key, promise);
  return promise;
}

/** archive.org returns 1971-10-19T00:00:00Z; compare only the day. */
export function isSameArchiveDay(archiveDate: string | null | undefined, day: string): boolean {
  if (!archiveDate) return false;
  return archiveDate.slice(0, 10) === day.slice(0, 10);
}

export async function findArchiveRecording(
  songTitle: string,
  yearStart?: number | null,
  yearEnd?: number | null
): Promise<ArchiveResult | null> {
  const key = cacheKey(songTitle, yearStart, yearEnd);
  if (cache.has(key)) return cache.get(key)!;
  if (inflight.has(key)) return inflight.get(key)!;

  const hasEra = !!(yearStart && yearEnd);
  const eraDateClause = hasEra
    ? ` AND date:[${yearStart}-01-01 TO ${yearEnd}-12-31]`
    : "";

  const promise = (async () => {
    try {
      const cleanTitle = songTitle.replace(/["!?.,;:()\[\]]/g, "").trim();
      const query = encodeURIComponent(
        `collection:GratefulDead "${cleanTitle}"${eraDateClause}`
      );
      const apiUrl = `https://archive.org/advancedsearch.php?q=${query}&fl=identifier,date,avg_rating,venue&sort[]=avg_rating+desc&output=json&rows=10`;
      const res = await fetchArchive(apiUrl);
      if (!res.ok) {
        cache.set(key, null);
        return null;
      }
      const data = await res.json();
      let docs: any[] = data?.response?.docs || [];

      // Belt-and-suspenders: drop any doc whose date falls outside the era window
      // (in case archive.org's date field is malformed or the search ignores the clause).
      if (hasEra) {
        docs = docs.filter((d) => isYearInWindow(d.date, yearStart!, yearEnd!));
      }

      if (docs.length === 0) {
        cache.set(key, null);
        return null;
      }

      // Try each result to find one where we can match a specific track
      const withTrack = await pickRecordingWithTrack(docs, songTitle);
      if (withTrack) {
        cache.set(key, withTrack);
        return withTrack;
      }
      // Fallback: every candidate read, none matched — return the first with
      // no direct track. An ArchiveUnreachable instead lands in this
      // function's catch below, which caches null: wrong in principle, but it
      // is this lookup's long-standing contract that any failure reads as "no
      // tape", and findRecordingForDate is the one that must stay honest.
      const doc = docs[0];
      const result: ArchiveResult = {
        url: `https://archive.org/details/${doc.identifier}`,
        date: doc.date ? doc.date.split("T")[0] : null,
        venue: doc.venue || null,
        directTrackUrl: null,
      };
      cache.set(key, result);
      return result;
    } catch {
      cache.set(key, null);
      return null;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

/**
 * Search Archive.org for MANY recordings of a given song, returning metadata
 * for each. Used to let users browse all available versions.
 */
export interface ArchiveVersion {
  identifier: string;
  url: string;
  date: string | null;
  venue: string | null;
  avgRating: number | null;
  /** How many reviews back that rating — a 5.0 off one review is not a 5.0. */
  reviews: number | null;
  /** How often the tape gets pulled. The attention half of the gem signal. */
  downloads: number | null;
  directTrackUrl?: string | null;
}

const multiCache = new Map<string, ArchiveVersion[]>();

/** Enough confirmed tapes to fill the browser — stop checking past this. */
const VERIFIED_TARGET = 24;
/**
 * Ceiling on metadata fetches per search. A song with no tape in the window
 * (ask for Crazy Fingers in 1974 — it debuted in 1975) fails every check, and
 * without this it would walk the entire candidate list to prove it.
 */
const MAX_VERIFY_CHECKS = 36;
const VERIFY_CONCURRENCY = 6;

/**
 * Three states on purpose. "We could not check" is not "there is no tape":
 * archive.org times out, rate-limits, and occasionally 503s, and collapsing
 * that into `false` makes a real recording vanish from the browser at random.
 * It cost a version of this filter its own correctness — the same tape was
 * dropped on one run and kept on the next.
 */
type TrackPresence = "present" | "absent" | "unknown";

async function checkRecordingForTrack(
  identifier: string,
  songTitle: string,
): Promise<TrackPresence> {
  try {
    const meta = await fetchMetadataWithFallback(identifier);
    // No metadata means the check did not happen, not that the tape is empty.
    if (meta.kind === "failed") return "unknown";
    // Same threshold the player uses to decide what to play, so the browser
    // cannot offer a version that playback would then refuse.
    return findBestTrack(meta.files, songTitle, { restricted: meta.restricted }) !== null
      ? "present"
      : "absent";
  } catch {
    return "unknown";
  }
}

/**
 * Keep only the recordings that actually contain the song.
 *
 * The search that produced these matched archive.org's *item* text — the
 * collection, the description, whatever else is indexed — not its track list.
 * So a 1974 show comes back for a song first played in 1975, and nothing
 * downstream notices: it gets added to a setlist, rendered with a real date
 * and venue, and only fails at play time with "Couldn't find X in this
 * recording" — or, if the playability precompute has run, as a "no tape" badge
 * on a slot the user deliberately chose.
 *
 * Only a confirmed absence removes a version. A recording we could not check
 * is kept: the player refuses to play audio it cannot match anyway, so an
 * unverifiable tape degrades to the old behaviour instead of disappearing.
 *
 * Verified in order so the rating sort survives, with bounded concurrency and
 * an early stop, because each check costs one metadata fetch.
 */
export async function keepRecordingsContainingSong(
  versions: ArchiveVersion[],
  songTitle: string,
  opts: { target?: number; maxChecks?: number; concurrency?: number } = {},
): Promise<ArchiveVersion[]> {
  const target = opts.target ?? VERIFIED_TARGET;
  const maxChecks = opts.maxChecks ?? MAX_VERIFY_CHECKS;
  const concurrency = Math.max(1, opts.concurrency ?? VERIFY_CONCURRENCY);

  const kept: ArchiveVersion[] = [];
  let checked = 0;
  let confirmedAbsent = 0;

  for (let i = 0; i < versions.length; i += concurrency) {
    if (kept.length >= target || checked >= maxChecks) break;
    const batch = versions.slice(i, i + concurrency);
    checked += batch.length;
    const presence = await Promise.all(
      batch.map((v) => checkRecordingForTrack(v.identifier, songTitle)),
    );
    batch.forEach((v, j) => {
      if (presence[j] === "absent") confirmedAbsent++;
      else kept.push(v);
    });
  }

  // Candidates past `checked` are deliberately not carried over. Stopping
  // early is a budget decision, not evidence — "here are the ones we could
  // confirm out of the first N" is honest; padding the list with unverified
  // ones would put the bad versions straight back.

  if (confirmedAbsent > 0) {
    console.warn(
      `[QA] "${songTitle}": dropped ${confirmedAbsent} of ${checked} candidate recording(s) that do not contain the track — the search matches item text, not track lists`,
    );
  }

  return kept;
}

export async function findManyArchiveRecordings(
  songTitle: string,
  maxResults = 50,
  yearStart?: number | null,
  yearEnd?: number | null
): Promise<ArchiveVersion[]> {
  const key = cacheKey(songTitle, yearStart, yearEnd);
  if (multiCache.has(key)) return multiCache.get(key)!;

  // Narrow at the *query*, not after the fact. Archive.org sorts by rating and
  // we only take `maxResults` rows, so filtering a global top-50 down to a year
  // window can come back empty even when hundreds of in-window tapes circulate.
  const hasWindow = !!(yearStart && yearEnd);
  const windowDateClause = hasWindow
    ? ` AND date:[${yearStart}-01-01 TO ${yearEnd}-12-31]`
    : "";

  try {
    // Strip punctuation that can break archive.org's quoted phrase search (e.g. "Slipknot!")
    const cleanTitle = songTitle.replace(/["!?.,;:()\[\]]/g, "").trim();
    const query = encodeURIComponent(
      `collection:GratefulDead "${cleanTitle}"${windowDateClause}`
    );
    // Sorted by downloads, NOT by rating. Measured against the live API on
    // 2026-10-04: the top 50 of `sort=avg_rating desc` for "Ramble On Rose" is
    // fifty tapes rated exactly 5.0, every one of them on 1-6 reviews, one with
    // 461 downloads total. That is the noise floor of a 5-star-biased rating
    // system, not the best tapes — and it was burying 1973-06-10 (4.62 on 217
    // reviews, 1.28M downloads). Ranking by circulation gives the real
    // population, with ratings that actually vary (4.22–4.95), which is what
    // both the browser and the quiet-gem signal need to say anything true.
    const apiUrl = `https://archive.org/advancedsearch.php?q=${query}&fl=identifier,date,avg_rating,num_reviews,downloads,venue&sort[]=downloads+desc&output=json&rows=${maxResults}`;
    const res = await fetchArchive(apiUrl);
    if (!res.ok) return [];
    const data = await res.json();
    const docs = data?.response?.docs;
    if (!docs || docs.length === 0) return [];

    let versions: ArchiveVersion[] = docs.map((doc: any) => ({
      identifier: doc.identifier,
      url: `https://archive.org/details/${doc.identifier}`,
      date: doc.date ? doc.date.split("T")[0] : null,
      venue: doc.venue || null,
      avgRating: doc.avg_rating ? Number(doc.avg_rating) : null,
      reviews: doc.num_reviews != null ? Number(doc.num_reviews) : null,
      downloads: doc.downloads != null ? Number(doc.downloads) : null,
    }));

    // Belt-and-suspenders, same as findArchiveRecording: drop anything outside
    // the window in case archive.org's date field is malformed or the clause is
    // ignored. A version shown under "1974-1976" must actually be from it.
    if (hasWindow) {
      versions = versions.filter((v) => isYearInWindow(v.date, yearStart!, yearEnd!));
    }

    // The query above matched item text, not track lists. Confirm each tape
    // actually contains the song before anyone can pick it — a version offered
    // here ends up in a setlist, and an empty list is the honest answer when
    // nothing circulates.
    versions = await keepRecordingsContainingSong(versions, songTitle);

    multiCache.set(key, versions);
    return versions;
  } catch {
    return [];
  }
}

/**
 * Batch lookup for multiple songs. Runs in parallel with a concurrency limit.
 */
export async function findArchiveRecordings(
  songTitles: string[]
): Promise<Map<string, ArchiveResult | null>> {
  const results = new Map<string, ArchiveResult | null>();
  const CONCURRENCY = 4;

  for (let i = 0; i < songTitles.length; i += CONCURRENCY) {
    const batch = songTitles.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (title) => {
        const result = await findArchiveRecording(title);
        return [title, result] as const;
      })
    );
    batchResults.forEach(([title, result]) => results.set(title, result));
  }

  return results;
}
