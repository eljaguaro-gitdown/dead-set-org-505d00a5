/**
 * Fill public.tape_index from this machine, with the SAME resolver the
 * index-tapes edge function runs (supabase/functions/_shared/tapeIndexResolve.ts),
 * for the nights the product offers publicly. Writes SQL; it does not touch
 * the database itself — whoever runs it applies the chunks (Lovable
 * query_database, or psql), so nothing writes to production by accident.
 *
 *   NODE_USE_ENV_PROXY=1 npx vite-node --config vitest.config.ts scripts/tape-index/backfill.ts -- \
 *     --out <dir> [--corpus-first scripts/tapebench/corpus.json] [--concurrency 4] [--limit N]
 *
 * Keys: every song's first and last night, every catalog version, every
 * PUBLIC setlist slot with a night (the anon key reads only those), every
 * reported night (scripts/tapebench/issues.json), and every song's undated
 * answer. The hourly refresh (tape_index_candidates) covers the rest —
 * private setlists, verified tapes — once index-tapes is deployed.
 *
 * Output: <dir>/chunk-NNN.sql (50 keys each) and <dir>/summary.json.
 */
import fs from "node:fs";
import path from "node:path";
import { resolveNight, resolveSong, type TapeIndexRow } from "../../supabase/functions/_shared/tapeIndexResolve";

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : d; };
const outDir = arg("out", "tape-index-backfill");
const concurrency = Number(arg("concurrency", "4"));
const limit = Number(arg("limit", "0"));
const corpusFirst = arg("corpus-first", "scripts/tapebench/corpus.json");

const env = Object.fromEntries(fs.readFileSync(".env", "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l))
  .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")]));
const rest = async (q: string) => {
  const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/${q}`, { headers: { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_PUBLISHABLE_KEY}` } });
  if (!res.ok) throw new Error(`${q}: ${res.status}`);
  return res.json();
};
const day = (d: unknown) => (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : null);
const ident = (u: unknown) => (typeof u === "string" ? u.match(/archive\.org\/details\/([A-Za-z0-9._-]+)/)?.[1] ?? null : null);
const inLife = (d: string | null) => !!d && d >= "1965-01-01" && d <= "1995-12-31";

interface Key { songId: string; title: string; showDate: string | null; stored: string | null }

const q = (s: string | null) => (s === null ? "null" : `'${s.replace(/'/g, "''")}'`);
const arr = (a: string[]) => `array[${a.map(q).join(",")}]::text[]`;
function sqlFor(rows: TapeIndexRow[]): string {
  const out: string[] = [];
  for (const r of rows) {
    if (r.is_default) out.push(`update public.tape_index set is_default = false where song_id = '${r.song_id}' and show_date = '${r.show_date}' and is_default and identifier <> ${q(r.identifier)};`);
    if (r.is_song_default) out.push(`update public.tape_index set is_song_default = false where song_id = '${r.song_id}' and is_song_default and not (show_date = '${r.show_date}' and identifier = ${q(r.identifier)});`);
    out.push(`insert into public.tape_index (song_id, show_date, identifier, status, is_default, is_song_default, track_url, servers, file_name, title_on_tape, duration_s, match_score, verified_at)
values ('${r.song_id}', '${r.show_date}', ${q(r.identifier)}, '${r.status}', ${r.is_default}, ${!!r.is_song_default}, ${q(r.track_url)}, ${arr(r.servers)}, ${q(r.file_name)}, ${q(r.title_on_tape)}, ${r.duration_s ?? "null"}, ${r.match_score ?? "null"}, now())
on conflict (song_id, show_date, identifier) do update set status = excluded.status, is_default = excluded.is_default,
  is_song_default = excluded.is_song_default, track_url = excluded.track_url, servers = excluded.servers, file_name = excluded.file_name,
  title_on_tape = excluded.title_on_tape, duration_s = excluded.duration_s, match_score = excluded.match_score, verified_at = now();`);
  }
  return out.join("\n");
}

async function main() {
  const songs: Array<{ id: string; title: string; first_played: string | null; last_played: string | null }> = await rest("songs?select=id,title,first_played,last_played");
  const byId = new Map(songs.map((s) => [s.id, s]));
  const keys = new Map<string, Key>();
  const add = (songId: string, showDate: string | null, stored: string | null) => {
    const s = byId.get(songId);
    if (!s) return;
    if (showDate !== null && !inLife(showDate)) return;
    const k = `${songId}@${showDate ?? "-"}@${stored ?? ""}`;
    if (!keys.has(k)) keys.set(k, { songId, title: s.title, showDate, stored });
  };
  // Corpus first, so the bench can run against a full index soonest.
  if (fs.existsSync(corpusFirst)) {
    for (const t of JSON.parse(fs.readFileSync(corpusFirst, "utf8")).taps) add(t.songId, day(t.showDate), ident(t.archiveUrl));
  }
  for (const s of songs) { add(s.id, day(s.first_played), null); add(s.id, day(s.last_played), null); }
  for (const v of await rest("notable_versions?select=song_id,show_date,archive_org_url")) add(v.song_id, day(v.show_date), ident(v.archive_org_url));
  const slots = await rest("setlist_slots?select=song_id,notes,notable_versions(show_date,archive_org_url),setlists!inner(is_public)&setlists.is_public=eq.true&limit=5000");
  for (const sl of slots) {
    const meta = typeof sl.notes === "string" && sl.notes.startsWith('{"__archive":true') ? (() => { try { return JSON.parse(sl.notes.split("\n")[0]); } catch { return null; } })() : null;
    add(sl.song_id, day(sl.notable_versions?.show_date) ?? day(meta?.show_date), ident(sl.notable_versions?.archive_org_url ?? meta?.archive_org_url));
  }
  for (const i of JSON.parse(fs.readFileSync("scripts/tapebench/issues.json", "utf8"))) add(i.song_id, day(i.show_date), ident(i.archive_url));
  for (const s of songs) add(s.id, null, null); // undated answers last

  let list = [...keys.values()];
  if (limit) list = list.slice(0, limit);
  fs.mkdirSync(outDir, { recursive: true });
  const summary = { keys: list.length, playable: 0, no_match: 0, no_tape: 0, unreachable: 0, empty: 0, requests: 0, chunks: 0 };
  let buffer: string[] = [];
  let inChunk = 0;
  const flush = () => {
    if (buffer.length === 0) return;
    summary.chunks++;
    fs.writeFileSync(path.join(outDir, `chunk-${String(summary.chunks).padStart(3, "0")}.sql`), buffer.join("\n") + "\n");
    buffer = []; inChunk = 0;
  };
  let next = 0;
  let done = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < list.length) {
      const k = list[next++];
      const r = k.showDate
        ? await resolveNight(fetch, { songId: k.songId, songTitle: k.title, showDate: k.showDate, storedIdentifier: k.stored })
        : await resolveSong(fetch, { songId: k.songId, songTitle: k.title });
      summary.requests += r.requests;
      if (r.rows.length === 0) { if (r.unreachable) summary.unreachable++; else summary.empty++; }
      else {
        const d = r.rows.find((x) => x.is_default || x.is_song_default) ?? r.rows[0];
        summary[d.status]++;
        buffer.push(`-- ${k.title} ${k.showDate ?? "(undated)"} ${k.stored ?? ""}`, sqlFor(r.rows));
        if (++inChunk >= 50) flush();
      }
      done++;
      if (done % 25 === 0) process.stderr.write(`${done}/${list.length} ${JSON.stringify(summary)}\n`);
      await new Promise((res) => setTimeout(res, 120));
    }
  }));
  flush();
  fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 1));
  process.stderr.write(`done ${JSON.stringify(summary)}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
