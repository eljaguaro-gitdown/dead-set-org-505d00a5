/**
 * Reading a night from the two setlist records: Relisten (what is on tape)
 * and JerryBase (what was played), plus the Archive's own identifiers.
 *
 * Moved out of scripts/tape-desk/night.ts on 2026-11-26 so the desk's CLI and
 * the check-nights edge function make the same requests the same way. No
 * Deno or Node API: plain fetch, so both runtimes load it.
 *
 * STEWARDSHIP. One Relisten show, JerryBase's event pages for the date
 * (usually one, at most four), and, only when asked, one Archive search.
 * Callers cache by date and pace themselves. None of these projects should
 * feel us.
 */
import { jerrybaseEvent, relistenTapes, type NightSources } from "./nightCheck.ts";

const TIMEOUT_MS = 15_000;
export const NIGHT_UA = "dead-set-tape-desk/1.0 (+https://dead-set.org)";

async function get(url: string, timeoutMs = TIMEOUT_MS): Promise<Response | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": NIGHT_UA } });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export interface NightRaw {
  relisten: NightSources["relisten"];
  jerrybase: NightSources["jerrybase"];
  archiveIdentifiers: string[] | null;
  relistenVenue: string | null;
}

export async function readNight(
  date: string,
  opts: { archive?: boolean; timeoutMs?: number } = {},
): Promise<NightRaw> {
  const timeoutMs = opts.timeoutMs ?? TIMEOUT_MS;
  // Relisten: 404 is an answer (no show that date), anything else non-2xx is not.
  let relisten: NightRaw["relisten"] = null;
  let relistenVenue: string | null = null;
  const rl = await get(`https://api.relisten.net/api/v2/artists/grateful-dead/shows/${date}`, timeoutMs);
  if (rl?.ok) {
    const show = await rl.json().catch(() => null);
    if (show) {
      relisten = { tapes: relistenTapes(show) };
      relistenVenue = show?.venue?.name ?? null;
    }
  } else if (rl?.status === 404) relisten = { tapes: [] };

  // JerryBase: YYYYMMDD-01, -02 … until a 404. Only Grateful Dead events, and
  // an event page that repeats an earlier one's songs is the same event.
  let jerrybase: NightRaw["jerrybase"] = { events: [] };
  const stamp = date.replace(/-/g, "");
  for (let n = 1; n <= 4; n++) {
    const url = `https://jerrybase.com/events/${stamp}-${String(n).padStart(2, "0")}`;
    const res = await get(url, timeoutMs);
    if (!res) { jerrybase = null; break; }
    if (res.status === 404) break;
    if (!res.ok) { jerrybase = null; break; }
    const ev = jerrybaseEvent(await res.text());
    if (ev.act !== "Grateful Dead" || ev.songs.length === 0) continue;
    const sig = ev.songs.join("|");
    if (jerrybase.events.some((e) => e.songs.join("|") === sig)) continue;
    jerrybase.events.push({ url, songs: ev.songs });
  }

  let archiveIdentifiers: string[] | null = null;
  if (opts.archive !== false) {
    const q = encodeURIComponent(`collection:GratefulDead AND date:[${date} TO ${date}]`);
    const ar = await get(
      `https://archive.org/advancedsearch.php?q=${q}&fl[]=identifier&fl[]=downloads&sort[]=downloads+desc&rows=100&output=json`,
      timeoutMs,
    );
    if (ar?.ok) {
      const j = await ar.json().catch(() => null);
      const docs = j?.response?.docs;
      if (Array.isArray(docs)) archiveIdentifiers = docs.map((d: { identifier: string }) => d.identifier);
    }
  }
  return { relisten, jerrybase, archiveIdentifiers, relistenVenue };
}
