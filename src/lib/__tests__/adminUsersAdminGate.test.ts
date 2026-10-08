import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * admin-users has verify_jwt = false and returns every account's email, so its
 * admin check is the only thing in front of that. It used to be a hand-written
 * copy, and gate 8 (2026-10-08) replaced its `if (!roleData)` with `if (false)`
 * and every test stayed green. It now runs the shared checkAdmin, whose every
 * branch is exercised in betaNudgeAdminGate.test.ts; this pins that admin-users
 * calls it, honours its refusal, and does so before reading anything.
 *
 * Comments are stripped first, so a commented-out call does not count.
 */
const src = readFileSync(join(process.cwd(), "supabase/functions/admin-users/index.ts"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
const serve = src.slice(src.indexOf("Deno.serve("));

describe("admin-users runs the shared admin check first", () => {
  it("imports the shared check rather than keeping its own", () => {
    expect(src).toMatch(/import \{ checkAdmin \} from "\.\.\/_shared\/requireAdmin\.ts";/);
    expect(src).not.toMatch(/\bisServiceRole\b|authHeader\.replace\(|roleData/);
  });

  it("awaits it and returns its status on a refusal", () => {
    expect(serve).toMatch(/const auth = await checkAdmin\(req\.headers\.get\("Authorization"\), \{/);
    expect(serve).toMatch(
      /if \(!auth\.ok\) \{\s*return new Response\(JSON\.stringify\(\{ error: auth\.error \}\), \{\s*status: auth\.status,/,
    );
    expect(serve).toMatch(/const callerId = auth\.callerId;/);
  });

  it("asks for the admin role, and treats a failed sign-in lookup as no user", () => {
    expect(serve).toMatch(
      /isAdmin: async \(userId\) => \{\s*const \{ data \} = await adminClient\s*\.from\("user_roles"\)\s*\.select\("role"\)\s*\.eq\("user_id", userId\)\s*\.eq\("role", "admin"\)\s*\.maybeSingle\(\);\s*return !!data;/,
    );
    expect(serve).toMatch(/return error \|\| !data\.user \? null : data\.user\.id;/);
    expect(serve).toMatch(/serviceRoleKey,/);
  });

  it("proves another service-role key with the caller's token, never the function's own key", () => {
    expect(serve).toMatch(
      /isServiceRoleToken: async \(token\) => \{\s*const probe = createClient\(supabaseUrl, token, \{[\s\S]*?\}\);\s*const \{ error \} = await probe\.auth\.admin\.listUsers\(\{ page: 1, perPage: 1 \}\);\s*return !error;\s*\}/,
    );
  });

  it("checks before any action, user list, profile read or traffic query", () => {
    const gate = serve.indexOf("await checkAdmin(");
    expect(gate).toBeGreaterThan(-1);
    for (const later of [
      'searchParams.get("action")',
      // The real user list, not the one-user check inside checkAdmin's deps.
      "adminClient.auth.admin.listUsers(",
      '.from("profiles")',
      "queryPostHog(",
      "auth.admin.deleteUser(",
    ]) {
      const at = serve.indexOf(later);
      expect(at, later).toBeGreaterThan(gate);
    }
  });
});
