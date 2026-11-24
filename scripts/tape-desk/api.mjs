#!/usr/bin/env node
/**
 * The Tape desk workflow's way into the database: the tape-desk edge
 * function, authenticated by this run's GitHub OIDC token. No secret is
 * stored anywhere for this; GitHub signs a token naming this repository,
 * workflow and branch, and the function checks exactly that
 * (supabase/functions/tape-desk/logic.ts checkClaims).
 *
 *   node scripts/tape-desk/api.mjs issue  '{"issue_id":"<uuid>"}'
 *   node scripts/tape-desk/api.mjs open
 *   node scripts/tape-desk/api.mjs pin    '{"issue_id":"…","issue_number":153,"identifier":"…","file_name":"…","note":"…"}'
 *   node scripts/tape-desk/api.mjs unpin  '{"issue_id":"…","issue_number":153}'
 *   node scripts/tape-desk/api.mjs alert  '{"issue_id":"…","issue_number":153,"status":"held","class":"N","cause":"…","pick":"…","reason":"…"}'
 *
 * Prints the function's JSON answer. Exits 1 on any non-2xx, so a refusal is
 * never mistaken for an empty answer.
 *
 * Works only inside a GitHub Actions job with `permissions: id-token: write`.
 * On the desktop, the hourly pass reads the database with Lovable's
 * query_database instead (.claude/commands/tape-desk.md).
 */
const API = process.env.TAPE_DESK_API_URL || "https://dplrumaqrdnzwzqmatqr.supabase.co/functions/v1/tape-desk";
const AUDIENCE = "dead-set-tape-desk";

const [action, payload = "{}"] = process.argv.slice(2);
if (!["issue", "open", "pin", "unpin", "alert"].includes(action)) {
  console.error("usage: api.mjs <issue|open|pin|unpin|alert> '<json>'");
  process.exit(2);
}
const reqUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
const reqToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
if (!reqUrl || !reqToken) {
  console.error("No OIDC token available: run inside the Tape desk workflow (permissions: id-token: write).");
  process.exit(2);
}

const tokRes = await fetch(`${reqUrl}&audience=${encodeURIComponent(AUDIENCE)}`, {
  headers: { Authorization: `Bearer ${reqToken}` },
});
if (!tokRes.ok) {
  console.error(`OIDC token request failed: ${tokRes.status}`);
  process.exit(1);
}
const { value: oidc } = await tokRes.json();

let body;
try {
  body = { ...JSON.parse(payload), action };
} catch {
  console.error("payload is not JSON");
  process.exit(2);
}
const res = await fetch(API, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${oidc}` },
  body: JSON.stringify(body),
});
const text = await res.text();
console.log(text);
if (!res.ok) {
  console.error(`tape-desk ${action}: HTTP ${res.status}`);
  process.exit(1);
}
