// tape-desk: the lookout between a fan's report and the Tape desk workflow
// (docs/tape-desk.md, .claude/commands/tape-desk.md).
//
// POST { action: "dispatch", issue_id, reason }          the database only
//   Sent by the tape_desk_lookout trigger with the vault's service key as the
//   bearer, proven with Supabase (checkAdmin). Sends a GitHub
//   repository_dispatch, which starts .github/workflows/tape-desk.yml on that
//   one ticket. Kinds outside the desk's scope are logged and not sent.
//
// POST { action: "issue" | "open" | "pin" | "unpin" | "alert", ... }
//   The Tape desk workflow only, proven by the GitHub OIDC token of a run of
//   that workflow, on main, in this repository (oidc.ts, logic.ts). Reads
//   never include who reported: a count of fans waiting, no ids, no emails.
//
// verify_jwt = false (config.toml): an OIDC token is not a Supabase JWT, so
// every action checks its own caller before reading anything.
//
// The desk never presses Mark fixed and never emails a fan. Its one email goes
// to the owner's inboxes through send-transactional-email, the path that sent
// the original "Tape wouldn't play" alert.
import { createClient } from "npm:@supabase/supabase-js@2";
import { checkAdmin, describeBearer } from "../_shared/requireAdmin.ts";
import { INTERNAL_SEND_HEADER, internalSendToken } from "../_shared/internalSend.ts";
import { playableRow, readItem } from "../_shared/tapeIndexResolve.ts";
import { OWNER_INBOXES } from "../_shared/ownerInboxes.ts";
import {
  DISPATCH_REASONS,
  REPO,
  alertIdempotencyKey,
  dispatchBody,
  inScope,
  isUuid,
  parseAlert,
  parsePin,
  type DispatchReason,
} from "./logic.ts";
import { GITHUB_JWKS_URL, verifyGithubOidc, type Jwk } from "./oidc.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const ISSUE_COLUMNS =
  "id, kind, status, song_id, song_title, show_date, archive_url, track_url, setlist_id, report_count, first_reported_at, last_reported_at, last_build_sha, fixed_at, fix_note, verified_at, verified_via, closed_at";

let jwksCache: { at: number; keys: Jwk[] } | null = null;
async function githubKeys(): Promise<Jwk[]> {
  if (jwksCache && Date.now() - jwksCache.at < 10 * 60_000) return jwksCache.keys;
  const res = await fetch(GITHUB_JWKS_URL);
  if (!res.ok) throw new Error(`jwks ${res.status}`);
  const keys = ((await res.json()) as { keys: Jwk[] }).keys ?? [];
  jwksCache = { at: Date.now(), keys };
  return keys;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(url, serviceKey);
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }
  const auth = req.headers.get("authorization");

  // -------------------------------------------------------------------------
  // dispatch: from the database trigger, service role only.
  // -------------------------------------------------------------------------
  if (body.action === "dispatch") {
    const check = await checkAdmin(auth, {
      serviceRoleKey: serviceKey,
      getUserId: async () => null,
      isAdmin: async () => false,
      isServiceRoleToken: async (token) => {
        const probe = createClient(url, token, { auth: { autoRefreshToken: false, persistSession: false } });
        const { error } = await probe.auth.admin.listUsers({ page: 1, perPage: 1 });
        return !error;
      },
    });
    if (!check.ok || check.callerId !== null) {
      console.warn("tape-desk dispatch refused:", describeBearer(auth));
      return json({ error: "service role only" }, 401);
    }
    const reason = String(body.reason) as DispatchReason;
    if (!isUuid(body.issue_id) || !DISPATCH_REASONS.includes(reason)) return json({ error: "bad request" }, 400);
    const { data: row, error } = await db.from("playback_issues").select("id, kind, status, song_id, song_title, show_date").eq("id", body.issue_id).maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!row) return json({ error: "no such issue" }, 404);
    if (!inScope(row.kind)) {
      await db.from("tape_desk_dispatches").insert({ issue_id: row.id, reason, github_status: null, note: `out of scope: ${row.kind}` });
      return json({ dispatched: false, why: "out of scope" });
    }
    const ghToken = Deno.env.get("TAPE_DESK_GITHUB_TOKEN");
    if (!ghToken) {
      // The hourly sweep finds undispatched tickets, so a missing token delays
      // a ticket by up to an hour; it never loses one.
      await db.from("tape_desk_dispatches").insert({ issue_id: row.id, reason, github_status: null, note: "no TAPE_DESK_GITHUB_TOKEN" });
      return json({ dispatched: false, why: "no token" });
    }
    let status: number | null = null;
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/dispatches`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ghToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "dead-set-tape-desk",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dispatchBody(row, reason)),
      });
      status = res.status;
      await res.body?.cancel();
    } catch (e) {
      console.warn("tape-desk dispatch failed:", String(e));
    }
    await db.from("tape_desk_dispatches").insert({ issue_id: row.id, reason, github_status: status, note: status === 204 ? null : "github did not accept" });
    return json({ dispatched: status === 204, status });
  }

  // -------------------------------------------------------------------------
  // Everything else: the Tape desk workflow, by its OIDC token.
  // -------------------------------------------------------------------------
  const who = await verifyGithubOidc(auth, { jwks: githubKeys, nowSec: Math.floor(Date.now() / 1000) });
  if (!who.ok) {
    console.warn("tape-desk refused:", who.why);
    return json({ error: "tape desk workflow only" }, 401);
  }

  const waitingCount = async (issueId: string) => {
    const { count } = await db
      .from("playback_issue_reporters")
      .select("issue_id", { count: "exact", head: true })
      .eq("issue_id", issueId)
      .eq("wants_notice", true)
      .is("notified_at", null);
    return count ?? 0;
  };

  if (body.action === "issue") {
    if (!isUuid(body.issue_id)) return json({ error: "issue_id" }, 400);
    const { data: row, error } = await db.from("playback_issues").select(ISSUE_COLUMNS).eq("id", body.issue_id).maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!row) return json({ error: "no such issue" }, 404);
    const song = row.song_id
      ? (await db.from("songs").select("title, first_played, last_played, times_played").eq("id", row.song_id).maybeSingle()).data
      : null;
    const index = row.song_id && row.show_date
      ? (await db.from("tape_index").select("identifier, status, is_default, track_url, file_name, title_on_tape, duration_s, match_score, verified_at, pinned_by, pin_issue").eq("song_id", row.song_id).eq("show_date", row.show_date)).data
      : [];
    const { data: dispatches } = await db.from("tape_desk_dispatches").select("reason, dispatched_at, github_status, note").eq("issue_id", row.id).order("dispatched_at", { ascending: false }).limit(10);
    return json({ issue: row, song, waiting: await waitingCount(row.id), index, dispatches, in_scope: inScope(row.kind) });
  }

  if (body.action === "open") {
    const { data, error } = await db
      .from("playback_issues")
      .select(ISSUE_COLUMNS)
      .in("kind", ["not_on_tape", "no_tape"])
      .or(`status.in.(open,fixed),closed_at.gt.${new Date(Date.now() - 30 * 864e5).toISOString()}`)
      .order("first_reported_at");
    if (error) return json({ error: error.message }, 500);
    const rows = [];
    for (const r of data ?? []) rows.push({ ...r, waiting: await waitingCount(r.id) });
    return json({ issues: rows });
  }

  if (body.action === "pin" || body.action === "unpin") {
    if (!isUuid(body.issue_id)) return json({ error: "issue_id" }, 400);
    const { data: row } = await db.from("playback_issues").select("id, kind, status, song_id, show_date").eq("id", body.issue_id).maybeSingle();
    if (!row || !inScope(row.kind) || !row.song_id || !row.show_date) return json({ error: "not a pinnable report" }, 400);

    if (body.action === "unpin") {
      const n = Number(body.issue_number);
      if (!Number.isInteger(n) || n <= 0) return json({ error: "issue_number" }, 400);
      // The row stays as the night's answer; the refresh re-verifies it from now on.
      const { error } = await db.from("tape_index").update({ pinned_by: null, pin_issue: null, pin_note: `unpinned by #${n}` })
        .eq("song_id", row.song_id).eq("show_date", row.show_date).not("pinned_by", "is", null);
      return error ? json({ error: error.message }, 500) : json({ unpinned: true });
    }

    const parsed = parsePin(body);
    if (!parsed.ok) return json({ error: parsed.why }, 400);
    if (row.status !== "open" && row.status !== "fixed") return json({ error: "the report is closed" }, 409);
    const { data: song } = await db.from("songs").select("title").eq("id", row.song_id).maybeSingle();
    if (!song?.title) return json({ error: "unknown song" }, 404);
    // Read the item from the Archive here, and build the row with the
    // indexer's own builder, limited to the named file. The caller names a
    // file; it can never hand over a url.
    const item = await readItem(fetch, parsed.pin.identifier, { n: 0 });
    if (!item.meta) return json({ error: item.unreachable ? "archive unreachable" : "no such item" }, item.unreachable ? 503 : 404);
    const built = playableRow(row.song_id, row.show_date, item.id, item.meta, song.title, true, parsed.pin.file_name);
    if (!built) return json({ error: "that file is not this song by the player's own rules" }, 422);
    // The old default loses its pin in the same update: tape_index_pin_shape
    // requires a pinned row to be the default, so clearing is_default alone
    // refused a re-pin of a pinned night (gate note on a9ae79c).
    const { error: clearErr } = await db.from("tape_index").update({ is_default: false, pinned_by: null, pin_issue: null })
      .eq("song_id", row.song_id).eq("show_date", row.show_date).eq("is_default", true);
    if (clearErr) return json({ error: clearErr.message }, 500);
    const { error: putErr } = await db.from("tape_index").upsert(
      { ...built, verified_at: new Date().toISOString(), pinned_by: "tape_desk", pin_issue: parsed.pin.issue_number, pin_note: parsed.pin.note },
      { onConflict: "song_id,show_date,identifier" },
    );
    if (putErr) return json({ error: putErr.message }, 500);
    return json({ pinned: { track_url: built.track_url, title_on_tape: built.title_on_tape, duration_s: built.duration_s, match_score: built.match_score } });
  }

  if (body.action === "alert") {
    const parsed = parseAlert(body);
    if (!parsed.ok) return json({ error: parsed.why }, 400);
    const a = parsed.alert;
    const { data: row } = await db.from("playback_issues").select("id, kind, song_id, song_title, show_date").eq("id", a.issue_id).maybeSingle();
    if (!row) return json({ error: "no such issue" }, 404);
    const title = row.song_id
      ? ((await db.from("songs").select("title").eq("id", row.song_id).maybeSingle()).data?.title ?? row.song_title)
      : row.song_title;
    const waiting = await waitingCount(row.id);
    const token = await internalSendToken(serviceKey);
    const failures: string[] = [];
    // The owner's inboxes, the same list the sign-up alert uses. Never a fan.
    for (const to of OWNER_INBOXES) {
      const { error } = await db.functions.invoke("send-transactional-email", {
        headers: { [INTERNAL_SEND_HEADER]: token },
        body: {
          templateName: "tape-desk-alert",
          recipientEmail: to,
          idempotencyKey: `${alertIdempotencyKey(a, new Date())}-${OWNER_INBOXES.indexOf(to)}`,
          templateData: {
            status: a.status,
            songTitle: title,
            showDate: row.show_date,
            cls: a.cls,
            cause: a.cause,
            pick: a.pick,
            reason: a.reason,
            firstSoundMs: a.first_sound_ms,
            waiting,
            issueUrl: `https://github.com/${REPO}/issues/${a.issue_number}`,
            adminUrl: "https://dead-set.org/admin",
          },
        },
      });
      if (error) failures.push(String(error.message ?? error));
    }
    return failures.length ? json({ error: failures.join("; ") }, 502) : json({ alerted: OWNER_INBOXES.length });
  }

  return json({ error: "unknown action" }, 400);
});
