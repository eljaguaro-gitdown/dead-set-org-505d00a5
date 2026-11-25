/**
 * Catalog first/last-played audit against JerryBase (Grateful Dead, public
 * shows only) and Relisten (nights on tape).
 *
 *   npx vite-node --config vitest.config.ts scripts/tape-desk/catalogAudit.ts -- <out dir>
 *   node scripts/tape-desk/catalogAuditReport.mjs <out dir>
 *
 * Reads the public songs catalog with the publishable key, matches each title
 * to a JerryBase song and a Relisten song with the player's own matcher
 * (tapeMatch.matchScore), plus hand-checked OVERRIDES, and writes
 * <out dir>/audit.json. Read-only everywhere. Responses are cached under
 * <out dir>/jb and <out dir>/rl; uncached requests are spaced 600ms / 400ms.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { matchScore } from "../../supabase/functions/_shared/tapeMatch";

const REPO = process.cwd();
const SCRATCH = process.argv[process.argv.length - 1];
for (const d of ["jb", "rl"]) if (!existsSync(join(SCRATCH, d))) mkdirSync(join(SCRATCH, d));
const UA = "dead-set-tape-desk/1.0 (+https://dead-set.org)";

const env = Object.fromEntries(
  readFileSync(join(REPO, ".env"), "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
  }),
);

const decode = (s: string) =>
  s.replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/<[^>]+>/g, "").trim();

async function cached(dir: string, name: string, url: string, headers: Record<string, string>, pause: number) {
  const f = join(SCRATCH, dir, name);
  if (existsSync(f)) return JSON.parse(readFileSync(f, "utf8"));
  const res = await fetch(url, { headers: { "User-Agent": UA, ...headers } });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  const txt = await res.text();
  writeFileSync(f, txt);
  await new Promise((r) => setTimeout(r, pause));
  return JSON.parse(txt);
}
const jbJson = (path: string, name: string) =>
  cached("jb", name, `https://jerrybase.com${path}`, { Accept: "application/json, text/javascript, */*; q=0.01", "X-Requested-With": "XMLHttpRequest" }, 600);
const rlJson = (path: string, name: string) => cached("rl", name, `https://api.relisten.net/api/v2/artists/grateful-dead${path}`, {}, 400);

interface Perf { date: string; event: string; act: string; venue: string; type: string; pub: string }

/**
 * Hand-checked JerryBase ids where the matcher picked wrong or found nothing.
 * null = JerryBase has no such Grateful Dead song (checked by searching its index).
 * An array = a medley row: the nights where every part was played.
 */
const OVERRIDES: Record<string, number | number[] | null> = {
  "St. Stephen": 28,
  "Women Are Smarter": 1198,
  "Dancing in the Street": 1013,
  "Walkin' The Dog": 836,
  "Matilda Mother": null,
  "Whipping Post": null,
  "Childrenns Lullaby": null,
  "Seems Like Old Times": null,
  "Shakin All Over": null,
  "Gypsy Heart": null,
  "Scarlet Fire": [667, 608],
  "Scarlet Begonias > Fire on the Mountain": [667, 608],
  "Truckin > Smokestack Lightning": [1094, 1039],
  // The catalog row spans the Prelude's dates (1972-07-21 to 1974-10-18).
  "Weather Report Suite": 1138,
};

/** A real calendar day. JerryBase writes an unknown day or month as 00. */
const fullDate = (d: string) => /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(d);

async function jbPerfs(id: number): Promise<Perf[]> {
  const rows = (await jbJson(`/songs/${id}`, `song-${id}.json`)).data as unknown[][];
  return rows.map((r) => ({
    date: String(r[0]).match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? "",
    event: String(r[0]).match(/events\/([0-9-]+)/)?.[1] ?? "",
    act: String(r[1] ?? ""),
    venue: decode(String(r[2] ?? "")),
    type: String(r[3] ?? ""),
    pub: String(r[8] ?? ""),
  })).filter((p) => p.date && p.act === "Grateful Dead" && p.pub === "true");
}

async function main() {
  const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/songs?select=id,title,first_played,last_played,times_played,stats_source&order=title`, {
    headers: { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
  });
  if (!res.ok) throw new Error(`songs ${res.status}`);
  const catalog: Array<{ id: string; title: string; first_played: string | null; last_played: string | null; times_played: number | null }> = await res.json();

  const jbIndex = ((await jbJson("/songs", "songs.json")).data as unknown[][])
    .map((r) => ({ id: Number(String(r[0]).match(/songs\/(\d+)/)?.[1]), name: decode(String(r[0])) })).filter((s) => s.id);
  const rlIndex = (await rlJson("/songs", "songs.json")) as Array<{ id: number; name: string; shows_played_at: number }>;

  const out = [];
  for (const song of catalog) {
    // --- JerryBase: which song, then its public Grateful Dead nights
    let jbIds: number[] = [];
    let jbHow = "";
    if (song.title in OVERRIDES) {
      const o = OVERRIDES[song.title];
      jbIds = o === null ? [] : Array.isArray(o) ? o : [o];
      jbHow = o === null ? "none (hand-checked)" : "hand-checked";
    } else {
      const scored = jbIndex.map((s) => ({ ...s, score: matchScore(s.name, song.title) })).filter((s) => s.score >= 60).sort((a, b) => b.score - a.score);
      if (scored[0]) { jbIds = [scored[0].id]; jbHow = `matcher ${scored[0].score}`; } else jbHow = "none (matcher)";
    }
    const jbNames = jbIds.map((id) => jbIndex.find((s) => s.id === id)?.name ?? String(id));
    let perfs: Perf[] = [];
    if (jbIds.length) {
      const sets = await Promise.all(jbIds.map(jbPerfs));
      perfs = sets[0].filter((p) => sets.every((s) => s.some((q) => q.date === p.date)));
    }
    const dated = perfs.filter((p) => fullDate(p.date)).sort((a, b) => a.date.localeCompare(b.date));
    const undatedBefore = perfs.filter((p) => !fullDate(p.date) && dated[0] && p.date.slice(0, 7) <= dated[0].date.slice(0, 7)).map((p) => p.date);
    const undatedAfter = perfs.filter((p) => !fullDate(p.date) && dated.length && p.date.slice(0, 7) >= dated[dated.length - 1].date.slice(0, 7)).map((p) => p.date);

    // --- Relisten: nights on tape (single songs only; a medley row has no Relisten song)
    let rl: null | { name: string; score: number; first: string; last: string; count: number; dates: string[] } = null;
    if (jbIds.length === 1) {
      const target = jbNames[0];
      const scored = rlIndex.map((s) => ({ ...s, score: Math.max(matchScore(s.name, song.title), matchScore(s.name, target)) })).filter((s) => s.score >= 60).sort((a, b) => b.score - a.score || b.shows_played_at - a.shows_played_at);
      if (scored[0]) {
        const j = await rlJson(`/songs/${scored[0].id}`, `s${scored[0].id}.json`);
        const dates = [...new Set((j.shows ?? []).map((s: { display_date: string }) => s.display_date).filter(fullDate))].sort() as string[];
        if (dates.length) rl = { name: scored[0].name, score: scored[0].score, first: dates[0], last: dates[dates.length - 1], count: dates.length, dates };
      }
    }

    const first = dated[0] ?? null;
    const last = dated[dated.length - 1] ?? null;
    out.push({
      id: song.id,
      title: song.title,
      catalog: { first: song.first_played, last: song.last_played, times: song.times_played },
      jb: { ids: jbIds, names: jbNames, how: jbHow },
      gd: first ? { first: first.date, firstVenue: first.venue, firstType: first.type, last: last!.date, lastVenue: last!.venue, lastType: last!.type, count: perfs.length, undatedBefore, undatedAfter, dates: dated.map((p) => p.date) } : null,
      rl: rl ? { ...rl, dates: undefined } : null,
      rlDates: rl?.dates ?? [],
      firstAgrees: first ? song.first_played === first.date : null,
      lastAgrees: last ? song.last_played === last.date : null,
      catalogFirstWasPlayed: song.first_played ? dated.some((p) => p.date === song.first_played) : null,
      catalogLastWasPlayed: song.last_played ? dated.some((p) => p.date === song.last_played) : null,
      catalogFirstOnTape: song.first_played && rl ? rl.dates.includes(song.first_played) : null,
      catalogLastOnTape: song.last_played && rl ? rl.dates.includes(song.last_played) : null,
    });
    process.stdout.write(".");
  }
  writeFileSync(join(SCRATCH, "audit.json"), JSON.stringify(out, null, 2));
  console.log(`\n${out.length} songs written`);
}

main().catch((e) => { console.error(e); process.exit(1); });
