// Real-Postgres test for the playback-issues migrations:
//   supabase/migrations/20261025020000_playback_issues.sql
//   supabase/migrations/20261026020000_playback_issues_hardening.sql
//   supabase/migrations/20261027000000_record_tape_ok_cap.sql
// Not part of vitest: it needs PGlite (WASM Postgres), which is deliberately NOT
// a project dependency (bun.lock cannot be regenerated outside Lovable's
// registry; see CLAUDE.md). To run it:
//
//   mkdir -p /tmp/pglite && (cd /tmp/pglite && npm init -y && npm i @electric-sql/pglite@0.5.11)
//   node supabase/tests/playback_issues.pglite.mjs /tmp/pglite \
//     supabase/migrations/20261025020000_playback_issues.sql \
//     supabase/migrations/20261026020000_playback_issues_hardening.sql \
//     supabase/migrations/20261027000000_record_tape_ok_cap.sql
//
// Exits 0 with "all N assertions passed". The migrations are applied
// unmodified, in order, twice, and once more with data in them. Stubbed:
// Supabase's auth.uid(), the anon and authenticated roles, has_role(),
// is_objectionable(), the vault and pg_net. Also stubbed are the DEFAULT
// PRIVILEGES this project's postgres role really has. Production's
// pg_default_acl grants EXECUTE on every new function and ALL on every new
// table to anon and authenticated. Without that stub, a `revoke ... from
// public` looks like it closes a function when it does not. That is how the
// 2026-10-25 gate's M1 got past the first version of this file.
//
// Run with fewer than all three migrations, this file FAILS. That is
// expected: each later migration exists to fix what the failures name.
import { readFileSync } from "fs";
import { pathToFileURL } from "url";
import path from "path";
import assert from "assert/strict";

const [pgliteDir, ...migrationPaths] = process.argv.slice(2);
if (!pgliteDir || migrationPaths.length === 0) {
  console.error("usage: node playback_issues.pglite.mjs <pglite-dir> <migration.sql> [<migration.sql> ...]");
  process.exit(2);
}
const { PGlite } = await import(pathToFileURL(path.join(pgliteDir, "node_modules/@electric-sql/pglite/dist/index.js")).href);
const migrations = migrationPaths.map((p) => readFileSync(p, "utf8"));
const applyAll = async () => {
  for (const m of migrations) await db.exec(m);
};
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
create function public.is_objectionable(t text) returns boolean language sql immutable as
  $$ select coalesce(t ~* 'slurword', false) $$;
create table public.songs (id uuid primary key default gen_random_uuid(), title text not null);
create table public.profiles (id uuid primary key default gen_random_uuid(), user_id uuid unique references auth.users(id), display_name text);
create table vault.decrypted_secrets (name text, decrypted_secret text);
insert into vault.decrypted_secrets values
  ('email_queue_service_role_key', 'svc-key'),
  ('send_transactional_email_url', 'https://example.test/functions/v1/send-transactional-email');
create table net.calls (id serial primary key, url text, headers jsonb, body jsonb);
create function net.http_post(url text, headers jsonb, body jsonb) returns bigint language sql as
  $$ insert into net.calls (url, headers, body) values (url, headers, body) returning id $$;
-- What production's pg_default_acl does to everything created after this.
alter default privileges in schema public grant execute on functions to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
`;

const U1 = "11111111-1111-4111-8111-111111111111"; // reports, says yes to credit
const U2 = "22222222-2222-4222-8222-222222222222"; // follows after signing in
const U3 = "33333333-3333-4333-8333-333333333333"; // named, never says yes
const U4 = "44444444-4444-4444-8444-444444444444"; // says yes, name fails the house rules
const U5 = "55555555-5555-4555-8555-555555555555"; // says yes, name is blank
const MEMBER = "66666666-6666-4666-8666-666666666666"; // a signed-in fan who just plays
const ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const S1 = "51515151-5151-4515-8515-515151515151";
const S2 = "52525252-5252-4525-8525-525252525252";
const TRACK = (id, f) => `https://archive.org/download/${id}/${f}`;
const ARCHIVE = "https://archive.org/details/gd1979-08-04.sbd.miller.1234";
const GOOD_79 = TRACK("gd1979-08-04.sbd.miller.1234", "gd79-08-04d2t03.mp3");

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
const played = (uid, song, date, archive, track) =>
  as(uid, "select public.record_tape_ok($1, $2, $3, $4)", [song, date, archive, track]);
const calls = async (template) => (await db.query("select body from net.calls order by id")).rows.map((r) => r.body).filter((b) => !template || b.templateName === template);
const issue = async (id) => (await db.query("select * from public.playback_issues where id = $1", [id])).rows[0];
const tapes = async () => (await db.query("select count(*)::int as n from public.verified_tapes")).rows[0].n;
const iso = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d));

// ── setup ────────────────────────────────────────────────────────────────
await db.exec(STUBS);
await applyAll();
await applyAll(); // replay: must be inert
await db.exec(`
  insert into auth.users values
    ('${U1}', 'u1@example.test'), ('${U2}', 'u2@example.test'), ('${U3}', 'u3@example.test'),
    ('${U4}', 'u4@example.test'), ('${U5}', 'u5@example.test'), ('${MEMBER}', 'member@example.test'),
    ('${ADMIN}', 'admin@example.test');
  insert into public.user_roles values ('${ADMIN}', 'admin');
  insert into public.profiles (user_id, display_name) values
    ('${U1}', 'jaguaro_fan'), ('${U3}', 'quiet_fan'), ('${U4}', 'slurword_fan'), ('${U5}', '   ');
  insert into public.songs (id, title) values ('${S1}', 'Althea'), ('${S2}', 'Bertha');
`);
ok(true, `${migrations.length} migration(s) apply, and apply again on top of themselves`);

// ── grants, against production's real default privileges (gate M1) ───────
for (const [sql, args, what] of [
  ["select public.set_playback_credit($1, true)", ["00000000-0000-4000-8000-000000000000"], "set_playback_credit"],
  ["select public.follow_playback_issue($1)", ["00000000-0000-4000-8000-000000000000"], "follow_playback_issue"],
  ["select * from public.my_fixed_tapes()", [], "my_fixed_tapes"],
  ["select public.mark_fixed_tape_seen($1)", ["00000000-0000-4000-8000-000000000000"], "mark_fixed_tape_seen"],
  ["select * from public.admin_playback_issues(false)", [], "admin_playback_issues"],
  ["select public.set_playback_issue_status($1, 'verified', null)", ["00000000-0000-4000-8000-000000000000"], "set_playback_issue_status"],
]) {
  await fails(null, sql, args, /permission denied/, `anon cannot even call ${what}, default privileges notwithstanding`);
}
for (const who of [null, U1]) {
  await fails(who, "select public.playback_track_matches_night('x', null)", [], /permission denied/, `${who ? "a fan" : "anon"} cannot call the internal night check`);
  await fails(who, "select public.playback_creditable_name('x')", [], /permission denied/, `${who ? "a fan" : "anon"} cannot call the internal credit rule`);
}
await fails(null, "select * from public.verified_tapes", [], /permission denied/, "anon cannot read the tape pool directly");
await fails(null, "select * from public.playback_issue_reporters", [], /permission denied/, "anon cannot read who reported what");

// ── filing ───────────────────────────────────────────────────────────────
const id1 = await report(null);
ok(/^[0-9a-f-]{36}$/.test(id1), "anon can file a report and gets an id back");
let row = await issue(id1);
eq([row.kind, row.status, row.report_count, row.song_id, row.archive_url, row.last_build_sha], ["not_on_tape", "open", 1, S1, ARCHIVE, "4172085"], "the issue is stored as filed");
eq((await db.query("select count(*)::int as n from public.playback_issue_reporters")).rows[0].n, 0, "anon is not attached as a reporter");
eq((await calls("playback-issue-alert")).length, 1, "a new issue emails the operator once");
eq((await calls("playback-issue-alert"))[0].recipientEmail, "eljaguaro@gmail.com", "to the operator inbox");

eq(await report(U1), id1, "the same problem from another fan is the same issue");
eq((await issue(id1)).report_count, 2, "and adds to its count");
eq((await calls("playback-issue-alert")).length, 1, "a repeat does not email the operator again");
eq((await db.query("select user_id, wants_notice, credit_ok from public.playback_issue_reporters")).rows, [{ user_id: U1, wants_notice: true, credit_ok: false }], "a signed-in fan is attached, credit OFF until they say yes");

eq(await report(U3), id1, "a named fan who never ticks credit");
eq(await report(U4), id1, "a fan whose name fails the house rules");
eq(await report(U5), id1, "a fan whose name is blank");
eq(await report(U2, { notify: false }), id1, "a silent (queue-skip) report lands on the same issue");
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
await fails(null, "insert into public.verified_tapes (track_url, song_id) values ($1, $2)", [GOOD_79, S1], /permission denied/, "anon cannot mark a tape good directly");
eq((await as(U1, "select count(*)::int as n from public.playback_issues")).rows[0].n, 0, "a non-admin sees no issues through RLS");
eq((await as(U1, "select count(*)::int as n from public.playback_issue_reporters")).rows[0].n, 1, "a fan sees only their own follow");

// ── credit ───────────────────────────────────────────────────────────────
for (const u of [U1, U4, U5]) {
  eq((await as(u, "select public.set_playback_credit($1, true) as ok", [id1])).rows[0].ok, true, "a reporter can say yes to credit");
}
eq((await as(U2, "select public.set_playback_credit($1, true) as ok", [id1])).rows[0].ok, false, "a non-reporter cannot");

// ── signed out, then signed in ───────────────────────────────────────────
eq((await as(U2, "select public.follow_playback_issue($1) as ok", [id1])).rows[0].ok, true, "a fan who signs in afterwards can follow the issue");

// ── admin ────────────────────────────────────────────────────────────────
await fails(U1, "select * from public.admin_playback_issues(false)", [], /admins only/, "a fan cannot read the admin queue");
await fails(U1, "select public.set_playback_issue_status($1, 'verified', null)", [id1], /admins only/, "a fan cannot verify an issue");
const q = (await as(ADMIN, "select * from public.admin_playback_issues(false) where id = $1", [id1])).rows[0];
eq([q.song_title, q.report_count, q.followers, q.credited], ["Althea", 6, 5, 3], "the admin queue names the song from `songs` and counts followers and credits");

await as(ADMIN, "select public.set_playback_issue_status($1, 'fixed', 'wrong tape on the version row')", [id1]);
row = await issue(id1);
ok(row.status === "fixed" && row.fixed_at && row.fix_note === "wrong tape on the version row", "an admin can mark it fixed with a note");
eq((await calls("playback-fixed")).length, 0, "fixed alone tells nobody: it is not verified");

eq(await report(null), id1, "a report after 'fixed' lands on the same issue");
eq((await issue(id1)).status, "open", "and reopens it: it was not fixed");
await as(ADMIN, "select public.set_playback_issue_status($1, 'fixed', null)", [id1]);
eq((await issue(id1)).fix_note, "wrong tape on the version row", "re-marking fixed without a note keeps the old one");

// ── what counts as a tape that plays (gate M2) ───────────────────────────
await played(null, S1, "1979-08-04", ARCHIVE, "https://evil.example/a.mp3");
eq(await tapes(), 0, "a non-Archive track is never recorded as good");
await played(null, "99999999-9999-4999-8999-999999999999", "1979-08-04", ARCHIVE, GOOD_79);
eq(await tapes(), 0, "an unknown song is never recorded");
await played(null, S1, "1979-08-04", null, TRACK("somebody-else-1979-08-04", "althea.mp3"));
eq(await tapes(), 0, "an Archive item that is not a Dead tape is never recorded");
await played(null, S1, "1979-08-04", null, TRACK("gd1980-05-16.sbd.x", "althea.mp3"));
eq(await tapes(), 0, "a Dead tape of a DIFFERENT night is never recorded under this one");
await played(null, S1, "1977-03-02", null, TRACK("gd77-02-30.sbd.x", "althea.mp3"));
eq(await tapes(), 0, "an impossible date in the identifier is no match, and no error");
await played(null, S1, "1066-10-14", null, TRACK("gd1066-10-14.sbd.x", "althea.mp3"));
eq(await tapes(), 0, "a year the band never played is no match (gd1066-10-14, which the gate stored)");
await played(null, S1, "2099-01-01", null, TRACK("gd2099-01-01.sbd.x", "althea.mp3"));
eq(await tapes(), 0, "nor is a year still to come (gd2099-01-01)");
// Both ends of 1965–1995, from both sides, in both identifier forms. Called as
// the owner, because nobody else may call the helper.
const isNight = async (id, date) =>
  (await db.query("select public.playback_track_matches_night($1, $2) as m", [TRACK(id, "t.mp3"), date])).rows[0].m;
for (const [id, date, want] of [
  ["gd1964-12-31.sbd", "1964-12-31", false],
  ["gd1965-01-01.sbd", "1965-01-01", true],
  ["gd1995-12-31.sbd", "1995-12-31", true],
  ["gd1996-01-01.sbd", "1996-01-01", false],
  ["gd64-12-31.sbd", "1964-12-31", false],
  ["gd65-12-04.sbd", "1965-12-04", true],
  ["gd95-07-09.sbd", "1995-07-09", true],
  ["gd96-01-01.sbd", "1996-01-01", false],
  ["gd00-01-01.sbd", "1900-01-01", false],
]) {
  eq(await isNight(id, date), want, `${id} ${want ? "is" : "is not"} a night the band could have played`);
}
await played(null, S1, null, null, GOOD_79);
eq(await tapes(), 0, "a play with no night cannot be checked, so it does not count");
eq((await issue(id1)).status, "fixed", "and none of that verifies anything");

// ── verification by playback takes a member (gate M2b) ───────────────────
await played(null, S1, "1979-08-04", ARCHIVE, GOOD_79);
eq(await tapes(), 1, "an anonymous play of the right tape is evidence that it plays");
eq((await issue(id1)).status, "fixed", "but an anonymous call verifies nothing: the anon key is public");
eq((await calls("playback-fixed")).length, 0, "so nobody is emailed");

await played(MEMBER, S1, "1979-08-04", ARCHIVE, GOOD_79);
row = await issue(id1);
eq([row.status, row.verified_via, row.verified_by], ["verified", "playback", MEMBER], "a member's play of that night verifies the fix, and says whose");
ok(row.closed_at !== null, "and closes it, as the admin path does");
const fixedMail = await calls("playback-fixed");
eq(fixedMail.map((b) => b.recipientEmail).sort(), ["u1@example.test", "u2@example.test", "u3@example.test", "u4@example.test", "u5@example.test"], "every fan waiting is emailed, nobody else");
const credited = (who) => fixedMail.find((b) => b.recipientEmail === who).templateData.credited;
eq(credited("u1@example.test"), true, "credited where they said yes and have a printable name");
eq(credited("u2@example.test"), false, "no yes, no credit");
eq(credited("u3@example.test"), false, "a name alone is not a yes");
eq(credited("u4@example.test"), false, "a yes with a name that fails the house rules is not printed, so not promised (M3)");
eq(credited("u5@example.test"), false, "a yes with a blank name is not printed, so not promised (M3)");
eq(fixedMail[0].templateData.songTitle, "Althea", "the email names the song from `songs`, not the report");
ok(fixedMail.every((b) => b.idempotencyKey.startsWith(`playback-fixed-${id1}-`)), "one idempotency key per fan per issue");
eq((await db.query("select count(*)::int as n from public.playback_issue_reporters where notified_at is null and issue_id = $1", [id1])).rows[0].n, 0, "all are marked notified");

eq((await db.query("select ok_count from public.verified_tapes")).rows[0].ok_count, 1, "a tape is counted at most once per ten minutes, so a loop cannot buy rank");
await played(MEMBER, S1, "1979-08-04", ARCHIVE, GOOD_79);
eq((await calls("playback-fixed")).length, 5, "another play does not email again");
await db.query("update public.verified_tapes set last_ok_at = now() - interval '11 minutes'");
await played(null, S1, "1979-08-04", ARCHIVE, GOOD_79);
eq((await db.query("select ok_count from public.verified_tapes")).rows[0].ok_count, 2, "after ten minutes, a play counts again");

// ── the fan's side after the fix ─────────────────────────────────────────
eq((await as(U1, "select * from public.my_fixed_tapes()")).rows.map((r) => [r.song_title, r.credit_ok]), [["Althea", true]], "the fan sees their fix, with credit");
eq((await as(U2, "select * from public.my_fixed_tapes()")).rows.map((r) => r.credit_ok), [false], "the other fan sees it without");
eq((await as(U4, "select * from public.my_fixed_tapes()")).rows.map((r) => r.credit_ok), [false], "'your name is on Build Notes' is never said for a name that is not (M3)");
await as(U1, "select public.mark_fixed_tape_seen($1)", [id1]);
eq((await as(U1, "select * from public.my_fixed_tapes()")).rows.length, 0, "once seen, it is gone");
eq((await as(U2, "select * from public.my_fixed_tapes()")).rows.length, 1, "for that fan only");

const fixes = (await as(null, "select * from public.community_fixes(20)")).rows;
eq(fixes.map((f) => [f.song_title, f.credited]), [["Althea", ["jaguaro_fan"]]], "Build Notes credits only the printable name of a fan who said yes (M3)");

// ── after verification, it can break again ───────────────────────────────
const again = await report(null);
ok(again !== id1, "a new report of a verified night is a new issue");
await played(MEMBER, S1, "1979-08-04", ARCHIVE, TRACK("gd1979-08-04.other", "t.mp3"));
eq((await issue(again)).status, "open", "even a member's play does not verify an issue nobody has fixed");

// ── suggestions ──────────────────────────────────────────────────────────
await played(null, S2, "1971-02-18", null, TRACK("gd71-02-18.sbd", "bertha.mp3"));
let sug = (await as(null, "select * from public.suggest_known_good_tape($1, $2, $3)", [S1, "1979-08-04", null])).rows;
eq(sug.map((s) => s.song_title), ["Bertha"], "the failed night itself is never offered; another song is");
await played(null, S1, "1977-05-08", null, TRACK("gd77-05-08.sbd", "althea.mp3"));
sug = (await as(null, "select * from public.suggest_known_good_tape($1, $2, $3)", [S1, "1979-08-04", null])).rows;
eq([sug[0].song_title, iso(sug[0].show_date)], ["Althea", "1977-05-08"], "the same song on another night is preferred");
sug = (await as(null, "select * from public.suggest_known_good_tape($1, $2, $3)", [S2, "1971-02-18", null])).rows;
ok(!sug.some((s) => s.song_title === "Bertha" && iso(s.show_date) === "1971-02-18"), "the night that just failed is not offered back, even with no issue open on it yet");

// A planted row that passes every check still starts at one, behind a tape
// people have actually come back to.
await db.query("update public.verified_tapes set ok_count = 3 where track_url like '%gd77-05-08.sbd%'");
await played(null, S1, "1990-03-29", null, TRACK("gd1990-03-29.planted", "althea.mp3"));
const picks = new Set();
for (let i = 0; i < 20; i++) {
  picks.add(iso((await as(null, "select * from public.suggest_known_good_tape($1, $2, $3)", [S1, "1979-08-04", null])).rows[0].show_date));
}
eq([...picks], ["1977-05-08"], "the most-heard tape is offered, not a fresh one-play row");

await report(null, { date: "1977-05-08" });
sug = (await as(null, "select * from public.suggest_known_good_tape($1, $2, $3)", [S1, "1979-08-04", null])).rows;
ok(sug.length === 1 && iso(sug[0].show_date) !== "1977-05-08", "a night with an open issue is not offered as one that plays");

// ── manual verification also tells people ───────────────────────────────
const id3 = await report(U1, { kind: "no_tape", song: S2, title: "Bertha", date: "1972-05-26", archive: null });
await as(ADMIN, "select public.set_playback_issue_status($1, 'verified', null)", [id3]);
eq((await issue(id3)).verified_via, "admin", "verified by hand is recorded as such");
eq((await calls("playback-fixed")).filter((b) => b.idempotencyKey.includes(id3)).map((b) => b.recipientEmail), ["u1@example.test"], "and emails the fan waiting on it");
await as(ADMIN, "select public.set_playback_issue_status($1, 'open', null)", [id3]);
await as(ADMIN, "select public.set_playback_issue_status($1, 'verified', null)", [id3]);
eq((await calls("playback-fixed")).filter((b) => b.idempotencyKey.includes(id3)).length, 1, "reopened and re-verified, nobody is told twice");

// ── caps (gate M2) ───────────────────────────────────────────────────────
const tapesBefore = (await db.query("select count(*)::int as n from public.verified_tapes where first_ok_at > now() - interval '1 hour'")).rows[0].n;
for (let i = 0; i < 60; i++) {
  const d = new Date(Date.UTC(1973, 0, 1 + i)).toISOString().slice(0, 10);
  await played(null, S2, d, null, TRACK(`gd${d}.cap${i}`, "bertha.mp3"));
}
eq((await db.query("select count(*)::int as n from public.verified_tapes where first_ok_at > now() - interval '1 hour'")).rows[0].n, 40, `at most 40 new tapes enter the pool an hour, across everyone (${tapesBefore} were already in)`);

// A full cap holds back the tape, never the fix (gate note 1 on 2d81fb3).
// The hour's 40 new tapes went to anonymous plays just above. A member then
// plays a tape nobody has stored, of a night an admin has marked fixed.
const held = await report(U1, { kind: "wont_play", song: S2, title: "Bertha", date: "1985-06-30", archive: null });
eq(await report(U3, { kind: "wont_play", song: S2, title: "Bertha", date: "1985-06-30", archive: null }), held, "two fans wait on a Bertha that will not play");
await as(ADMIN, "select public.set_playback_issue_status($1, 'fixed', null)", [held]);
const HELD_TRACK = TRACK("gd1985-06-30.sbd.held", "bertha.mp3");
await played(MEMBER, S2, "1985-06-30", null, HELD_TRACK);
eq((await db.query("select count(*)::int as n from public.verified_tapes where track_url = $1", [HELD_TRACK])).rows[0].n, 0, "with the hour's cap full, the member's new tape is not stored");
row = await issue(held);
eq([row.status, row.verified_via, row.verified_by], ["verified", "playback", MEMBER], "but the play still verifies the fix: 40 anonymous calls an hour cannot hold it back");
ok(row.closed_at !== null, "and closes it");
eq((await calls("playback-fixed")).filter((b) => b.idempotencyKey.includes(held)).map((b) => b.recipientEmail).sort(), ["u1@example.test", "u3@example.test"], "and both fans waiting on it are emailed");

const alertsBefore = (await calls("playback-issue-alert")).length;
const ids = [];
for (let i = 0; i < 205; i++) ids.push(await report(null, { kind: "no_tape", song: null, title: `junk ${i}`, date: null, archive: null }));
ok(ids.slice(-5).every((x) => x === null), "past 200 new issues an hour, new problems are dropped, not stored");
eq(await report(U1), again, "but a fan joining a problem that is already open is never turned away");
ok((await calls("playback-issue-alert")).length <= 10, `operator alerts stay capped at ten an hour (got ${(await calls("playback-issue-alert")).length}, ${alertsBefore} before the flood)`);

// ── replay with data in it ───────────────────────────────────────────────
const countBefore = (await db.query("select count(*)::int as n from public.playback_issues")).rows[0].n;
await applyAll();
eq((await db.query("select count(*)::int as n from public.playback_issues")).rows[0].n, countBefore, "a replay with data present changes nothing");
await fails(null, "select * from public.admin_playback_issues(false)", [], /permission denied/, "and leaves anon locked out");

console.log(`\nall ${passed} assertions passed`);
