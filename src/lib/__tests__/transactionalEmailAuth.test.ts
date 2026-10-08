import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  authorizeSend,
  OWNER_INBOXES,
  type SendAuthorizationDeps,
  type SendRequest,
} from "../../../supabase/functions/send-transactional-email/authorize";

/**
 * send-transactional-email sent any template to any address for anyone
 * holding the public anon key, the internal templates skipping the
 * suppression list (#101; probed against production on 2026-10-08). These
 * call the real policy; the last block pins that the three functions use it.
 */
const SERVICE = "service-role-key";
const ADMIN = { id: "admin-1", email: "owner@example.com" };
const FAN = { id: "fan-1", email: "Fan@Example.com" };

const deps = (over: Partial<SendAuthorizationDeps> = {}): SendAuthorizationDeps => ({
  serviceRoleKey: SERVICE,
  getUser: vi.fn(async (h: string) =>
    h === "Bearer admin-jwt" ? ADMIN : h === "Bearer fan-jwt" ? FAN : null,
  ),
  isAdmin: vi.fn(async (id: string) => id === ADMIN.id),
  isServiceRoleToken: vi.fn(async () => false),
  ...over,
});

const send = (templateName: string, recipientEmail = "someone@example.com", idempotencyKey: string | null = null): SendRequest => ({
  templateName,
  recipientEmail,
  idempotencyKey,
});

/** Every template in the registry, read from the file so a new one cannot be missed. */
const TEMPLATE_NAMES = [
  ...readFileSync(
    join(process.cwd(), "supabase/functions/_shared/transactional-email-templates/registry.ts"),
    "utf8",
  ).matchAll(/^ {2}'([a-z-]+)':/gm),
].map((m) => m[1]);

const forgedServiceJwt = (() => {
  const b64url = (s: string) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64url('{"alg":"HS256","typ":"JWT"}')}.${b64url('{"role":"service_role"}')}.forged`;
})();

describe("authorizeSend: who is refused outright", () => {
  it("refuses a request with no Authorization header", async () => {
    expect(await authorizeSend(null, send("welcome-email"), deps())).toEqual({ ok: false, status: 401, error: "Unauthorized" });
  });

  it("refuses the anon key for every template, the internal ones included", async () => {
    expect(TEMPLATE_NAMES.length).toBeGreaterThanOrEqual(11);
    for (const t of TEMPLATE_NAMES) {
      const d = deps();
      expect(await authorizeSend("Bearer anon-key", send(t), d), t).toEqual({ ok: false, status: 401, error: "Unauthorized" });
    }
  });

  it("refuses a token that claims the service role when Supabase does not confirm it", async () => {
    const d = deps();
    expect((await authorizeSend(`Bearer ${forgedServiceJwt}`, send("moderation-report"), d)).ok).toBe(false);
    expect(d.isServiceRoleToken).toHaveBeenCalledWith(forgedServiceJwt);
  });
});

describe("authorizeSend: the service role and admins send anything", () => {
  it("lets this function's own service key send any template to anyone, without a user lookup", async () => {
    for (const t of TEMPLATE_NAMES) {
      const d = deps();
      expect(await authorizeSend(`Bearer ${SERVICE}`, send(t), d), t).toEqual({ ok: true, as: "service" });
      expect(d.getUser).not.toHaveBeenCalled();
    }
  });

  it("lets another service-role key through once Supabase confirms it (the database's triggers)", async () => {
    const otherKey = forgedServiceJwt; // shape only; the deps decide
    const d = deps({ isServiceRoleToken: vi.fn(async () => true) });
    expect(await authorizeSend(`Bearer ${otherKey}`, send("moderation-report", "owner@example.com"), d)).toEqual({ ok: true, as: "service" });
  });

  it("lets an admin send any template to anyone (the dashboard's manual welcome email)", async () => {
    for (const t of TEMPLATE_NAMES) {
      expect(await authorizeSend("Bearer admin-jwt", send(t, "anyone@example.com"), deps()), t).toEqual({ ok: true, as: "admin" });
    }
  });
});

describe("authorizeSend: a signed-in fan gets only what the app asks for", () => {
  it("may send the welcome email to their own address, whatever its case or spacing", async () => {
    for (const to of ["Fan@Example.com", "fan@example.com", "  FAN@EXAMPLE.COM "]) {
      expect(await authorizeSend("Bearer fan-jwt", send("welcome-email", to), deps()), to).toEqual({ ok: true, as: "self" });
    }
  });

  it("may not send the welcome email to anyone else", async () => {
    for (const to of ["other@example.com", "fan@example.com.evil.test", "", "fan@example.co"]) {
      expect(await authorizeSend("Bearer fan-jwt", send("welcome-email", to), deps()), to).toEqual({ ok: false, status: 403, error: "Forbidden" });
    }
  });

  it("may not send even their own welcome email when their account has no address", async () => {
    const d = deps({ getUser: vi.fn(async () => ({ id: "fan-2", email: null })) });
    expect((await authorizeSend("Bearer fan-jwt", send("welcome-email", "x@example.com"), d)).ok).toBe(false);
  });

  it("may send the sign-up alert to each owner inbox, under the key that names them and that inbox", async () => {
    for (const inbox of OWNER_INBOXES) {
      const key = `new-signup-notify-${FAN.id}-${inbox}`;
      expect(await authorizeSend("Bearer fan-jwt", send("new-signup-notification", inbox, key), deps()), inbox).toEqual({ ok: true, as: "self" });
    }
  });

  it("matches the inboxes useAuth.ts actually sends to", () => {
    const useAuth = readFileSync(join(process.cwd(), "src/hooks/useAuth.ts"), "utf8");
    const listed = useAuth.match(/const ADMIN_RECIPIENTS = \[([^\]]*)\]/)?.[1] ?? "";
    expect([...listed.matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort()).toEqual([...OWNER_INBOXES].sort());
    expect(useAuth).toMatch(/idempotencyKey: `new-signup-notify-\$\{session\.user\.id\}-\$\{adminEmail\}`/);
  });

  it("may not send the sign-up alert anywhere else, or under any other key", async () => {
    const inbox = OWNER_INBOXES[0];
    for (const [to, key] of [
      ["someone@example.com", `new-signup-notify-${FAN.id}-someone@example.com`],
      [inbox, null],
      [inbox, `new-signup-notify-${FAN.id}-${inbox}-again`],
      [inbox, `new-signup-notify-someone-else-${inbox}`],
      [inbox, `new-signup-notify-${FAN.id}-${OWNER_INBOXES[1]}`],
      [inbox, `welcome-${FAN.id}`],
    ] as const) {
      expect(await authorizeSend("Bearer fan-jwt", send("new-signup-notification", to, key), deps()), `${to} ${key}`).toEqual({
        ok: false,
        status: 403,
        error: "Forbidden",
      });
    }
  });

  it("may not send any other template, to anyone, the owner included", async () => {
    for (const t of TEMPLATE_NAMES.filter((n) => n !== "welcome-email" && n !== "new-signup-notification")) {
      for (const to of [FAN.email, OWNER_INBOXES[0], "anyone@example.com"]) {
        expect(await authorizeSend("Bearer fan-jwt", send(t, to, "k"), deps()), `${t} ${to}`).toEqual({ ok: false, status: 403, error: "Forbidden" });
      }
    }
  });

  it("is refused without a recipient", async () => {
    expect((await authorizeSend("Bearer fan-jwt", { templateName: "welcome-email", recipientEmail: undefined, idempotencyKey: null }, deps())).ok).toBe(false);
  });

  it("looks the user up once, however many rules ask", async () => {
    const d = deps();
    await authorizeSend("Bearer fan-jwt", send("welcome-email", FAN.email), d);
    expect(d.getUser).toHaveBeenCalledTimes(1);
  });
});

// Comments are stripped, so a commented-out call does not count.
const source = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

describe("send-transactional-email runs the policy before anything else", () => {
  const src = source("supabase/functions/send-transactional-email/index.ts");
  const serve = src.slice(src.indexOf("Deno.serve("));

  it("imports it, awaits it with the explicit idempotency key, and returns its status on a refusal", () => {
    expect(src).toMatch(/import \{ authorizeSend \} from '\.\/authorize\.ts'/);
    expect(serve).toMatch(
      /const auth = await authorizeSend\(\s*req\.headers\.get\('Authorization'\),\s*\{ templateName, recipientEmail, idempotencyKey: explicitIdempotencyKey \},/,
    );
    expect(serve).toMatch(
      /if \(!auth\.ok\) \{\s*return new Response\(JSON\.stringify\(\{ error: auth\.error \}\), \{\s*status: auth\.status,/,
    );
  });

  it("gives it real lookups: the caller's own user, the admin role, and a service-role proof made with the caller's token", () => {
    expect(serve).toMatch(/return error \|\| !data\.user \? null : \{ id: data\.user\.id, email: data\.user\.email \?\? null \}/);
    expect(serve).toMatch(/\.from\('user_roles'\)\s*\.select\('role'\)\s*\.eq\('user_id', userId\)\s*\.eq\('role', 'admin'\)\s*\.maybeSingle\(\)\s*return !!data/);
    expect(serve).toMatch(
      /isServiceRoleToken: async \(token\) => \{\s*const probe = createClient\(supabaseUrl, token, \{[\s\S]*?\}\)\s*const \{ error \} = await probe\.auth\.admin\.listUsers\(\{ page: 1, perPage: 1 \}\)\s*return !error/,
    );
    expect(serve).toMatch(/serviceRoleKey: supabaseServiceKey,/);
  });

  it("checks after reading the body and before the template list, the suppression list or any write", () => {
    const gate = serve.indexOf("await authorizeSend(");
    expect(gate).toBeGreaterThan(serve.indexOf("await req.json()"));
    for (const later of ["TEMPLATES[templateName]", "const supabase = createClient(supabaseUrl, supabaseServiceKey)", "suppressed_emails", "email_send_log"]) {
      const at = serve.indexOf(later);
      expect(at, later).toBeGreaterThan(gate);
    }
  });
});

describe("notify-dm and notify-comment send as the service role", () => {
  for (const [file, template] of [
    ["supabase/functions/notify-dm/index.ts", "dm-notification"],
    ["supabase/functions/notify-comment/index.ts", "comment-notification"],
  ] as const) {
    it(`${file.split("/")[2]} sends ${template} through its service client, not the caller's token`, () => {
      const src = source(file);
      expect(src).toMatch(/const supabase = createClient\(supabaseUrl, serviceKey\)/);
      expect(src).toMatch(new RegExp(`supabase\\.functions\\.invoke\\('send-transactional-email', \\{\\s*body: \\{\\s*templateName: '${template}'`));
      expect(src).not.toMatch(/functions\/v1\/send-transactional-email/);
      expect(src).toMatch(/if \(sendError\) \{/);
    });
  }
});
