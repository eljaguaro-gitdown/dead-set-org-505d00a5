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
}

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

/**
 * Normalize a string for fuzzy comparison: lowercase, drop apostrophes, then
 * everything non-alphanumeric becomes a space. Strip file extensions and the
 * common "d1t03 - " / "03 - " track-number prefixes that come from archive.org.
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\bgood\s+times\s+blues\b/g, "good time blues")
    // Real audio extensions only. The old /\.[^.]+$/ also truncated any title
    // with an abbreviation in it — "c.c. rider" became "c.c" — so a track and a
    // song could only match when both happened to be mangled identically.
    .replace(/\.(flac|mp3|ogg|oga|shn|m4a|aac|wav|aiff?|opus|wma|ape)$/i, "")
    .replace(/^d\d+t\d+\s*[-.]?\s*/i, "") // strip "d1t03 - " prefix
    .replace(/^t?\d+\s*[-.]?\s*/, "")     // strip "03 - " or "t03." prefix
    .replace(/[''`]/g, "")                // drop apostrophes (truckin' = truckin)
    .replace(/[^a-z0-9]+/g, " ")          // any other non-alnum → space
    .replace(/\s+/g, " ")
    .trim();
}

/** Collapse all whitespace — used for whole-string comparisons that should
 * ignore spacing/hyphenation differences ("Half-Step" vs "Half Step"). */
function compact(s: string): string {
  return normalize(s).replace(/\s+/g, "");
}

const STOP_WORDS = new Set([
  "the", "a", "an", "of", "in", "on", "to", "and", "is", "it", "be",
  "at", "for", "with", "my", "i", "you", "your", "as", "or", "by",
]);

/** Tokenize + stem common Dead-isms. "playin" → "playing", "darkstar" stays. */
function tokens(s: string): string[] {
  return normalize(s)
    .split(" ")
    .filter(Boolean)
    .map((t) => (t === "in" ? t : t.replace(/in$/, "ing")));
}

/**
 * Score how well a track title matches the desired song title.
 * Returns 0 for no match, higher is better. Threshold for a real match is 60.
 *
 * Strict by design: short substring overlaps that previously caused
 * "Mississippi Half Step" → "St. Stephen" (because "step" ⊂ "stephen") now
 * score 0. We only credit *whole-token* equality for the word-overlap path.
 */
function matchScore(trackTitle: string, songTitle: string): number {
  const ct = compact(trackTitle);
  const cs = compact(songTitle);
  if (!ct || !cs) return 0;

  // Whole-string matches (ignoring spacing/punctuation).
  if (ct === cs) return 100;
  if (cs.length >= 4 && ct.includes(cs)) return 90;
  if (ct.length >= 4 && cs.includes(ct)) return 85;

  // Significant-word overlap with strict equality (no substring fuzz).
  const trackTok = tokens(trackTitle).filter((t) => t.length > 1);
  const songTok = tokens(songTitle).filter((t) => t.length > 1);
  const trackSig = new Set(trackTok.filter((t) => !STOP_WORDS.has(t)));
  const songSig = new Set(songTok.filter((t) => !STOP_WORDS.has(t)));
  if (trackSig.size === 0 || songSig.size === 0) return 0;

  const overlap = [...songSig].filter((t) => trackSig.has(t)).length;

  // Same significant-word set — different ordering / fillers.
  if (overlap === songSig.size && overlap === trackSig.size) return 95;
  // Track contains every significant word of the song (song is a prefix/short form).
  if (overlap === songSig.size) return 80;
  // Song contains every significant word of the track (e.g. archive used short title).
  if (overlap === trackSig.size && overlap >= 2) return 70;

  return 0;
}

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
 * True when the band has asked the Archive to stream an item rather than
 * serve it as files. Soundboards carry this; audience tapes generally do not.
 *
 * Per archive.org's own Grateful Dead collection page: "Audience-made Grateful
 * Dead concert recordings are available as downloads while available
 * soundboards are accessible in streaming format only."
 *
 * We only ever stream, and MP3 derivatives are what archive.org's own player
 * streams, so this is not about withholding playback — it is about never
 * reaching for a restricted lossless ORIGINAL on those items. Doing so earns a
 * 403 (feeding the error rate) and is the one place the App Review notes'
 * claim that the band's policy is honored could be shown false.
 */
function isRestrictedItem(meta: { metadata?: Record<string, unknown> } | null): boolean {
  const md: Record<string, unknown> = meta?.metadata ?? {};
  if (String(md["access-restricted-item"]).toLowerCase() === "true") return true;
  const collection = md.collection;
  const list = Array.isArray(collection) ? collection : collection ? [collection] : [];
  return list.some((c: unknown) => String(c).toLowerCase() === "stream_only");
}

function isAudioFile(f: any): boolean {
  const fmt = f.format || "";
  const name = (f.name || "").toLowerCase();
  return (
    fmt === "VBR MP3" ||
    fmt === "Ogg Vorbis" ||
    fmt === "Flac" ||
    fmt === "24bit Flac" ||
    name.endsWith(".mp3") ||
    name.endsWith(".ogg") ||
    name.endsWith(".flac")
  );
}

function isMp3(f: any): boolean {
  return f.format === "VBR MP3" || (f.name || "").toLowerCase().endsWith(".mp3");
}

/** Lossy derivatives archive.org generates for streaming — never the original. */
function isDerivative(f: { name?: string; format?: string }): boolean {
  const name = (f.name || "").toLowerCase();
  return (
    f.format === "VBR MP3" ||
    f.format === "Ogg Vorbis" ||
    name.endsWith(".mp3") ||
    name.endsWith(".ogg")
  );
}

function findBestTrack(
  files: any[],
  songTitle: string,
  opts: { restricted?: boolean } = {},
): { file: any; score: number } | null {
  // On a restricted item only derivatives are eligible. Elsewhere FLAC stays
  // a last resort — it loses to MP3 on ties below, and AVPlayer cannot stream
  // it on iOS anyway, but it is better than nothing on the web.
  const audioFiles = files.filter(opts.restricted ? isDerivative : isAudioFile);
  let bestScore = 0;
  let bestFile: any = null;
  for (const f of audioFiles) {
    const title = f.title || f.name || "";
    const score = matchScore(title, songTitle);
    // MP3 wins ties: FLAC originals and their MP3 derivatives carry the same
    // title, but raw FLAC won't stream through AVPlayer in the iOS app —
    // MP3 plays everywhere.
    if (score > bestScore || (score === bestScore && bestFile && !isMp3(bestFile) && isMp3(f))) {
      bestScore = score;
      bestFile = f;
    }
  }
  return bestFile && bestScore >= 60 ? { file: bestFile, score: bestScore } : null;
}

/**
 * Try fetching metadata for an identifier, with fallback variants
 * (e.g. stripping .flac16 suffix which often has empty metadata).
 */
async function fetchMetadataWithFallback(
  identifier: string,
): Promise<{ files: any[]; resolvedId: string; restricted: boolean } | null> {
  const variants = [identifier];
  // Many AI-generated URLs use .flac16 suffix identifiers that have empty metadata;
  // the base identifier (without .flac16) usually works
  if (/\.flac\d*$/i.test(identifier)) {
    variants.push(identifier.replace(/\.flac\d*$/i, ""));
  }
  for (const id of variants) {
    // One retry for transient archive.org failures (504/503 are common).
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetchArchive(`https://archive.org/metadata/${id}`);
        if (!res.ok) {
          if (attempt === 0 && (res.status >= 500 || res.status === 429)) {
            await new Promise((r) => setTimeout(r, 600));
            continue;
          }
          break;
        }
        const meta = await res.json();
        const files = meta.files || [];
        if (files.length > 0) {
          return { files, resolvedId: id, restricted: isRestrictedItem(meta) };
        }
        break;
      } catch {
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 600));
          continue;
        }
      }
    }
  }
  return null;
}

export async function findTrackInRecording(
  archiveUrl: string,
  songTitle: string
): Promise<string | null> {
  const match = archiveUrl.match(/archive\.org\/details\/([^/?#]+)/);
  const identifier = match?.[1];
  if (!identifier) return null;

  const meta = await fetchMetadataWithFallback(identifier);
  if (!meta) return null;

  const best = findBestTrack(meta.files, songTitle, { restricted: meta.restricted });
  if (best) {
    return `https://archive.org/download/${meta.resolvedId}/${encodeURIComponent(best.file.name)}`;
  }

  if (meta.restricted) {
    console.warn(
      `[QA] "${songTitle}" in ${meta.resolvedId}: stream-only item with no MP3 derivative — skipping rather than reaching for the restricted original`,
    );
    return null;
  }

  console.warn(
    `[QA] No track match for "${songTitle}" in ${meta.resolvedId} (best score: 0)`
  );
  return null;
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
      for (const doc of docs) {
        const identifier = doc.identifier;
        try {
          const metaRes = await fetchArchive(`https://archive.org/metadata/${identifier}`);
          if (!metaRes.ok) continue;
          const meta = await metaRes.json();
          const audioFiles = (meta.files || []).filter(
            (f: any) =>
              f.format === "VBR MP3" ||
              f.format === "Ogg Vorbis" ||
              f.name?.endsWith(".mp3") ||
              f.name?.endsWith(".ogg")
          );

          let bestScore = 0;
          let bestFile: any = null;
          for (const f of audioFiles) {
            const title = f.title || f.name || "";
            const score = matchScore(title, songTitle);
            if (score > bestScore) {
              bestScore = score;
              bestFile = f;
            }
          }

          if (bestFile && bestScore >= 60) {
            const result: ArchiveResult = {
              url: `https://archive.org/details/${identifier}`,
              date: doc.date ? doc.date.split("T")[0] : null,
              venue: doc.venue || null,
              directTrackUrl: `https://archive.org/download/${identifier}/${encodeURIComponent(bestFile.name)}`,
            };
            cache.set(key, result);
            return result;
          }
        } catch {
          continue;
        }
      }

      // Fallback: return first (era-filtered) result without direct track
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
    if (!meta) return "unknown";
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
    const apiUrl = `https://archive.org/advancedsearch.php?q=${query}&fl=identifier,date,avg_rating,venue&sort[]=avg_rating+desc&output=json&rows=${maxResults}`;
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
