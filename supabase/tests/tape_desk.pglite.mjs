// Real-Postgres test for supabase/migrations/20261124020000_tape_desk_lookout.sql,
// the tape desk's lookout. Not part of vitest (PGlite is deliberately not a
// project dependency; see playback_issues.pglite.mjs for how to install it).
//
//   node supabase/tests/tape_desk.pglite.mjs /tmp/pglite \
//     supabase/migrations/20261025020000_playback_issues.sql \
//     supabase/migrations/20261026020000_playback_issues_hardening.sql \
//     supabase/migrations/20261027000000_record_tape_ok_cap.sql \
//     supabase/migrations/20261107010000_tape_index.sql \
//     supabase/migrations/20261107011000_tape_index_refresh.sql \
//     supabase/migrations/20261107020000_tape_index_stored_recordings.sql \
//     supabase/migrations/20261124010000_tape_index_refresh_bearer.sql \
//     supabase/migrations/20261124020000_tape_desk_lookout.sql
//
// This is the "prove it end to end on a database that is not production"
// half of the lookout (the other half is a synthetic workflow run): a fan's
// report goes in through the real report_playback_issue(), and the test reads
// what the trigger posted. pg_net, the vault, auth and the default privileges
// production applies to new objects are stubbed, the last because a revoke
// that only works without them looks closed here and is open in production
// (CLAUDE.md).
import { readFileSync } from "fs";
import { pathToFileURL } from "url";
import path from "path";
import assert from "assert/strict";

const [pgliteDir, ...migrationPaths] = process.argv.slice(2);
if (!pgliteDir || migrationPaths.length === 0) {
  console.error("usage: node tape_desk.pglite.mjs <pglite-dir> <migration.sql> …");
  process.exit(2);
}
const { PGlite } = await import(pathToFileURL(path.join(pgliteDir, "node_modules/@electric-sql/pglite/dist/index.js")).href);
const db = new PGlite();
let passed = 0;
const ok = (c, m) => { assert.ok(c, m); passed++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); passed++; };
const one = async (sql, p = []) => (await db.query(sql, p)).rows[0];

await db.exec(`
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create schema auth; create schema vault; create schema net; create schema extensions;
grant usage on schema auth to anon, authenticated;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated;
create type public.app_role as enum ('admin', 'moderator', 'user');
create table public.user_roles (user_id uuid, role public.app_role);
create function public.has_role(_user_id uuid, _role public.app_role) returns boolean
  language sql stable security definer set search_path = public as
  $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;
grant execute on function public.has_role(uuid, public.app_role) to anon, authenticated;
create function public.is_objectionable(t text) returns boolean language sql immutable as $$ select false $$;
create function extensions.digest(t text, alg text) returns bytea language sql immutable as $$ select convert_to(t, 'UTF8') $$;
create table public.songs (id uuid primary key default gen_random_uuid(), title text not null, first_played text, last_played text);
create table public.profiles (id uuid primary key default gen_random_uuid(), user_id uuid unique references auth.users(id), display_name text);
create table public.notable_versions (id uuid primary key default gen_random_uuid(), song_id uuid, show_date date, archive_org_url text);
create table public.setlist_slots (id uuid primary key default gen_random_uuid(), song_id uuid, notable_version_id uuid, notes text);
create table vault.decrypted_secrets (name text, decrypted_secret text);
insert into vault.decrypted_secrets values
  ('email_queue_service_role_key', 'svc-key'),
  ('send_transactional_email_url', 'https://example.test/functions/v1/send-transactional-email');
create table net.calls (id serial primary key, url text, headers jsonb, body jsonb);
create function net.http_post(url text, headers jsonb, body jsonb, timeout_milliseconds integer default 5000) returns bigint language sql as
  $$ insert into net.calls (url, headers, body) values (url, headers, body) returning id $$;
alter default privileges in schema public grant execute on functions to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
`);

const migrations = migrationPaths.map((p) => readFileSync(p, "utf8"));
for (const m of migrations) await db.exec(m);
const lookout = migrations[migrations.length - 1];
await db.exec(lookout);
ok(true, "the lookout migration applies twice");

const BIRD = "a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1";
const DRUMS = "b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2";
await db.exec(`insert into public.songs (id, title, first_played, last_played) values
  ('${BIRD}', 'Bird Song', '1971-02-19', '1995-06-30'), ('${DRUMS}', 'Drums', '1966-01-01', '1995-07-09')`);

const calls = async () => (await db.query(`select url, headers, body from net.calls order by id`)).rows;
const lookoutCalls = async () => (await calls()).filter((c) => c.url.endsWith("/tape-desk"));
const report = (kind, song, title, date, archive = null) =>
  one(`select public.report_playback_issue($1, $2, $3, $4::date, $5, null, null, '8d646f1', false) as id`, [kind, song, title, date, archive]);

// ---------------------------------------------------------------------------
// A fan's "not on the tape" report starts the desk, once, with the right body.
// ---------------------------------------------------------------------------
const seed = (await report("not_on_tape", BIRD, "Bird Song", "1972-04-08", "https://archive.org/details/gd1972-04-08.sbd.miller.24659.sbeok.flac16")).id;
let lc = await lookoutCalls();
eq(lc.length, 1, "a new not_on_tape report posts to tape-desk once");
eq(lc[0].url, "https://example.test/functions/v1/tape-desk", "at the tape-desk function, derived from the vault url");
eq(lc[0].body, { action: "dispatch", issue_id: seed, reason: "reported" }, "with the issue id and the reason, nothing about the fan");
eq(lc[0].headers.Authorization, "Bearer svc-key", "with the vault's service key as the bearer, the proof the function checks");

// The owner alert trigger still fires beside it (the existing path is untouched).
ok((await calls()).some((c) => c.body?.templateName === "playback-issue-alert"), "the original owner alert still goes out");

// A repeat of the same report is the same ticket: no second dispatch.
await report("not_on_tape", BIRD, "Bird Song", "1972-04-08");
eq((await lookoutCalls()).length, 1, "a second report of the same key adds to the count and dispatches nothing new");
eq((await one(`select report_count from public.playback_issues where id = $1`, [seed])).report_count, 2, "the count went up");

// no_tape is in scope too.
const viola = (await report("no_tape", BIRD, "Bird Song", "1971-03-24")).id;
lc = await lookoutCalls();
eq(lc.length, 2, "a no_tape report dispatches");
eq(lc[1].body.issue_id, viola, "for its own row");

// wont_play and none_in_setlist are not the desk's to fix end to end.
await report("wont_play", DRUMS, "Drums", "1995-07-09");
await report("none_in_setlist", BIRD, "Bird Song", null);
eq((await lookoutCalls()).length, 2, "wont_play and none_in_setlist do not dispatch");

// ---------------------------------------------------------------------------
// The owner's buttons and a fix that did not hold.
// ---------------------------------------------------------------------------
await db.exec(`update public.playback_issues set status = 'fixed', fixed_at = now() where id = '${seed}'`);
lc = await lookoutCalls();
eq(lc.length, 3, "Mark fixed dispatches, so the desk can finish its ticket");
eq(lc[2].body.reason, "owner_closed", "as owner_closed");

await report("not_on_tape", BIRD, "Bird Song", "1972-04-08");
lc = await lookoutCalls();
eq(lc.length, 4, "a report on a fixed row reopens it and dispatches");
eq(lc[3].body.reason, "reopened", "as reopened, which the runbook holds for the owner");
eq((await one(`select status from public.playback_issues where id = $1`, [seed])).status, "open", "the row is open again (report_playback_issue's own rule)");

await db.exec(`update public.playback_issues set status = 'wont_fix', closed_at = now() where id = '${viola}'`);
eq((await lookoutCalls()).at(-1).body, { action: "dispatch", issue_id: viola, reason: "owner_closed" }, "No tape exists dispatches as owner_closed");

const before = (await lookoutCalls()).length;
await db.exec(`update public.playback_issues set fix_note = 'note only' where id = '${seed}'`);
eq((await lookoutCalls()).length, before, "an edit that is not a status change dispatches nothing");

// A post that fails never fails the report.
await db.exec(`create or replace function net.http_post(url text, headers jsonb, body jsonb, timeout_milliseconds integer default 5000) returns bigint language plpgsql as
  $$ begin raise exception 'pg_net down'; end $$`);
const survived = await report("not_on_tape", DRUMS, "Drums", "1990-03-22");
ok(survived.id, "a report still files when the post to tape-desk throws");
await db.exec(`create or replace function net.http_post(url text, headers jsonb, body jsonb, timeout_milliseconds integer default 5000) returns bigint language sql as
  $$ insert into net.calls (url, headers, body) values (url, headers, body) returning id $$`);

// No vault secret: skip, never fail.
await db.exec(`delete from vault.decrypted_secrets where name = 'email_queue_service_role_key'`);
const novault = await report("not_on_tape", DRUMS, "Drums", "1989-07-07");
ok(novault.id, "a report still files with the vault secret missing");
await db.exec(`insert into vault.decrypted_secrets values ('email_queue_service_role_key', 'svc-key')`);

// The hourly ceiling: thirty dispatches logged in the last hour stop the trigger.
await db.exec(`insert into public.tape_desk_dispatches (issue_id, reason, github_status)
  select '${seed}', 'sweep', 204 from generate_series(1, 30)`);
const n0 = (await lookoutCalls()).length;
await report("not_on_tape", DRUMS, "Drums", "1988-04-02");
eq((await lookoutCalls()).length, n0, "past thirty an hour the trigger leaves the rest to the sweep");
await db.exec(`delete from public.tape_desk_dispatches`);

// ---------------------------------------------------------------------------
// Privileges, as production's default ACL would leave them.
// ---------------------------------------------------------------------------
const tpriv = async (role, t, p) => (await one(`select has_table_privilege('${role}', '${t}', '${p}') as v`)).v;
const fexec = async (role, f) => (await one(`select has_function_privilege('${role}', '${f}', 'execute') as v`)).v;
for (const role of ["anon", "authenticated"]) {
  ok(!(await fexec(role, "public.tape_desk_lookout()")), `${role} cannot execute the trigger function`);
  ok(!(await fexec(role, "public.tape_index_candidates(integer)")), `${role} cannot execute tape_index_candidates`);
  for (const p of ["INSERT", "UPDATE", "DELETE"]) ok(!(await tpriv(role, "public.tape_desk_dispatches", p)), `${role} cannot ${p} the dispatch log`);
}
ok(!(await tpriv("anon", "public.tape_desk_dispatches", "SELECT")), "anon cannot read the dispatch log");
ok(await fexec("service_role", "public.tape_index_candidates(integer)"), "the service role still runs tape_index_candidates");

await db.exec(`insert into auth.users values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', null), ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', null)`);
await db.exec(`insert into public.user_roles values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'admin')`);
await db.exec(`insert into public.tape_desk_dispatches (issue_id, reason, github_status) values ('${seed}', 'reported', 204)`);
const asUser = async (uid, sql) => {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid]);
  await db.query("set role authenticated");
  try { return (await db.query(sql)).rows; } finally { await db.query("reset role"); }
};
eq((await asUser("cccccccc-cccc-4ccc-8ccc-cccccccccccc", "select count(*)::int as c from public.tape_desk_dispatches"))[0].c, 1, "an admin reads the dispatch log");
eq((await asUser("dddddddd-dddd-4ddd-8ddd-dddddddddddd", "select count(*)::int as c from public.tape_desk_dispatches"))[0].c, 0, "a fan reads nothing from it");

// ---------------------------------------------------------------------------
// Pins: provenance is enforced, and the refresh skips a pinned night.
// ---------------------------------------------------------------------------
const T = (id, f) => `https://archive.org/download/${id}/${f}`;
await db.exec(`insert into public.tape_index (song_id, show_date, identifier, status, is_default, track_url)
  values ('${BIRD}', '1971-02-19', 'gd71-02-19.sbd.orf.1029.sbeok.shnf', 'playable', true, '${T("gd71-02-19.sbd.orf.1029.sbeok.shnf", "gd71-02-19d1t05.mp3")}')`);
const rejects = async (sql, m) => { let threw = false; try { await db.exec(sql); } catch { threw = true; } ok(threw, m); };
await rejects(`update public.tape_index set pinned_by = 'someone', pin_issue = 1 where song_id = '${BIRD}'`, "only the tape desk can be named as the pinner");
await rejects(`update public.tape_index set pinned_by = 'tape_desk' where song_id = '${BIRD}'`, "a pin must name its ticket");
await rejects(`update public.tape_index set pin_issue = 153 where song_id = '${BIRD}'`, "a ticket number without a pinner is refused");
await rejects(`insert into public.tape_index (song_id, show_date, identifier, status, pinned_by, pin_issue) values ('${BIRD}', '1972-04-08', '', 'no_match', 'tape_desk', 153)`, "only a playable default can be pinned");

// Before the pin, 1971-02-19 is a candidate once it is stale; after, it is not.
await db.exec(`update public.tape_index set verified_at = now() - interval '30 days'`);
const cand = async () => (await db.query(`select show_date::text as d from public.tape_index_candidates(500) where song_id = '${BIRD}'`)).rows.map((r) => r.d);
ok((await cand()).includes("1971-02-19"), "a stale unpinned night is queued for the refresh");
await db.exec(`update public.tape_index set pinned_by = 'tape_desk', pin_issue = 153, pin_note = 'source choice' where song_id = '${BIRD}' and show_date = '1971-02-19'`);
ok(!(await cand()).includes("1971-02-19"), "a pinned night is never queued for the refresh");
ok((await cand()).includes("1995-06-30"), "the rest of the song's nights still are");
await db.exec(`update public.tape_index set pinned_by = null, pin_issue = null, pin_note = 'unpinned by #153' where song_id = '${BIRD}'`);
ok((await cand()).includes("1971-02-19"), "unpinned, it is queued again");

// Replay with data in place changes nothing.
const rowsBefore = (await one(`select count(*)::int as c from public.playback_issues`)).c;
const callsBefore = (await calls()).length;
await db.exec(lookout);
eq((await one(`select count(*)::int as c from public.playback_issues`)).c, rowsBefore, "a replay touches no report");
eq((await calls()).length, callsBefore, "a replay posts nothing");

console.log(`all ${passed} assertions passed`);
