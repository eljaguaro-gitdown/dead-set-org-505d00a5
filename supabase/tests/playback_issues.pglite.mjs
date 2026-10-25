// Real-Postgres test for supabase/migrations/20261025020000_playback_issues.sql.
// Not part of vitest: it needs PGlite (WASM Postgres), which is deliberately NOT
// a project dependency (bun.lock cannot be regenerated outside Lovable's
// registry; see CLAUDE.md). To run it:
//
//   mkdir -p /tmp/pglite && (cd /tmp/pglite && npm init -y && npm i @electric-sql/pglite@0.5.11)
//   node supabase/tests/playback_issues.pglite.mjs /tmp/pglite supabase/migrations/20261025020000_playback_issues.sql
//
// Exits 0 with "all N assertions passed". Supabase's auth.uid(), anon and
// authenticated roles, has_role(), the vault and pg_net are stubbed below; the
// migration itself is applied unmodified, twice, plus once more with data in it.

// Applies supabase/migrations/20261025020000_playback_issues.sql to a real
// Postgres (PGlite) with Supabase's auth/vault/pg_net stubbed, and walks an
// issue through its whole life. Usage: node run.mjs <pglite-dir> <migration>
import { readFileSync } from "fs";
import { pathToFileURL } from "url";
import path from "path";
import assert from "assert/strict";

const [pgliteDir, migrationPath] = process.argv.slice(2);
const { PGlite } = await import(pathToFileURL(path.join(pgliteDir, "node_modules/@electric-sql/pglite/dist/index.js")).href);
const migration = readFileSync(migrationPath, "utf8");
const db = new PGlite();

const STUBS = `
create role anon nologin; create role authenticated nologin;
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
create table public.songs (id uuid primary key default gen_random_uuid(), title text not null);
create table public.profiles (id uuid primary key default gen_random_uuid(), user_id uuid unique references auth.users(id), display_name text);
create table vault.decrypted_secrets (name text, decrypted_secret text);
insert into vault.decrypted_secrets values
  ('email_queue_service_role_key', 'svc-key'),
  ('send_transactional_email_url', 'https://example.test/functions/v1/send-transactional-email');
create table net.calls (id serial primary key, url text, headers jsonb, body jsonb);
create function net.http_post(url text, headers jsonb, body jsonb) returns bigint language sql as
  $$ insert into net.calls (url, headers, body) values (url, headers, body) returning id $$;
`;

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
const U3 = "33333333-3333-4333-8333-333333333333";
const ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const S1 = "51515151-5151-4515-8515-515151515151";
const S2 = "52525252-5252-4525-8525-525252525252";
const TRACK = (id, f) => `https://archive.org/download/${id}/${f}`;
const ARCHIVE = "https://archive.org/details/gd1979-08-04.sbd.miller.1234";

let passed = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); passed++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); passed++; };

/** Run as a Supabase caller: anon (no uid) or authenticated (uid). */
async function as(uid, sql, params = []) {
  await db.query("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid ?? ""]);
  await db.query(uid ? "set role authenticated" : "set role anon");
  try {
    return await db.query(sql, params);
  } finally {
    await db.query("reset role");
  }
}
async function fails(uid, sql, params, pattern, msg) {
  try {
    await as(uid, sql, params);
  } catch (e) {
    ok(pattern.test(String(e.message)), `${msg} (got: ${e.message})`);
    return;
  }
  assert.fail(`${msg}: expected an error`);
}
const report = (uid, { kind = "not_on_tape", song = S1, title = "althea (as the client named it)", date = "1979-08-04", archive = ARCHIVE, track = null, setlist = null, sha = "4172085", notify = true } = {}) =>
  as(uid, "select public.report_playback_issue($1,$2,$3,$4,$5,$6,$7,$8,$9) as id", [kind, song, title, date, archive, track, setlist, sha, notify]).then((r) => r.rows[0].id);
const calls = async (template) => (await db.query("select body from net.calls order by id")).rows.map((r) => r.body).filter((b) => !template || b.templateName === template);
const issue = async (id) => (await db.query("select * from public.playback_issues where id = $1", [id])).rows[0];

// ── setup ────────────────────────────────────────────────────────────────
await db.exec(STUBS);
await db.exec(migration);
await db.exec(migration); // replay: must be inert
await db.exec(`
  insert into auth.users values ('${U1}', 'u1@example.test'), ('${U2}', 'u2@example.test'), ('${U3}', 'u3@example.test'), ('${ADMIN}', 'admin@example.test');
  insert into public.user_roles values ('${ADMIN}', 'admin');
  insert into public.profiles (user_id, display_name) values ('${U1}', 'jaguaro_fan'), ('${U3}', 'quiet_fan');
  insert into public.songs (id, title) values ('${S1}', 'Althea'), ('${S2}', 'Bertha');
`);
ok(true, "migration applies, and applies again on top of itself");

// ── filing ───────────────────────────────────────────────────────────────
const id1 = await report(null);
ok(/^[0-9a-f-]{36}$/.test(id1), "anon can file a report and gets an id back");
let row = await issue(id1);
eq([row.kind, row.status, row.report_count, row.song_id, row.archive_url, row.last_build_sha], ["not_on_tape", "open", 1, S1, ARCHIVE, "4172085"], "the issue is stored as filed");
eq((await db.query("select count(*)::int as n from public.playback_issue_reporters")).rows[0].n, 0, "anon is not attached as a reporter");
eq((await calls("playback-issue-alert")).length, 1, "a new issue emails the operator once");
eq((await calls("playback-issue-alert"))[0].recipientEmail, "eljaguaro@gmail.com", "to the operator inbox");

const id1b = await report(U1);
eq(id1b, id1, "the same problem from another fan is the same issue");
row = await issue(id1);
eq(row.report_count, 2, "and adds to its count");
eq((await calls("playback-issue-alert")).length, 1, "a repeat does not email the operator again");
eq((await db.query("select user_id, wants_notice, credit_ok from public.playback_issue_reporters")).rows, [{ user_id: U1, wants_notice: true, credit_ok: false }], "a signed-in fan is attached, credit OFF until they say yes");

eq(await report(U3), id1, "a named fan who never ticks credit");
const silent = await report(U2, { notify: false });
eq(silent, id1, "a silent (queue-skip) report lands on the same issue");
eq((await db.query("select count(*)::int as n from public.playback_issue_reporters where user_id = $1", [U2])).rows[0].n, 0, "but promises the fan nothing");

// ── validation ───────────────────────────────────────────────────────────
await fails(null, "select public.report_playback_issue('nonsense',null,'x',null,null,null,null,null,true)", [], /unknown kind/, "an unknown kind is refused");
await fails(null, "select public.report_playback_issue('no_tape',null,'   ',null,null,null,null,null,true)", [], /song title required/, "an empty title is refused");
const odd = await report(null, { kind: "no_tape", song: "99999999-9999-4999-8999-999999999999", title: "Not A Real Song", date: null, archive: "javascript:alert(1)", track: "https://evil.example/x.mp3", sha: "drop table" });
row = await issue(odd);
eq([row.song_id, row.archive_url, row.track_url, row.last_build_sha], [null, null, null, null], "unknown song, bad urls and a bad sha are all dropped, not stored");

// ── direct table access ──────────────────────────────────────────────────
await fails(null, "select * from public.playback_issues", [], /permission denied/, "anon cannot read the queue");
await fails(U1, "insert into public.playback_issues (kind, song_title, dedupe_key) values ('no_tape','x','k')", [], /permission denied/, "a fan cannot write the queue directly");
await fails(null, "insert into public.verified_tapes (track_url, song_id) values ($1, $2)", [TRACK("gd79", "a.mp3"), S1], /permission denied/, "anon cannot mark a tape good directly");
eq((await as(U1, "select count(*)::int as n from public.playback_issues")).rows[0].n, 0, "a non-admin sees no issues through RLS");
eq((await as(U1, "select count(*)::int as n from public.playback_issue_reporters")).rows[0].n, 1, "a fan sees only their own follow");

// ── credit ───────────────────────────────────────────────────────────────
eq((await as(U1, "select public.set_playback_credit($1, true) as ok", [id1])).rows[0].ok, true, "a reporter can say yes to credit");
eq((await as(U2, "select public.set_playback_credit($1, true) as ok", [id1])).rows[0].ok, false, "a non-reporter cannot");
await fails(null, "select public.set_playback_credit($1, true)", [id1], /permission denied/, "anon cannot even call it");

// ── signed out, then signed in ───────────────────────────────────────────
eq((await as(U2, "select public.follow_playback_issue($1) as ok", [id1])).rows[0].ok, true, "a fan who signs in afterwards can follow the issue");
await fails(null, "select public.follow_playback_issue($1)", [id1], /permission denied/, "anon cannot follow");

// ── admin ────────────────────────────────────────────────────────────────
await fails(U1, "select * from public.admin_playback_issues(false)", [], /admins only/, "a fan cannot read the admin queue");
await fails(U1, "select public.set_playback_issue_status($1, 'verified', null)", [id1], /admins only/, "a fan cannot verify an issue");
const q = (await as(ADMIN, "select * from public.admin_playback_issues(false) where id = $1", [id1])).rows[0];
eq([q.song_title, q.report_count, q.followers, q.credited], ["Althea", 4, 3, 1], "the admin queue names the song from `songs` and counts followers and credits");

await as(ADMIN, "select public.set_playback_issue_status($1, 'fixed', 'wrong tape on the version row')", [id1]);
row = await issue(id1);
ok(row.status === "fixed" && row.fixed_at && row.fix_note === "wrong tape on the version row", "an admin can mark it fixed with a note");
eq((await calls("playback-fixed")).length, 0, "fixed alone tells nobody: it is not verified");

const reopened = await report(null);
eq(reopened, id1, "a report after 'fixed' lands on the same issue");
eq((await issue(id1)).status, "open", "and reopens it: it was not fixed");
await as(ADMIN, "select public.set_playback_issue_status($1, 'fixed', null)", [id1]);
eq((await issue(id1)).fix_note, "wrong tape on the version row", "re-marking fixed without a note keeps the old one");

// ── a tape we know plays, and verification by playback ───────────────────
await as(null, "select public.record_tape_ok($1, $2, $3, $4)", [S1, "1979-08-04", ARCHIVE, "https://evil.example/a.mp3"]);
eq((await db.query("select count(*)::int as n from public.verified_tapes")).rows[0].n, 0, "a non-Archive track is never recorded as good");
eq((await issue(id1)).status, "fixed", "and verifies nothing");
await as(null, "select public.record_tape_ok($1, $2, $3, $4)", ["99999999-9999-4999-8999-999999999999", "1979-08-04", ARCHIVE, TRACK("gd79", "x.mp3")]);
eq((await db.query("select count(*)::int as n from public.verified_tapes")).rows[0].n, 0, "an unknown song is never recorded");

await as(null, "select public.record_tape_ok($1, $2, $3, $4)", [S1, "1979-08-04", ARCHIVE, TRACK("gd1979-08-04.sbd.miller.1234", "gd79-08-04d2t03.mp3")]);
row = await issue(id1);
eq([row.status, row.verified_via], ["verified", "playback"], "the first real play of that night verifies the fix");
const fixedMail = await calls("playback-fixed");
eq(fixedMail.map((b) => b.recipientEmail).sort(), ["u1@example.test", "u2@example.test", "u3@example.test"], "every fan waiting is emailed, nobody else");
eq(fixedMail.find((b) => b.recipientEmail === "u1@example.test").templateData.credited, true, "credited only where they said yes AND have a name");
eq(fixedMail.find((b) => b.recipientEmail === "u2@example.test").templateData.credited, false, "no yes, no credit");
eq(fixedMail[0].templateData.songTitle, "Althea", "the email names the song from `songs`, not the report");
ok(fixedMail.every((b) => b.idempotencyKey.startsWith(`playback-fixed-${id1}-`)), "one idempotency key per fan per issue");
eq((await db.query("select count(*)::int as n from public.playback_issue_reporters where notified_at is null and issue_id = $1", [id1])).rows[0].n, 0, "both are marked notified");

await as(null, "select public.record_tape_ok($1, $2, $3, $4)", [S1, "1979-08-04", ARCHIVE, TRACK("gd1979-08-04.sbd.miller.1234", "gd79-08-04d2t03.mp3")]);
eq((await calls("playback-fixed")).length, 3, "a second play of the same tape does not email again");
eq(fixedMail.find((b) => b.recipientEmail === "u3@example.test").templateData.credited, false, "a name alone is not a yes");
eq((await db.query("select ok_count from public.verified_tapes")).rows[0].ok_count, 2, "but is counted");

// ── the fan's side after the fix ─────────────────────────────────────────
let mine = (await as(U1, "select * from public.my_fixed_tapes()")).rows;
eq(mine.map((r) => [r.song_title, r.credit_ok]), [["Althea", true]], "the fan sees their fix, with credit");
eq((await as(U2, "select * from public.my_fixed_tapes()")).rows.map((r) => r.credit_ok), [false], "the other fan sees it without");
await as(U1, "select public.mark_fixed_tape_seen($1)", [id1]);
eq((await as(U1, "select * from public.my_fixed_tapes()")).rows.length, 0, "once seen, it is gone");
eq((await as(U2, "select * from public.my_fixed_tapes()")).rows.length, 1, "for that fan only");
await fails(null, "select * from public.my_fixed_tapes()", [], /permission denied/, "anon cannot ask whose tapes are fixed");
await fails(null, "select * from public.admin_playback_issues(false)", [], /permission denied/, "anon cannot reach the admin queue at all");

const fixes = (await as(null, "select * from public.community_fixes(20)")).rows;
eq(fixes.map((f) => [f.song_title, f.credited]), [["Althea", ["jaguaro_fan"]]], "Build Notes credits the fan who said yes, by profile name");

// ── after verification, it can break again ───────────────────────────────
const again = await report(null);
ok(again !== id1, "a new report of a verified night is a new issue");
await as(null, "select public.record_tape_ok($1, $2, $3, $4)", [S1, "1979-08-04", ARCHIVE, TRACK("gd1979-08-04.other", "t.mp3")]);
eq((await issue(again)).status, "open", "a play of a night nobody has fixed does not verify it: nobody fixed anything");

// ── suggestions ──────────────────────────────────────────────────────────
await as(null, "select public.record_tape_ok($1, $2, $3, $4)", [S2, "1971-02-18", null, TRACK("gd71-02-18.sbd", "bertha.mp3")]);
let sug = (await as(null, "select * from public.suggest_known_good_tape($1, $2, $3)", [S1, "1979-08-04", null])).rows;
eq(sug.map((s) => s.song_title), ["Bertha"], "the failed night itself is never offered; another song is");
await as(null, "select public.record_tape_ok($1, $2, $3, $4)", [S1, "1977-05-08", null, TRACK("gd77-05-08.sbd", "althea.mp3")]);
sug = (await as(null, "select * from public.suggest_known_good_tape($1, $2, $3)", [S1, "1979-08-04", null])).rows;
eq([sug[0].song_title, sug[0].show_date instanceof Date ? sug[0].show_date.toISOString().slice(0, 10) : String(sug[0].show_date)], ["Althea", "1977-05-08"], "the same song on another night is preferred");
sug = (await as(null, "select * from public.suggest_known_good_tape($1, $2, $3)", [S2, "1971-02-18", null])).rows;
ok(!sug.some((s) => s.song_title === "Bertha" && String(s.show_date).includes("1971")), "the night that just failed is not offered back, even with no issue open on it yet");
await report(null, { date: "1977-05-08" });
sug = (await as(null, "select * from public.suggest_known_good_tape($1, $2, $3)", [S1, "1979-08-04", null])).rows;
eq(sug.map((s) => s.song_title), ["Bertha"], "a night with an open issue is not offered as one that plays");

// ── manual verification also tells people ───────────────────────────────
const id3 = await report(U1, { kind: "no_tape", song: S2, title: "Bertha", date: "1972-05-26", archive: null });
await as(ADMIN, "select public.set_playback_issue_status($1, 'verified', null)", [id3]);
eq((await issue(id3)).verified_via, "admin", "verified by hand is recorded as such");
eq((await calls("playback-fixed")).filter((b) => b.idempotencyKey.includes(id3)).map((b) => b.recipientEmail), ["u1@example.test"], "and emails the fan waiting on it");
await as(ADMIN, "select public.set_playback_issue_status($1, 'open', null)", [id3]);
await as(ADMIN, "select public.set_playback_issue_status($1, 'verified', null)", [id3]);
eq((await calls("playback-fixed")).filter((b) => b.idempotencyKey.includes(id3)).length, 1, "reopened and re-verified, nobody is told twice");

// ── flood guard ──────────────────────────────────────────────────────────
const before = (await calls("playback-issue-alert")).length;
const ids = [];
for (let i = 0; i < 205; i++) ids.push(await report(null, { kind: "no_tape", song: null, title: `junk ${i}`, date: null, archive: null }));
ok(ids.slice(-5).every((x) => x === null), "past 200 new issues an hour, reports are dropped, not stored");
ok((await calls("playback-issue-alert")).length <= 10, `operator alerts stay capped at ten an hour (got ${(await calls("playback-issue-alert")).length}, ${before} before the flood)`);

// ── replay with data in it ───────────────────────────────────────────────
const countBefore = (await db.query("select count(*)::int as n from public.playback_issues")).rows[0].n;
await db.exec(migration);
eq((await db.query("select count(*)::int as n from public.playback_issues")).rows[0].n, countBefore, "a replay with data present changes nothing");

console.log(`\nall ${passed} assertions passed`);
