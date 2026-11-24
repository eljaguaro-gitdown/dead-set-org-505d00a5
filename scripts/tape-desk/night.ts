/**
 * The night check: was the song played, and is it on any tape of the night?
 *
 *   npx vite-node --config vitest.config.ts scripts/tape-desk/night.ts -- \
 *     --song "Bird Song" --date 1972-04-08
 *
 *   npx vite-node --config vitest.config.ts scripts/tape-desk/night.ts -- \
 *     --keys keys.json        (a JSON array of {song, date}; one line of JSON out per key)
 *
 * Prints JSON: the three sources' raw answers in short, and judgeNight's
 * verdict (nightCheck.ts says what each class means).
 *
 * STEWARDSHIP. Three requests per night: one Relisten show, one Archive
 * search, and JerryBase's event pages for the date (usually one). In --keys
 * mode, nights are cached so two songs on one date cost one set of requests,
 * and there is a pause between nights. None of these projects should feel the
 * desk.
 */
import { readFileSync } from "node:fs";
import { judgeNight, jerrybaseEvent, relistenTapes, type NightSources } from "./nightCheck";

const TIMEOUT_MS = 15_000;
const UA = "dead-set-tape-desk/1.0 (+https://dead-set.org)";

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : null;
}

async function get(url: string): Promise<Response | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": UA } });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

interface NightRaw {
  relisten: NightSources["relisten"];
  jerrybase: NightSources["jerrybase"];
  archiveIdentifiers: string[] | null;
  relistenVenue: string | null;
}

async function readNight(date: string): Promise<NightRaw> {
  // Relisten: 404 is an answer (no show that date), anything else non-2xx is not.
  let relisten: NightRaw["relisten"] = null;
  let relistenVenue: string | null = null;
  const rl = await get(`https://api.relisten.net/api/v2/artists/grateful-dead/shows/${date}`);
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
    const res = await get(url);
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
  const q = encodeURIComponent(`collection:GratefulDead AND date:[${date} TO ${date}]`);
  const ar = await get(`https://archive.org/advancedsearch.php?q=${q}&fl[]=identifier&fl[]=downloads&sort[]=downloads+desc&rows=100&output=json`);
  if (ar?.ok) {
    const j = await ar.json().catch(() => null);
    const docs = j?.response?.docs;
    if (Array.isArray(docs)) archiveIdentifiers = docs.map((d: { identifier: string }) => d.identifier);
  }
  return { relisten, jerrybase, archiveIdentifiers, relistenVenue };
}

async function main() {
  const keysFile = arg("keys");
  const keys: Array<{ song: string; date: string }> = keysFile
    ? JSON.parse(readFileSync(keysFile, "utf8"))
    : [{ song: arg("song") ?? "", date: arg("date") ?? "" }];
  if (keys.some((k) => !k.song || !/^\d{4}-\d{2}-\d{2}$/.test(k.date))) {
    console.error('usage: night.ts -- --song "<title>" --date YYYY-MM-DD   |   --keys keys.json');
    process.exit(2);
  }
  const nights = new Map<string, NightRaw>();
  for (const k of keys) {
    let raw = nights.get(k.date);
    if (!raw) {
      raw = await readNight(k.date);
      nights.set(k.date, raw);
      if (keys.length > 1) await new Promise((r) => setTimeout(r, 400));
    }
    const j = judgeNight({ song: k.song, date: k.date, ...raw });
    const out = {
      song: k.song,
      date: k.date,
      checkedAt: new Date().toISOString(),
      relisten: raw.relisten ? { venue: raw.relistenVenue, sources: raw.relisten.tapes.map((t) => t.identifier) } : "unreachable",
      jerrybase: raw.jerrybase ? raw.jerrybase.events.map((e) => ({ url: e.url, songs: e.songs.length })) : "unreachable",
      archive: raw.archiveIdentifiers ?? "unreachable",
      ...j,
      nearMisses: j.nearMisses.slice(0, 10),
      untitled: j.untitled.slice(0, 10),
    };
    console.log(keysFile ? JSON.stringify(out) : JSON.stringify(out, null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
