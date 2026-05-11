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
 * Normalize a string for fuzzy comparison: lowercase, drop apostrophes, then
 * everything non-alphanumeric becomes a space. Strip file extensions and the
 * common "d1t03 - " / "03 - " track-number prefixes that come from archive.org.
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\.[^.]+$/, "")              // strip file extension
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

function findBestTrack(files: any[], songTitle: string): { file: any; score: number } | null {
  const audioFiles = files.filter(isAudioFile);
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
  return bestFile && bestScore >= 60 ? { file: bestFile, score: bestScore } : null;
}

/**
 * Try fetching metadata for an identifier, with fallback variants
 * (e.g. stripping .flac16 suffix which often has empty metadata).
 */
async function fetchMetadataWithFallback(identifier: string): Promise<{ files: any[]; resolvedId: string } | null> {
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
        const res = await fetch(`https://archive.org/metadata/${id}`);
        if (!res.ok) {
          if (attempt === 0 && (res.status >= 500 || res.status === 429)) {
            await new Promise((r) => setTimeout(r, 600));
            continue;
          }
          break;
        }
        const meta = await res.json();
        const files = meta.files || [];
        if (files.length > 0) return { files, resolvedId: id };
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

  const best = findBestTrack(meta.files, songTitle);
  if (best) {
    return `https://archive.org/download/${meta.resolvedId}/${encodeURIComponent(best.file.name)}`;
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
      const res = await fetch(apiUrl);
      if (!res.ok) {
        cache.set(key, null);
        return null;
      }
      const data = await res.json();
      let docs: any[] = data?.response?.docs || [];

      // Belt-and-suspenders: drop any doc whose date falls outside the era window
      // (in case archive.org's date field is malformed or the search ignores the clause).
      if (hasEra) {
        docs = docs.filter((d) => {
          if (!d.date) return false;
          const yr = parseInt(String(d.date).slice(0, 4), 10);
          return Number.isFinite(yr) && yr >= yearStart! && yr <= yearEnd!;
        });
      }

      if (docs.length === 0) {
        cache.set(key, null);
        return null;
      }

      // Try each result to find one where we can match a specific track
      for (const doc of docs) {
        const identifier = doc.identifier;
        try {
          const metaRes = await fetch(`https://archive.org/metadata/${identifier}`);
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

export async function findManyArchiveRecordings(
  songTitle: string,
  maxResults = 50
): Promise<ArchiveVersion[]> {
  const key = songTitle.toLowerCase().trim();
  if (multiCache.has(key)) return multiCache.get(key)!;

  try {
    // Strip punctuation that can break archive.org's quoted phrase search (e.g. "Slipknot!")
    const cleanTitle = songTitle.replace(/["!?.,;:()\[\]]/g, "").trim();
    const query = encodeURIComponent(`collection:GratefulDead "${cleanTitle}"`);
    const apiUrl = `https://archive.org/advancedsearch.php?q=${query}&fl=identifier,date,avg_rating,venue&sort[]=avg_rating+desc&output=json&rows=${maxResults}`;
    const res = await fetch(apiUrl);
    if (!res.ok) return [];
    const data = await res.json();
    const docs = data?.response?.docs;
    if (!docs || docs.length === 0) return [];

    const versions: ArchiveVersion[] = docs.map((doc: any) => ({
      identifier: doc.identifier,
      url: `https://archive.org/details/${doc.identifier}`,
      date: doc.date ? doc.date.split("T")[0] : null,
      venue: doc.venue || null,
      avgRating: doc.avg_rating ? Number(doc.avg_rating) : null,
    }));

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
