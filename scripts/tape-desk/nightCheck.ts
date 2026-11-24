/**
 * Was the song played that night, and is it on any tape of the night?
 *
 * The probe (probe.ts) answers what the player's resolver does with a report.
 * It cannot answer the question every "not on the tape" report turns on: did
 * the band play the song that night at all? Before 2026-11-23 the desk wrote
 * "check a setlist source" into the ticket and stopped, and four tickets sat
 * waiting on that one check. This is that check, with two independent
 * sources, so the desk can assign a class instead of a chore.
 *
 *   - Relisten (api.relisten.net, v2): every Archive source of the night with
 *     its track titles and durations. It is the Archive's own listing, read by
 *     another project, so it says what is ON TAPE.
 *   - JerryBase (jerrybase.com): the performed setlist, kept by hand from
 *     tapes and ticket stubs. It says what was PLAYED, including songs that
 *     never reached a circulating tape.
 *
 * Titles are compared with the player's own matcher (tapeMatch.ts), never a
 * second one: CLAUDE.md's rule for triage. Both sources are public facts read
 * through their public pages and API. No code is taken from either project.
 *
 * Pure: the CLI in night.ts does the fetching, this decides.
 */
import { matchScore } from "../../supabase/functions/_shared/tapeMatch";

/** The player's own threshold: findBestTrack accepts a title at 60 and above. */
export const MATCH_AT = 60;

export interface TapeListing {
  identifier: string;
  tracks: Array<{ title: string; duration_s: number | null }>;
}

export interface SetlistListing {
  /** One entry per Grateful Dead event on the date (early and late shows are two). */
  events: Array<{ url: string; songs: string[] }>;
}

export interface NightSources {
  song: string;
  date: string;
  /** null when Relisten did not answer (not the same as "no show": that is an empty list). */
  relisten: { tapes: TapeListing[] } | null;
  jerrybase: SetlistListing | null;
  /** Every Archive identifier dated that night, from advancedsearch. null when it did not answer. */
  archiveIdentifiers: string[] | null;
}

/**
 * "on_tape" is not a class: the night has the song on some tape, so the
 * report's class is S, M, A or C, and only the probe of the tape the player
 * actually chose can say which.
 */
export type NightClass = "N" | "M" | "G" | "on_tape" | null;

export interface NightJudgement {
  /** JerryBase: was it performed. "unknown" when the source did not answer. */
  setlistPlayed: "yes" | "no" | "unknown";
  /** Relisten: is it on any tape of the night, by the player's matcher. */
  onTape: "yes" | "no" | "unknown";
  /** Identifiers whose track list matches the song at the player's threshold, best first. */
  carrying: Array<{ identifier: string; title: string; duration_s: number | null; score: number }>;
  /** Titles that share a significant word with the song but score under the threshold (matcher-miss leads). */
  nearMisses: Array<{ identifier: string; title: string; score: number }>;
  /** Untitled or segue-only tracks, which can hide a song the matcher cannot see. */
  untitled: Array<{ identifier: string; title: string }>;
  /**
   * The class this evidence supports on its own, before the index and the
   * report are read:
   *   N  two sources say it was not played and no tape carries it
   *   G  performed, and no tape carries it, with nothing that looks like a miss
   *   M  performed, nothing matches, but a near miss or untitled track might be it
   *   on_tape  some tape of the night carries it; S, M, A or C is the probe's call
   *   null  a source did not answer; no class without both
   */
  supports: NightClass;
  why: string;
}

const UNTITLED = /^(untitled|unknown|track\s*\d+|jam|tuning|\s*-+>?\s*|>)$/i;
const words = (s: string) =>
  s.toLowerCase().replace(/[''`]/g, "").replace(/[^a-z0-9]+/g, " ").split(" ").filter((w) => w.length > 3);

export function performedIn(listing: SetlistListing, song: string): boolean {
  return listing.events.some((e) => e.songs.some((t) => matchScore(t, song) >= MATCH_AT));
}

export function judgeNight(src: NightSources): NightJudgement {
  const carrying: NightJudgement["carrying"] = [];
  const nearMisses: NightJudgement["nearMisses"] = [];
  const untitled: NightJudgement["untitled"] = [];
  const songWords = new Set(words(src.song));

  for (const tape of src.relisten?.tapes ?? []) {
    let best: { title: string; duration_s: number | null; score: number } | null = null;
    for (const t of tape.tracks) {
      const score = matchScore(t.title, src.song);
      if (score >= MATCH_AT) {
        if (!best || score > best.score) best = { title: t.title, duration_s: t.duration_s, score };
      } else if (words(t.title).some((w) => songWords.has(w))) {
        nearMisses.push({ identifier: tape.identifier, title: t.title, score });
      } else if (UNTITLED.test(t.title.trim())) {
        untitled.push({ identifier: tape.identifier, title: t.title });
      }
    }
    if (best) carrying.push({ identifier: tape.identifier, ...best });
  }
  carrying.sort((a, b) => b.score - a.score);

  const setlistPlayed: NightJudgement["setlistPlayed"] = !src.jerrybase
    ? "unknown"
    : performedIn(src.jerrybase, src.song) ? "yes" : "no";
  const onTape: NightJudgement["onTape"] = !src.relisten ? "unknown" : carrying.length > 0 ? "yes" : "no";

  let supports: NightClass = null;
  let why: string;
  if (onTape === "yes") {
    supports = "on_tape";
    why = `${carrying.length} tape(s) of the night carry it by the player's own matcher`;
    if (setlistPlayed === "no") why += "; JerryBase does not list it, so its setlist may be incomplete";
  } else if (setlistPlayed === "unknown" || onTape === "unknown") {
    why = `a source did not answer (JerryBase ${setlistPlayed}, Relisten ${onTape}); no class without both`;
  } else if (setlistPlayed === "no") {
    // Two independent sources agree. A near miss here is another song sharing
    // a word ("Six Days On The Road" for "Going Down the Road"), not a miss.
    supports = "N";
    why = "not in JerryBase's setlist, and no Relisten source of the night has a track the player's matcher accepts";
  } else if (nearMisses.length > 0 || untitled.length > 0) {
    supports = "M";
    why = `performed per JerryBase, no title matches, but ${nearMisses.length} near miss(es) and ${untitled.length} untitled track(s) could be it`;
  } else {
    supports = "G";
    why = "performed per JerryBase, and no Relisten source of the night has it under any title";
  }
  return { setlistPlayed, onTape, carrying, nearMisses, untitled, supports, why };
}

/** Relisten v2 /artists/grateful-dead/shows/{date} → listings. */
// deno-lint-ignore no-explicit-any
export function relistenTapes(show: any): TapeListing[] {
  const sources = Array.isArray(show?.sources) ? show.sources : [];
  // deno-lint-ignore no-explicit-any
  return sources.map((s: any) => ({
    identifier: String(s.upstream_identifier ?? s.id ?? ""),
    // deno-lint-ignore no-explicit-any
    tracks: (s.sets ?? []).flatMap((set: any) =>
      // deno-lint-ignore no-explicit-any
      (set.tracks ?? []).map((t: any) => ({ title: String(t.title ?? ""), duration_s: typeof t.duration === "number" ? t.duration : null })),
    ),
  }));
}

/** A JerryBase event page → its title and the songs it links, in order. */
export function jerrybaseEvent(html: string): { act: string | null; songs: string[] } {
  const act = html.match(/<title>([^<–-]+?)\s*[–-]\s*\d{4}-\d{2}-\d{2}/)?.[1]?.trim() ?? null;
  const decode = (s: string) =>
    s.replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&gt;/g, ">").replace(/&lt;/g, "<");
  // A page links each song more than once, so keep the first of each. Only
  // membership matters here; a reprise being listed once changes no answer.
  const songs = [...new Set([...html.matchAll(/href="\/songs\/[^"]+"[^>]*>([^<]+)</g)].map((m) => decode(m[1].trim())))];
  return { act, songs };
}
