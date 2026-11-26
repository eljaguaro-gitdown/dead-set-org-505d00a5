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
import { judgeNight } from "./nightCheck";
import { readNight, type NightRaw } from "../../supabase/functions/_shared/nightSources";

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : null;
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
