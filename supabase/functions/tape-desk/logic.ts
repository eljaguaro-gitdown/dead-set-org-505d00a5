/**
 * The tape desk's lookout: the decisions, with no I/O (docs/tape-desk.md).
 *
 * A fan's "the song is not on the tape" report becomes a playback_issues row.
 * The tape_desk_lookout trigger posts it here, this function sends a GitHub
 * repository_dispatch, and the Tape desk workflow runs the runbook
 * (.claude/commands/tape-desk.md) on that one ticket. The workflow then calls
 * back here, authenticated by GitHub's own OIDC token, to read the report and
 * to ask for the only two writes the desk may make: an index pin with
 * provenance, and an alert to the owner.
 *
 * Kept free of Deno APIs so Vitest can call every branch.
 */

export const REPO = "eljaguaro-gitdown/dead-set-org-505d00a5";
export const WORKFLOW_PATH = ".github/workflows/tape-desk.yml";
export const OIDC_ISSUER = "https://token.actions.githubusercontent.com";
export const OIDC_AUDIENCE = "dead-set-tape-desk";

/**
 * The kinds the desk fixes end to end: "the song is not on the tape we found"
 * (not_on_tape) and "no tape of the night turned up" (no_tape). wont_play
 * (gesture, mirror, stall) and none_in_setlist are ticketed by the hourly pass
 * and are not dispatched (docs/tape-desk/DECISIONS.md, 2026-11-24).
 */
export const IN_SCOPE_KINDS = ["not_on_tape", "no_tape"] as const;
export const inScope = (kind: string | null | undefined): boolean =>
  (IN_SCOPE_KINDS as readonly string[]).includes(String(kind));

export type DispatchReason = "reported" | "reopened" | "owner_closed" | "sweep" | "synthetic";
export const DISPATCH_REASONS: DispatchReason[] = ["reported", "reopened", "owner_closed", "sweep", "synthetic"];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const isUuid = (s: unknown): s is string => typeof s === "string" && UUID.test(s);

export interface IssueRow {
  id: string;
  kind: string;
  status: string;
  song_id: string | null;
  song_title: string;
  show_date: string | null;
}

/**
 * The key one fix belongs to. Every report of the same song on the same night
 * attaches to one ticket and one concurrency group, so two reports never
 * produce two fixes. A report with no song id falls back to its title, and one
 * with no night to "undated".
 */
export function fixKey(row: Pick<IssueRow, "song_id" | "song_title" | "show_date">): string {
  const song = row.song_id ?? `t-${row.song_title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)}`;
  const night = row.show_date && DAY.test(row.show_date.slice(0, 10)) ? row.show_date.slice(0, 10) : "undated";
  return `${song}-${night}`;
}

/** The repository_dispatch body. Nothing in it identifies a fan. */
export function dispatchBody(row: IssueRow, reason: DispatchReason) {
  return {
    event_type: "tape_desk",
    client_payload: {
      issue_id: row.id,
      song_id: row.song_id,
      show_date: row.show_date ? row.show_date.slice(0, 10) : null,
      kind: row.kind,
      reason,
      key: fixKey(row),
    },
  };
}

// ---------------------------------------------------------------------------
// GitHub OIDC: which workflow runs may call the desk's read and write actions.
// ---------------------------------------------------------------------------

export interface OidcClaims {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  repository?: string;
  ref?: string;
  workflow_ref?: string;
  event_name?: string;
}

/**
 * Only the Tape desk workflow, on main, in this repository, for our audience,
 * unexpired. A fork's workflow, another workflow here, or the same workflow
 * on a branch is refused, so a pull request cannot read reports or write pins.
 */
export function checkClaims(c: OidcClaims, nowSec: number): { ok: true } | { ok: false; why: string } {
  if (c.iss !== OIDC_ISSUER) return { ok: false, why: "issuer" };
  const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
  if (!aud.includes(OIDC_AUDIENCE)) return { ok: false, why: "audience" };
  if (typeof c.exp !== "number" || c.exp <= nowSec) return { ok: false, why: "expired" };
  if (typeof c.nbf === "number" && c.nbf > nowSec + 60) return { ok: false, why: "not yet valid" };
  if (c.repository !== REPO) return { ok: false, why: "repository" };
  if (c.ref !== "refs/heads/main") return { ok: false, why: "ref" };
  if (c.workflow_ref !== `${REPO}/${WORKFLOW_PATH}@refs/heads/main`) return { ok: false, why: "workflow" };
  if (!["repository_dispatch", "workflow_dispatch", "schedule"].includes(String(c.event_name))) return { ok: false, why: "event" };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Pins: the one data write. The caller names an item and a file; the function
// reads the Archive itself and refuses anything the player would not play.
// ---------------------------------------------------------------------------

export interface PinRequest {
  issue_id: string;
  issue_number: number;
  identifier: string;
  file_name: string;
  note: string | null;
}

const IDENT = /^[A-Za-z0-9._-]{1,200}$/;
const FILE = /^[^?#\s/][^?#\s]{0,299}$/;

export function parsePin(body: Record<string, unknown>): { ok: true; pin: PinRequest } | { ok: false; why: string } {
  if (!isUuid(body.issue_id)) return { ok: false, why: "issue_id" };
  const n = Number(body.issue_number);
  if (!Number.isInteger(n) || n <= 0 || n > 1_000_000) return { ok: false, why: "issue_number" };
  if (typeof body.identifier !== "string" || !IDENT.test(body.identifier)) return { ok: false, why: "identifier" };
  // A name, never an address. (It is only ever looked up in the item's own
  // file list, so a url could not be planted anyway; refusing it keeps that
  // from depending on the lookup.)
  if (typeof body.file_name !== "string" || !FILE.test(body.file_name) || body.file_name.includes("..") || body.file_name.includes("://")) {
    return { ok: false, why: "file_name" };
  }
  const note = typeof body.note === "string" ? body.note.slice(0, 500) : null;
  return { ok: true, pin: { issue_id: body.issue_id, issue_number: n, identifier: body.identifier, file_name: body.file_name, note } };
}

export type AlertStatus = "ready" | "held";
export const ALERT_CLASSES = ["M", "S", "N", "G", "A", "C"] as const;

export interface AlertRequest {
  issue_id: string;
  issue_number: number;
  status: AlertStatus;
  cls: (typeof ALERT_CLASSES)[number];
  cause: string;
  pick: string;
  reason: string | null;
  first_sound_ms: number | null;
}

const clip = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");

export function parseAlert(body: Record<string, unknown>): { ok: true; alert: AlertRequest } | { ok: false; why: string } {
  if (!isUuid(body.issue_id)) return { ok: false, why: "issue_id" };
  const n = Number(body.issue_number);
  if (!Number.isInteger(n) || n <= 0 || n > 1_000_000) return { ok: false, why: "issue_number" };
  if (body.status !== "ready" && body.status !== "held") return { ok: false, why: "status" };
  if (!(ALERT_CLASSES as readonly string[]).includes(String(body.class))) return { ok: false, why: "class" };
  const cause = clip(body.cause, 400);
  const pick = clip(body.pick, 600);
  if (!cause || !pick) return { ok: false, why: "cause and pick are required" };
  const reason = clip(body.reason, 300) || null;
  if (body.status === "held" && !reason) return { ok: false, why: "a hold needs its reason" };
  const ms = body.first_sound_ms == null ? null : Number(body.first_sound_ms);
  if (ms !== null && (!Number.isFinite(ms) || ms < 0 || ms > 120_000)) return { ok: false, why: "first_sound_ms" };
  // "Ready to close" is a claim that the exact key played on production; it needs the number.
  if (body.status === "ready" && ms === null) return { ok: false, why: "ready needs production first sound" };
  return {
    ok: true,
    alert: { issue_id: body.issue_id, issue_number: n, status: body.status, cls: body.class as AlertRequest["cls"], cause, pick, reason, first_sound_ms: ms },
  };
}

/** One alert per status per ticket per UTC day: a re-run the same day does not mail the owner twice. */
export const alertIdempotencyKey = (a: Pick<AlertRequest, "status" | "issue_id">, now: Date) =>
  `tape-desk-${a.status}-${a.issue_id}-${now.toISOString().slice(0, 10)}`;
