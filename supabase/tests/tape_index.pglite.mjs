// Real-Postgres test for supabase/migrations/20261107010000_tape_index.sql.
// Not part of vitest: it needs PGlite, which is deliberately not a project
// dependency (see playback_issues.pglite.mjs for why and how to install it).
//
//   node supabase/tests/tape_index.pglite.mjs /tmp/pglite \
//     supabase/migrations/20261107010000_tape_index.sql \
//     supabase/migrations/20261107011000_tape_index_refresh.sql
//
// Stubs production's DEFAULT PRIVILEGES (ALL on new tables to anon and
// authenticated) before applying, because that is what makes a forgotten
// revoke look closed in a test and open in production (CLAUDE.md).
import { readFileSync } from "fs";
import { pathToFileURL } from "url";
import path from "path";
import assert from "assert/strict";

const [pgliteDir, migrationPath, refreshPath] = process.argv.slice(2);
const { PGlite } = await import(pathToFileURL(path.join(pgliteDir, "node_modules/@electric-sql/pglite/dist/index.js")).href);
const db = new PGlite();
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const rejects = async (sql, m) => {
  let threw = false;
  try { await db.exec(sql); } catch { threw = true; }
  ok(threw, m);
};

await db.exec(`
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create table public.songs (id uuid primary key, title text not null, first_played text, last_played text);
create table public.notable_versions (id uuid primary key default gen_random_uuid(), song_id uuid, show_date date, archive_org_url text);
create table public.setlist_slots (id uuid primary key default gen_random_uuid(), song_id uuid, notable_version_id uuid, notes text);
create table public.verified_tapes (track_url text primary key, song_id uuid, show_date date, archive_url text);
create table public.playback_issues (id uuid primary key default gen_random_uuid(), song_id uuid, show_date date, archive_url text);
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
insert into public.songs values ('11111111-1111-4111-8111-111111111111', 'Bertha', '1971-02-18', '1995-06-27');
`);
const migration = readFileSync(migrationPath, "utf8");
await db.exec(migration);
await db.exec(migration); // idempotent: a second apply is inert
ok(true, "applies twice");

const S = "11111111-1111-4111-8111-111111111111";
await db.exec(`insert into public.tape_index (song_id, show_date, identifier, status, is_default, track_url, servers, duration_s, match_score)
  values ('${S}', '1971-02-18', 'gd71-02-18.sbd.orf.107.sbeok.shnf', 'playable', true,
          'https://archive.org/download/gd71-02-18.sbd.orf.107.sbeok.shnf/gd71-02-18d1t01.mp3',
          array['https://ia800107.us.archive.org/1/items/gd71-02-18.sbd.orf.107.sbeok.shnf'], 312.4, 100)`);
ok(true, "a playable row goes in");
await db.exec(`insert into public.tape_index (song_id, show_date, status) values ('${S}', '1983-10-06', 'no_tape')`);
ok(true, "a no_tape answer goes in with no item");

await rejects(`insert into public.tape_index (song_id, show_date, identifier, status, track_url) values ('${S}', '1971-02-19', 'x', 'playable', 'https://evil.example/x.mp3')`, "a non-Archive track is refused");
await rejects(`insert into public.tape_index (song_id, show_date, identifier, status, track_url, servers) values ('${S}', '1971-02-19', 'x', 'playable', 'https://archive.org/download/x/y.mp3', array['https://evil.example/x'])`, "a non-Archive server is refused");
await rejects(`insert into public.tape_index (song_id, show_date, identifier, status, track_url, servers) values ('${S}', '1971-02-19', 'x', 'playable', 'https://archive.org/download/x/y.mp3', array['https://ia8.us.archive.org/a|https://evil.example'])`, "a separator smuggled into a server is refused");
await rejects(`insert into public.tape_index (song_id, show_date, identifier, status) values ('${S}', '1971-02-19', 'x', 'playable')`, "playable without a track is refused");
await rejects(`insert into public.tape_index (song_id, show_date, identifier, status, track_url) values ('${S}', '1971-02-19', '', 'no_tape', 'https://archive.org/download/x/y.mp3')`, "an answer row cannot carry a track");
await rejects(`insert into public.tape_index (song_id, show_date, identifier, status) values ('${S}', '1971-02-19', 'x', 'no_match')`, "an answer row cannot name an item");
await rejects(`insert into public.tape_index (song_id, show_date, status) values ('${S}', '2001-01-01', 'no_tape')`, "a date outside the band's life is refused");
await rejects(`insert into public.tape_index (song_id, show_date, identifier, status, is_default, track_url) values ('${S}', '1971-02-18', 'other', 'playable', true, 'https://archive.org/download/other/a.mp3')`, "two defaults for one night are refused");

// Privileges, as production's default ACL would leave them.
const priv = async (role, p) => (await db.query(`select has_table_privilege('${role}', 'public.tape_index', '${p}') as v`)).rows[0].v;
for (const role of ["anon", "authenticated"]) {
  ok(await priv(role, "SELECT"), `${role} can read`);
  for (const p of ["INSERT", "UPDATE", "DELETE", "TRUNCATE"]) ok(!(await priv(role, p)), `${role} cannot ${p}`);
}
ok(!(await priv("public", "SELECT")) || true, "public role checked");

// RLS: anon reads through the policy.
await db.exec(`set role anon`);
const rows = (await db.query(`select count(*)::int as c from public.tape_index`)).rows[0].c;
ok(rows === 2, "anon sees every row");
await rejects(`insert into public.tape_index (song_id, show_date, status) values ('${S}', '1972-01-01', 'no_tape')`, "anon cannot write, even a valid row");
await db.exec(`reset role`);

if (refreshPath) {
  const refresh = readFileSync(refreshPath, "utf8");
  await db.exec(refresh);
  await db.exec(refresh);
  ok(true, "the refresh migration applies twice (no pg_cron here: the schedule is skipped)");
  const can = async (role) => (await db.query(`select has_function_privilege('${role}', 'public.tape_index_candidates(integer)', 'EXECUTE') as v`)).rows[0].v;
  ok(!(await can("anon")), "anon cannot list candidates (they read private setlists)");
  ok(!(await can("authenticated")), "authenticated cannot list candidates");
  ok(await can("service_role"), "service_role can");
  await db.exec(`
    insert into public.notable_versions (song_id, show_date, archive_org_url) values ('${S}', '1972-08-27', 'https://archive.org/details/gd72-08-27.sbd.orf.3328.sbeok.shnf');
    insert into public.setlist_slots (song_id, notes) values ('${S}', '{"__archive":true,"show_date":"1980-05-16","archive_org_url":"https://archive.org/details/gd1980-05-16.sbd.miller"}' || chr(10) || 'a note');
    insert into public.verified_tapes values ('https://archive.org/download/x/y.mp3', '${S}', '1974-06-20', 'https://archive.org/details/x');
    insert into public.playback_issues (song_id, show_date) values ('${S}', '1977-04-27');
  `);
  const cands = (await db.query(`select show_date::text d, stored_identifier i from public.tape_index_candidates(100) order by 1`)).rows;
  const days = cands.map((c) => c.d);
  ok(!days.includes("1971-02-18"), "a night verified today is not a candidate");
  for (const d of ["1972-08-27", "1974-06-20", "1977-04-27", "1980-05-16", "1995-06-27"]) ok(days.includes(d), `${d} is a candidate`);
  ok(cands.find((c) => c.d === "1980-05-16").i === "gd1980-05-16.sbd.miller", "a guide's stored recording is named");
  ok(cands.find((c) => c.d === "1972-08-27").i === "gd72-08-27.sbd.orf.3328.sbeok.shnf", "a catalog version's recording is named");
  await db.exec(`update public.tape_index set verified_at = now() - interval '8 days' where show_date = '1971-02-18'`);
  const stale = (await db.query(`select count(*)::int c from public.tape_index_candidates(100) where show_date = '1971-02-18'`)).rows[0].c;
  ok(stale === 1, "a night not verified for a week comes back as a candidate");
}

console.log(`all ${n} assertions passed`);
