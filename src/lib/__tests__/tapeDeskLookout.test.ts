import { beforeAll, describe, expect, it } from "vitest";
import { readSource } from "@/test/sourceFiles";
import {
  OIDC_AUDIENCE,
  OIDC_ISSUER,
  REPO,
  WORKFLOW_PATH,
  alertIdempotencyKey,
  checkClaims,
  dispatchBody,
  fixKey,
  inScope,
  parseAlert,
  parsePin,
  type OidcClaims,
} from "../../../supabase/functions/tape-desk/logic";
import { verifyGithubOidc, type Jwk } from "../../../supabase/functions/tape-desk/oidc";

const ISSUE = "646bdcf2-3d29-49aa-8fd6-f64c55ed8e40"; // Bird Song 1972-04-08 (#153)
const SONG = "3c1d6a0e-1b8f-4a52-9d55-0b6a1c2f9e11";
const NOW = 1_795_000_000;

const goodClaims = (over: Partial<OidcClaims> = {}): OidcClaims => ({
  iss: OIDC_ISSUER,
  aud: OIDC_AUDIENCE,
  exp: NOW + 300,
  nbf: NOW - 10,
  iat: NOW - 10,
  repository: REPO,
  ref: "refs/heads/main",
  workflow_ref: `${REPO}/${WORKFLOW_PATH}@refs/heads/main`,
  event_name: "repository_dispatch",
  ...over,
});

describe("scope", () => {
  it("the desk fixes not_on_tape and no_tape, nothing else", () => {
    expect(inScope("not_on_tape")).toBe(true);
    expect(inScope("no_tape")).toBe(true);
    expect(inScope("wont_play")).toBe(false);
    expect(inScope("none_in_setlist")).toBe(false);
    expect(inScope(null)).toBe(false);
  });
});

describe("fixKey and the dispatch body", () => {
  it("one key per song and night, so two reports share one concurrency group", () => {
    const a = fixKey({ song_id: SONG, song_title: "Bird Song", show_date: "1972-04-08" });
    const b = fixKey({ song_id: SONG, song_title: "Bird Song (live)", show_date: "1972-04-08T00:00:00Z" });
    expect(a).toBe(`${SONG}-1972-04-08`);
    expect(b).toBe(a);
  });

  it("a different night is a different key", () => {
    expect(fixKey({ song_id: SONG, song_title: "x", show_date: "1971-03-24" })).not.toBe(
      fixKey({ song_id: SONG, song_title: "x", show_date: "1972-04-08" }),
    );
  });

  it("falls back to a title slug and 'undated' when the row has neither id nor night", () => {
    expect(fixKey({ song_id: null, song_title: "Bird Song!", show_date: null })).toBe("t-bird-song-undated");
  });

  it("the payload names the ticket, the key and the reason, and nothing about a fan", () => {
    const body = dispatchBody(
      { id: ISSUE, kind: "not_on_tape", status: "open", song_id: SONG, song_title: "Bird Song", show_date: "1972-04-08" },
      "reported",
    );
    expect(body).toEqual({
      event_type: "tape_desk",
      client_payload: { issue_id: ISSUE, song_id: SONG, show_date: "1972-04-08", kind: "not_on_tape", reason: "reported", key: `${SONG}-1972-04-08` },
    });
    expect(JSON.stringify(body)).not.toMatch(/user|email|reporter|distinct/i);
  });
});

describe("checkClaims: only the Tape desk workflow, on main, here", () => {
  it("accepts the real shape", () => {
    expect(checkClaims(goodClaims(), NOW)).toEqual({ ok: true });
  });
  it.each([
    ["issuer", { iss: "https://evil.example" }],
    ["audience", { aud: "sts.amazonaws.com" }],
    ["expired", { exp: NOW - 1 }],
    ["expired", { exp: undefined }],
    ["not yet valid", { nbf: NOW + 3600 }],
    ["repository", { repository: "someone/dead-set-org-505d00a5" }],
    ["ref", { ref: "refs/heads/tape-desk/153-bird-song" }],
    ["ref", { ref: "refs/pull/12/merge" }],
    ["workflow", { workflow_ref: `${REPO}/.github/workflows/ci.yml@refs/heads/main` }],
    ["workflow", { workflow_ref: `${REPO}/${WORKFLOW_PATH}@refs/heads/other` }],
    ["event", { event_name: "pull_request_target" }],
  ] as const)("refuses a wrong %s", (why, over) => {
    expect(checkClaims(goodClaims(over as Partial<OidcClaims>), NOW)).toEqual({ ok: false, why });
  });
  it("accepts an audience list that contains ours", () => {
    expect(checkClaims(goodClaims({ aud: ["x", OIDC_AUDIENCE] }), NOW)).toEqual({ ok: true });
  });
  it("accepts the hourly pass's workflow_dispatch", () => {
    expect(checkClaims(goodClaims({ event_name: "workflow_dispatch" }), NOW)).toEqual({ ok: true });
  });
});

describe("verifyGithubOidc: the signature, then the claims", () => {
  let keys: CryptoKeyPair;
  let other: CryptoKeyPair;
  let jwk: Jwk;
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const sign = async (claims: OidcClaims, header: Record<string, unknown> = { alg: "RS256", kid: "k1" }, key = keys.privateKey) => {
    const h = enc(header);
    const p = enc(claims);
    const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${h}.${p}`));
    return `Bearer ${h}.${p}.${Buffer.from(sig).toString("base64url")}`;
  };
  const deps = () => ({ jwks: async () => [jwk], nowSec: NOW });

  beforeAll(async () => {
    const params = { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" };
    keys = (await crypto.subtle.generateKey(params, true, ["sign", "verify"])) as CryptoKeyPair;
    other = (await crypto.subtle.generateKey(params, true, ["sign", "verify"])) as CryptoKeyPair;
    const pub = await crypto.subtle.exportKey("jwk", keys.publicKey);
    jwk = { kid: "k1", kty: "RSA", n: pub.n, e: pub.e, alg: "RS256" };
  });

  it("a token GitHub signed for this workflow passes", async () => {
    const r = await verifyGithubOidc(await sign(goodClaims()), deps());
    expect(r.ok).toBe(true);
  });

  it("good claims signed by any other key are refused", async () => {
    expect(await verifyGithubOidc(await sign(goodClaims(), undefined, other.privateKey), deps())).toEqual({ ok: false, why: "signature" });
  });

  it("a tampered payload is refused even though the claims would pass", async () => {
    const t = await sign(goodClaims({ repository: "fork/x" }));
    const [h, , s] = t.slice(7).split(".");
    const forged = `Bearer ${h}.${enc(goodClaims())}.${s}`;
    expect(await verifyGithubOidc(forged, deps())).toEqual({ ok: false, why: "signature" });
  });

  it("a validly signed token from another workflow is refused on its claims", async () => {
    const t = await sign(goodClaims({ workflow_ref: `${REPO}/.github/workflows/ci.yml@refs/heads/main` }));
    expect(await verifyGithubOidc(t, deps())).toEqual({ ok: false, why: "workflow" });
  });

  it("alg none is refused before any key is looked at", async () => {
    const t = `Bearer ${enc({ alg: "none", kid: "k1" })}.${enc(goodClaims())}.x`;
    expect(await verifyGithubOidc(t, deps())).toEqual({ ok: false, why: "alg" });
  });

  it("an HMAC token is refused (no key confusion)", async () => {
    const t = await sign(goodClaims(), { alg: "HS256", kid: "k1" });
    expect(await verifyGithubOidc(t, deps())).toEqual({ ok: false, why: "alg" });
  });

  it("an unknown key id is refused", async () => {
    expect(await verifyGithubOidc(await sign(goodClaims(), { alg: "RS256", kid: "nope" }), deps())).toEqual({ ok: false, why: "unknown key" });
  });

  it("no keys from GitHub means no entry, never a pass", async () => {
    const r = await verifyGithubOidc(await sign(goodClaims()), { jwks: async () => { throw new Error("down"); }, nowSec: NOW });
    expect(r).toEqual({ ok: false, why: "keys unavailable" });
  });

  it.each([[null], ["Bearer"], ["Basic abc"], ["Bearer a.b"], ["Bearer not a token"]])("refuses %s", async (h) => {
    expect((await verifyGithubOidc(h, deps())).ok).toBe(false);
  });
});

describe("parsePin: the caller names an item and a file, never a url", () => {
  const ok = { issue_id: ISSUE, issue_number: 153, identifier: "gd72-04-08.sbd.giles-jeffm.2534.sbeok.shnf", file_name: "gd72-04-08d1t01.mp3", note: "why" };
  it("accepts a plain request", () => {
    expect(parsePin(ok)).toEqual({ ok: true, pin: ok });
  });
  it.each([
    ["issue_id", { issue_id: "x" }],
    ["issue_number", { issue_number: 0 }],
    ["issue_number", { issue_number: 1.5 }],
    ["identifier", { identifier: "../etc" }],
    ["identifier", { identifier: "a b" }],
    ["file_name", { file_name: "https://evil.example/x.mp3" }],
    ["file_name", { file_name: "../../other/x.mp3" }],
    ["file_name", { file_name: "x.mp3?u=1" }],
    ["file_name", { file_name: "/abs.mp3" }],
  ] as const)("refuses a bad %s", (why, over) => {
    expect(parsePin({ ...ok, ...over })).toEqual({ ok: false, why });
  });
  it("clips the note", () => {
    const r = parsePin({ ...ok, note: "n".repeat(900) });
    expect(r.ok && r.pin.note?.length).toBe(500);
  });
});

describe("parseAlert", () => {
  const held = { issue_id: ISSUE, issue_number: 153, status: "held", class: "N", cause: "not played that night", pick: "repoint the night", reason: "night data is the owner's" };
  it("a hold needs its reason", () => {
    expect(parseAlert({ ...held, reason: "" })).toEqual({ ok: false, why: "a hold needs its reason" });
    expect(parseAlert(held).ok).toBe(true);
  });
  it("ready-to-close needs the production first-sound number, because it claims the key plays there", () => {
    expect(parseAlert({ ...held, status: "ready", reason: null })).toEqual({ ok: false, why: "ready needs production first sound" });
    expect(parseAlert({ ...held, status: "ready", reason: null, first_sound_ms: 640 })).toMatchObject({ ok: true, alert: { first_sound_ms: 640 } });
  });
  it.each([
    ["status", { status: "fixed" }],
    ["class", { class: "X" }],
    ["first_sound_ms", { first_sound_ms: -1 }],
    ["first_sound_ms", { first_sound_ms: "fast" }],
    ["cause and pick are required", { cause: "  " }],
  ] as const)("refuses a bad %s", (why, over) => {
    expect(parseAlert({ ...held, ...over })).toEqual({ ok: false, why });
  });
  it("one alert per status per ticket per day", () => {
    const d = new Date("2026-11-24T08:00:00Z");
    expect(alertIdempotencyKey({ status: "held", issue_id: ISSUE }, d)).toBe(`tape-desk-held-${ISSUE}-2026-11-24`);
    expect(alertIdempotencyKey({ status: "ready", issue_id: ISSUE }, d)).not.toBe(alertIdempotencyKey({ status: "held", issue_id: ISSUE }, d));
  });
});

describe("tape-desk/index.ts: who is checked, before what", () => {
  const src = readSource("supabase/functions/tape-desk/index.ts")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  const dispatch = src.slice(src.indexOf('if (body.action === "dispatch")'), src.indexOf("const who = await verifyGithubOidc"));
  const rest = src.slice(src.indexOf("const who = await verifyGithubOidc"));

  it("dispatch refuses anything but the service role before it reads a row", () => {
    const refusal = dispatch.search(/if \(!check\.ok \|\| check\.callerId !== null\) \{[\s\S]*?return json\(\{ error: "service role only" \}, 401\);/);
    expect(refusal).toBeGreaterThan(-1);
    expect(dispatch.indexOf('db.from("playback_issues")')).toBeGreaterThan(refusal);
    expect(dispatch).toMatch(/getUserId: async \(\) => null,/);
    expect(dispatch).toMatch(/return !error;/);
  });

  it("dispatch sends only in-scope kinds to GitHub", () => {
    expect(dispatch.indexOf("if (!inScope(row.kind))")).toBeLessThan(dispatch.indexOf("api.github.com"));
  });

  it("every other action is behind the OIDC check, which returns 401 on a refusal", () => {
    expect(rest).toMatch(/^const who = await verifyGithubOidc\(auth, \{ jwks: githubKeys, nowSec: Math\.floor\(Date\.now\(\) \/ 1000\) \}\);\s*if \(!who\.ok\) \{[\s\S]*?return json\(\{ error: "tape desk workflow only" \}, 401\);/);
    for (const action of ["issue", "open", "pin", "alert"]) {
      expect(src.indexOf(`body.action === "${action}"`)).toBeGreaterThan(src.indexOf("const who = await verifyGithubOidc"));
    }
  });

  it("never reads who reported: reporters are only counted", () => {
    const reporterReads = [...src.matchAll(/from\("playback_issue_reporters"\)([^;]*)/g)].map((m) => m[1]);
    expect(reporterReads.length).toBeGreaterThan(0);
    for (const r of reporterReads) {
      expect(r).toMatch(/\.select\("issue_id", \{ count: "exact", head: true \}\)/);
      expect(r).not.toMatch(/user_id|email/);
    }
    expect(src).not.toMatch(/auth\.users|\.email\b|getUserById/);
  });

  it("never touches a report's status: Mark fixed is the owner's", () => {
    expect(src).not.toMatch(/from\("playback_issues"\)\s*\.(update|upsert|insert|delete)/);
    expect(src).not.toMatch(/set_playback_issue_status/);
  });

  it("alerts go to the owner's inboxes only, through the internal send", () => {
    const alert = src.slice(src.indexOf('if (body.action === "alert")'));
    expect(alert).toMatch(/for \(const to of OWNER_INBOXES\)/);
    expect(alert).toMatch(/recipientEmail: to,/);
    expect(alert).toMatch(/templateName: "tape-desk-alert"/);
    expect(alert).toMatch(/headers: \{ \[INTERNAL_SEND_HEADER\]: token \}/);
    expect(src).toMatch(/import \{ OWNER_INBOXES \} from "\.\.\/send-transactional-email\/authorize\.ts";/);
  });

  it("a pin is built from the Archive by the indexer's own builder, limited to the named file", () => {
    const pin = src.slice(src.indexOf("const parsed = parsePin(body);"));
    expect(pin).toMatch(/const item = await readItem\(fetch, parsed\.pin\.identifier, \{ n: 0 \}\);/);
    expect(pin).toMatch(/playableRow\(row\.song_id, row\.show_date, item\.id, item\.meta, song\.title, true, parsed\.pin\.file_name\)/);
    // The whole written row, exactly: the builder's fields plus provenance and
    // nothing else. A grep for one bad spelling ("track_url: body.") let
    // `track_url: String(body.track_url)` through on the first mutation run.
    expect(pin).toMatch(
      /\.upsert\(\s*\{ \.\.\.built, verified_at: new Date\(\)\.toISOString\(\), pinned_by: "tape_desk", pin_issue: parsed\.pin\.issue_number, pin_note: parsed\.pin\.note \},\s*\{ onConflict: "song_id,show_date,identifier" \},\s*\)/,
    );
    expect(pin.match(/\.upsert\(/g)).toHaveLength(1);
  });
});

describe("index-tapes leaves a pinned night alone", () => {
  const src = readSource("supabase/functions/index-tapes/index.ts")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  const store = src.slice(src.indexOf("async function store("), src.indexOf("Deno.serve("));
  it("checks for a pin before clearing the night's default or writing", () => {
    const check = store.indexOf('.not("pinned_by", "is", null)');
    expect(check).toBeGreaterThan(-1);
    expect(store).toMatch(/if \(pinned\?\.length\) return null;/);
    expect(store.indexOf("update({ is_default: false })")).toBeGreaterThan(check);
    expect(store.indexOf(".upsert(")).toBeGreaterThan(check);
  });
});

describe("the alert template is internal", () => {
  const reg = readSource("supabase/functions/_shared/transactional-email-templates/registry.ts");
  it("is registered and skips the subscriber suppression list like every operator alert", () => {
    expect(reg).toMatch(/'tape-desk-alert': tapeDeskAlert,/);
    const internal = reg.slice(reg.indexOf("INTERNAL_TEMPLATES"));
    expect(internal).toMatch(/'tape-desk-alert',/);
  });
});
