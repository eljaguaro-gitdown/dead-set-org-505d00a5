import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { checkAdmin, type AdminCheckDeps } from "../../../supabase/functions/_shared/requireAdmin";

/**
 * send-beta-nudge was callable with the public anon key: verify_jwt only
 * proves the caller holds a project JWT, and the key shipped in the app is
 * one. A dry run then returned `recipient_email` for any user id, and an
 * empty `recipient_ids` on a real send mails every profile. Confirmed against
 * production on 2026-10-08 with a dry run.
 *
 * The guard is tested by calling it, not by reading it. The second block only
 * pins that index.ts calls it first and returns on a refusal, because the
 * Deno entrypoint cannot be imported here.
 */
const SERVICE = "service-role-key";
const ADMIN = "admin-user";
const FAN = "fan-user";

const deps = (over: Partial<AdminCheckDeps> = {}): AdminCheckDeps => ({
  serviceRoleKey: SERVICE,
  getUserId: vi.fn(async (h: string) =>
    h === "Bearer admin-jwt" ? ADMIN : h === "Bearer fan-jwt" ? FAN : null,
  ),
  isAdmin: vi.fn(async (id: string) => id === ADMIN),
  isServiceRoleToken: vi.fn(async () => false),
  ...over,
});

/** A JWT-shaped token with this payload. The signature is never read here. */
const jwt = (payload: Record<string, unknown>) => {
  const b64url = (s: string) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64url('{"alg":"HS256","typ":"JWT"}')}.${b64url(JSON.stringify(payload))}.signature`;
};
const OTHER_SERVICE_KEY = jwt({ role: "service_role", ref: "dplrumaqrdnzwzqmatqr" });

describe("checkAdmin", () => {
  it("refuses a request with no Authorization header", async () => {
    expect(await checkAdmin(null, deps())).toEqual({ ok: false, status: 401, error: "Unauthorized" });
  });

  it("refuses a header that is not a bearer token", async () => {
    for (const h of ["", "Bearer", "Bearer ", "Basic abc", "admin-jwt", "Bearer a b"]) {
      expect((await checkAdmin(h, deps())).ok, h).toBe(false);
    }
  });

  it("refuses the anon key: it is a valid JWT with no user behind it", async () => {
    const d = deps();
    expect(await checkAdmin("Bearer anon-key", d)).toEqual({ ok: false, status: 401, error: "Unauthorized" });
    expect(d.isAdmin).not.toHaveBeenCalled();
  });

  it("refuses a signed-in fan who is not an admin", async () => {
    const d = deps();
    expect(await checkAdmin("Bearer fan-jwt", d)).toEqual({ ok: false, status: 403, error: "Forbidden: admin only" });
    expect(d.isAdmin).toHaveBeenCalledWith(FAN);
  });

  it("lets an admin through, and names them", async () => {
    expect(await checkAdmin("Bearer admin-jwt", deps())).toEqual({ ok: true, callerId: ADMIN });
  });

  it("lets the service role through without a user lookup", async () => {
    const d = deps();
    expect(await checkAdmin(`Bearer ${SERVICE}`, d)).toEqual({ ok: true, callerId: null });
    expect(d.getUserId).not.toHaveBeenCalled();
    expect(d.isServiceRoleToken).not.toHaveBeenCalled();
  });

  it("matches the service key only as the whole token", async () => {
    // A loose pattern would read the key out of a longer header and wave the
    // caller through as the service role.
    for (const h of [`Bearer ${SERVICE} extra`, `xBearer ${SERVICE}`, `Token Bearer ${SERVICE}`, `Bearer ${SERVICE}x`]) {
      expect((await checkAdmin(h, deps())).ok, h).toBe(false);
    }
  });

  it("never treats an empty service key as a match", async () => {
    const d = deps({ serviceRoleKey: "" });
    expect((await checkAdmin("Bearer ", d)).ok).toBe(false);
    expect((await checkAdmin(`Bearer ${SERVICE}`, d)).ok).toBe(false);
  });
});

describe("checkAdmin: a service-role key that is not this function's own (#102)", () => {
  // The database calls with the vault secret email_queue_service_role_key: a
  // genuine service-role JWT for this project, but not the same string as the
  // function's SUPABASE_SERVICE_ROLE_KEY, so the fast path refused it.

  it("lets it through once Supabase confirms it, without a user lookup", async () => {
    const d = deps({ isServiceRoleToken: vi.fn(async () => true) });
    expect(await checkAdmin(`Bearer ${OTHER_SERVICE_KEY}`, d)).toEqual({ ok: true, callerId: null });
    expect(d.isServiceRoleToken).toHaveBeenCalledWith(OTHER_SERVICE_KEY);
    expect(d.getUserId).not.toHaveBeenCalled();
  });

  it("refuses it when Supabase does not confirm it: claiming the role is not enough", async () => {
    const d = deps();
    expect(await checkAdmin(`Bearer ${OTHER_SERVICE_KEY}`, d)).toEqual({ ok: false, status: 401, error: "Unauthorized" });
    expect(d.isServiceRoleToken).toHaveBeenCalledWith(OTHER_SERVICE_KEY);
    expect(d.isAdmin).not.toHaveBeenCalled();
  });

  it("treats a confirmation that throws as not confirmed, and does not throw itself", async () => {
    const d = deps({ isServiceRoleToken: vi.fn(async () => { throw new Error("network down"); }) });
    expect(await checkAdmin(`Bearer ${OTHER_SERVICE_KEY}`, d)).toEqual({ ok: false, status: 401, error: "Unauthorized" });
  });

  it("recognises a secret-style key as claiming the role", async () => {
    const d = deps({ isServiceRoleToken: vi.fn(async (t: string) => t === "sb_secret_abc123") });
    expect(await checkAdmin("Bearer sb_secret_abc123", d)).toEqual({ ok: true, callerId: null });
  });

  it("reads URL-safe base64, which real tokens use", async () => {
    // This payload encodes with both - and _, which plain atob rejects.
    const token = jwt({ role: "service_role", ref: "dplrumaqrdnzwzqmatqr", pad: "??>>" });
    const payload = token.split(".")[1];
    expect(payload).toMatch(/-/);
    expect(payload).toMatch(/_/);
    expect(payload.length % 4).not.toBe(0); // unpadded, as real tokens are
    const d = deps({ isServiceRoleToken: vi.fn(async () => true) });
    expect((await checkAdmin(`Bearer ${token}`, d)).ok).toBe(true);
  });

  it("asks only of tokens that claim exactly the service role", async () => {
    // Every admin dashboard request carries a user JWT: none of them should
    // pay for the extra call, and none may be waved through by it.
    const userJwt = jwt({ role: "authenticated", sub: ADMIN });
    const d = deps({
      getUserId: vi.fn(async (h: string) => (h === `Bearer ${userJwt}` ? ADMIN : null)),
      isServiceRoleToken: vi.fn(async () => true),
    });
    expect(await checkAdmin(`Bearer ${userJwt}`, d)).toEqual({ ok: true, callerId: ADMIN });
    for (const t of [
      jwt({ role: "anon" }),
      jwt({ role: "service_role_x" }),
      jwt({ role: "Service_Role" }),
      jwt({ sub: "no-role" }),
      "fan-jwt",
      "a.!!!.c",
      "only.two",
    ]) {
      await checkAdmin(`Bearer ${t}`, d);
    }
    expect(d.isServiceRoleToken).not.toHaveBeenCalled();
  });
});

describe("send-beta-nudge calls the guard before anything else", () => {
  // Comments stripped first, so a commented-out call does not count.
  const src = readFileSync(join(process.cwd(), "supabase/functions/send-beta-nudge/index.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  const serve = src.slice(src.indexOf("Deno.serve("));

  it("awaits checkAdmin and returns its status on a refusal", () => {
    expect(serve).toMatch(/const auth = await checkAdmin\(req\.headers\.get\('Authorization'\)/);
    expect(serve).toMatch(/if \(!auth\.ok\) \{\s*return jsonResponse\(\{ error: auth\.error \}, auth\.status\)/);
  });

  it("proves another service-role key with the caller's token, never the function's own key", () => {
    expect(serve).toMatch(
      /isServiceRoleToken: async \(token\) => \{\s*const probe = createClient\(supabaseUrl, token, \{[\s\S]*?\}\)\s*const \{ error \} = await probe\.auth\.admin\.listUsers\(\{ page: 1, perPage: 1 \}\)\s*return !error\s*\}/,
    );
  });

  it("checks before reading the body, recipients, emails or the dry-run flag", () => {
    const gate = serve.indexOf("await checkAdmin(");
    for (const later of ["req.json()", ".from('profiles')", "auth.admin.getUserById", "if (dryRun)", "enqueue_email"]) {
      const at = serve.indexOf(later);
      expect(at, later).toBeGreaterThan(gate);
    }
  });
});
