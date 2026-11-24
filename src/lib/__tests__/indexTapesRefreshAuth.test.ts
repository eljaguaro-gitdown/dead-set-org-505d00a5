import { describe, expect, it, vi } from "vitest";
import { readSource } from "@/test/sourceFiles";
import { refreshAuthorized, type RefreshAuthDeps } from "../../../supabase/functions/index-tapes/refreshAuth";

/**
 * #155: the hourly tape-index refresh was refused on every run since it
 * deployed, because the cron hashes the vault's service key and index-tapes
 * hashed its own, and those are different keys. These call the guard itself.
 */
const OWN = "own-service-key";
const OWN_HASH = "hash-of-own";
// A JWT whose role claim is service_role (unsigned: only the claim is read before asking Supabase).
const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const VAULT_JWT = `${b64({ alg: "HS256" })}.${b64({ role: "service_role" })}.sig`;
const ANON_JWT = `${b64({ alg: "HS256" })}.${b64({ role: "anon" })}.sig`;

const deps = (over: Partial<RefreshAuthDeps> = {}): RefreshAuthDeps => ({
  serviceRoleKey: OWN,
  expectedInternal: OWN_HASH,
  isServiceRoleToken: vi.fn(async (t: string) => t === VAULT_JWT),
  ...over,
});

describe("refreshAuthorized", () => {
  it("the cron's real shape: a header that does not match plus the vault key as bearer → allowed via the bearer", async () => {
    const d = deps();
    const r = await refreshAuthorized({ internal: "hash-of-vault-key", authorization: `Bearer ${VAULT_JWT}` }, d);
    expect(r).toEqual({ ok: true, via: "bearer" });
    expect(d.isServiceRoleToken).toHaveBeenCalledWith(VAULT_JWT);
  });

  it("the old cron shape, header only and not matching → refused, which is what production saw every hour", async () => {
    expect(await refreshAuthorized({ internal: "hash-of-vault-key", authorization: null }, deps())).toEqual({
      ok: false,
      why: "internal header did not match",
    });
  });

  it("a matching header is the fast path and asks Supabase nothing", async () => {
    const d = deps();
    expect(await refreshAuthorized({ internal: OWN_HASH, authorization: null }, d)).toEqual({ ok: true, via: "header" });
    expect(d.isServiceRoleToken).not.toHaveBeenCalled();
  });

  it("the function's own key as bearer → allowed", async () => {
    expect(await refreshAuthorized({ internal: null, authorization: `Bearer ${OWN}` }, deps())).toEqual({ ok: true, via: "bearer" });
  });

  it("a token that claims service_role but Supabase does not confirm → refused", async () => {
    const d = deps({ isServiceRoleToken: vi.fn(async () => false) });
    expect((await refreshAuthorized({ internal: null, authorization: `Bearer ${VAULT_JWT}` }, d)).ok).toBe(false);
  });

  it("a lookup that throws is not proof → refused", async () => {
    const d = deps({ isServiceRoleToken: vi.fn(async () => { throw new Error("network"); }) });
    expect((await refreshAuthorized({ internal: null, authorization: `Bearer ${VAULT_JWT}` }, d)).ok).toBe(false);
  });

  it("the public anon key → refused, and Supabase is not even asked", async () => {
    const d = deps();
    expect(await refreshAuthorized({ internal: null, authorization: `Bearer ${ANON_JWT}` }, d)).toEqual({
      ok: false,
      why: "bearer is not the service role",
    });
    expect(d.isServiceRoleToken).not.toHaveBeenCalled();
  });

  it("nothing at all → refused", async () => {
    expect(await refreshAuthorized({ internal: null, authorization: null }, deps())).toEqual({ ok: false, why: "no credential" });
  });

  it("an empty expected hash never matches an empty header", async () => {
    expect((await refreshAuthorized({ internal: "", authorization: null }, deps({ expectedInternal: "" }))).ok).toBe(false);
  });
});

describe("index-tapes uses the guard before the refresh reads anything", () => {
  const src = readSource("supabase/functions/index-tapes/index.ts")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  const refresh = src.slice(src.indexOf('if (body.mode === "refresh")'));

  it("imports the guard", () => {
    expect(src).toMatch(/import \{ refreshAuthorized \} from "\.\/refreshAuth\.ts";/);
  });

  it("passes it both the header and the authorization bearer", () => {
    expect(refresh).toMatch(/internal: req\.headers\.get\("x-dead-set-internal"\)/);
    expect(refresh).toMatch(/authorization: req\.headers\.get\("authorization"\)/);
  });

  it("returns 401 on a refusal before the candidates are read", () => {
    const refusal = refresh.search(/if \(!auth\.ok\) \{[\s\S]*?return json\(\{ error: "internal only" \}, 401\);/);
    const rpc = refresh.indexOf('db.rpc("tape_index_candidates"');
    expect(refusal).toBeGreaterThan(-1);
    expect(rpc).toBeGreaterThan(refusal);
  });
});

describe("the cron sends a bearer index-tapes can prove", () => {
  const sql = readSource("supabase/migrations/20261124010000_tape_index_refresh_bearer.sql").replace(/--[^\n]*/g, "");
  it("schedules tape-index-refresh with the vault key as the bearer", () => {
    expect(sql).toMatch(/cron\.schedule\(\s*'tape-index-refresh'/);
    expect(sql).toMatch(/'authorization', 'Bearer ' \|\| \(select decrypted_secret from vault\.decrypted_secrets where name = 'email_queue_service_role_key'\)/);
  });
});

describe("the live service-role probe in index-tapes (gate note on 0fe684a)", () => {
  // The unit tests above inject isServiceRoleToken, so the real one had no
  // test: `return true` in its place survived every test, and would let any
  // bearer that merely claims service_role run the refresh.
  const src = readSource("supabase/functions/index-tapes/index.ts")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  const probe = src.slice(src.indexOf("isServiceRoleToken: async (token) => {"), src.indexOf("if (!auth.ok)"));

  it("builds a client from the presented token, not from the function's own key", () => {
    expect(probe).toMatch(/createClient\(Deno\.env\.get\("SUPABASE_URL"\)!, token,/);
  });

  it("asks Supabase for something only the service role may do", () => {
    expect(probe).toMatch(/const \{ error \} = await probe\.auth\.admin\.listUsers\(\{ page: 1, perPage: 1 \}\);/);
  });

  it("answers yes only when that call did not fail", () => {
    expect(probe).toMatch(/return !error;/);
    expect(probe).not.toMatch(/return true;/);
  });
});
