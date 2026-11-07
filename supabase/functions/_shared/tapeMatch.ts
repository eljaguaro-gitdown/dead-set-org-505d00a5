/**
 * The title matcher and the file filters the player uses to decide which
 * track of an Archive item is a song — shared, unmodified, by the browser
 * (src/lib/archiveOrg.ts) and the edge functions that index tapes ahead of
 * the tap (index-tapes). Two copies of this would be the silent-divergence
 * trap CLAUDE.md keeps banking: the server would index a track the player
 * would refuse, or miss one it would play. So there is one.
 *
 * Pure TypeScript with no imports: Deno, Vite and Vitest all load it as is.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

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
 * Score one title against one song, with no medley handling — see matchScore.
 *
 * Strict by design: short substring overlaps that previously caused
 * "Mississippi Half Step" → "St. Stephen" (because "step" ⊂ "stephen") now
 * score 0. We only credit *whole-token* equality for the word-overlap path.
 */
function scoreTitlePair(trackTitle: string, songTitle: string): number {
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

/**
 * Segue markers that join several songs under one track title. Tapers write the
 * whole suite as one file — "Help > Slipknot > Franklin's Tower", "Scarlet ->
 * Fire" — because that is how it was played.
 */
const SEGUE_SPLIT = /\s*(?:->|-->|→|>)\s*/;

/**
 * Score how well a track title matches the desired song title.
 * Returns 0 for no match, higher is better. Threshold for a real match is 60.
 *
 * Strict by design: short substring overlaps that previously caused
 * "Mississippi Half Step" → "St. Stephen" (because "step" ⊂ "stephen") now
 * score 0. We only credit *whole-token* equality for the word-overlap path.
 *
 * Medleys are scored per segment. Against the whole string a suite scores 0 —
 * "Help > Slipknot > Franklin" shares one significant word with "Help on the
 * Way" and loses on every rule — so every medley-titled tape looked like it did
 * not contain the song. That was tolerable while the browser offered versions
 * the player might still refuse; once the browser started filtering on this
 * score, it began hiding real tapes. The segue is the product here, so a suite
 * genuinely does contain each of its songs.
 */
/**
 * Songs a suite OPENS with, filed under the suite's name on some tapes.
 * "Lady with a Fan" is the first movement of "Terrapin Station", and on the
 * debut (1977-02-26) every top tape titles the whole thing "Terrapin
 * Station". A track that STARTS with the song is the song; one where the
 * song arrives later is not (Let It Grow closes Weather Report Suite, so it
 * is deliberately absent — playing the Prelude under Let It Grow's name is
 * the different-song-under-this-name failure the player exists to prevent).
 * Scored below any dedicated track, so a separately titled movement wins.
 */
const SUITE_OPENERS: Record<string, string[]> = {
  ladywithafan: ["terrapinstation", "terrapin", "terrapinstationsuite"],
};
const SUITE_SCORE = 75;

function matchScore(trackTitle: string, songTitle: string): number {
  const opens = SUITE_OPENERS[compact(songTitle)];
  if (opens) {
    const first = compact(trackTitle.split(SEGUE_SPLIT)[0] ?? "").replace(/firstone$/, "");
    if (opens.includes(first)) return Math.max(SUITE_SCORE, scoreTitlePair(trackTitle, songTitle));
  }
  const direct = scoreTitlePair(trackTitle, songTitle);
  if (direct === 100) return direct;

  const segments = trackTitle.split(SEGUE_SPLIT).map((s) => s.trim()).filter(Boolean);
  if (segments.length < 2) return direct;

  // Best segment wins, never worse than the whole-string score. A tape with a
  // dedicated track for the song still scores 100 and outranks the suite.
  return segments.reduce((best, seg) => Math.max(best, scoreTitlePair(seg, songTitle)), direct);
}

export { matchScore, normalize };

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
export function isRestrictedItem(meta: { metadata?: Record<string, unknown> } | null): boolean {
  const md: Record<string, unknown> = meta?.metadata ?? {};
  if (String(md["access-restricted-item"]).toLowerCase() === "true") return true;
  const collection = md.collection;
  const list = Array.isArray(collection) ? collection : collection ? [collection] : [];
  return list.some((c: unknown) => String(c).toLowerCase() === "stream_only");
}

export function isAudioFile(f: any): boolean {
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

export function isMp3(f: any): boolean {
  return f.format === "VBR MP3" || (f.name || "").toLowerCase().endsWith(".mp3");
}

/** Lossy derivatives archive.org generates for streaming — never the original. */
export function isDerivative(f: { name?: string; format?: string }): boolean {
  const name = (f.name || "").toLowerCase();
  return (
    f.format === "VBR MP3" ||
    f.format === "Ogg Vorbis" ||
    name.endsWith(".mp3") ||
    name.endsWith(".ogg")
  );
}

export function findBestTrack(
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


/** Only an Archive host. A response must never be able to point the player anywhere else. */
export const ARCHIVE_HOST = /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.archive\.org$/i;

/**
 * The item's own server roots (`https://<host><dir>`) from its metadata, in
 * the order the Archive lists them: workable_servers, then d1, d2, server.
 * Empty when the metadata names none or carries a malformed dir.
 */
export function itemServerRoots(meta: any): string[] {
  const dir = meta?.dir;
  if (typeof dir !== "string" || !/^\/[^?#\s]*$/.test(dir)) return [];
  const hosts = [
    ...(Array.isArray(meta.workable_servers) ? meta.workable_servers : []),
    meta.d1,
    meta.d2,
    meta.server,
  ];
  const roots: string[] = [];
  for (const host of hosts) {
    if (typeof host !== "string" || !ARCHIVE_HOST.test(host)) continue;
    const root = `https://${host}${dir}`;
    if (!roots.includes(root)) roots.push(root);
  }
  return roots;
}
