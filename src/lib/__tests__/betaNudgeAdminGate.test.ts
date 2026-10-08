import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { checkAdmin, type AdminCheckDeps } from "../../../supabase/functions/send-beta-nudge/requireAdmin";

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
  ...over,
});

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

  it("checks before reading the body, recipients, emails or the dry-run flag", () => {
    const gate = serve.indexOf("await checkAdmin(");
    for (const later of ["req.json()", ".from('profiles')", "auth.admin.getUserById", "if (dryRun)", "enqueue_email"]) {
      const at = serve.indexOf(later);
      expect(at, later).toBeGreaterThan(gate);
    }
  });
});
