import { describe, it, expect, vi } from "vitest";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { INTERNAL_SEND_HEADER, internalSendToken } from "../../../supabase/functions/_shared/internalSend";
import { describeBearer } from "../../../supabase/functions/_shared/requireAdmin";
import { authorizeSend, type SendAuthorizationDeps } from "../../../supabase/functions/send-transactional-email/authorize";

/**
 * Our own functions call send-transactional-email through
 * `supabase.functions.invoke` with the service key, and the bearer token that
 * sends does not arrive as sent. On 2026-10-08 notify-dm's call was refused
 * with 401, so a DM's email never went out, and the daily and weekly reports
 * and comment emails go the same way. They now prove the key with a header of
 * our own. These call the real check; the last block pins every caller.
 */
const SERVICE = "sb_secret_this-functions-own-key";

const deps = (over: Partial<SendAuthorizationDeps> = {}): SendAuthorizationDeps => ({
  serviceRoleKey: SERVICE,
  getUser: vi.fn(async () => null),
  isAdmin: vi.fn(async () => false),
  isServiceRoleToken: vi.fn(async () => false),
  ...over,
});

const b64url = (s: string) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const jwt = (payload: object) => `${b64url('{"alg":"HS256","typ":"JWT"}')}.${b64url(JSON.stringify(payload))}.sig`;
// What arrived instead of the key: a service-role JWT that is not the key and that Supabase did not confirm.
const ARRIVED = `Bearer ${jwt({ role: "service_role", exp: 1 })}`;

const TEMPLATE_NAMES = [
  ...readFileSync(
    join(process.cwd(), "supabase/functions/_shared/transactional-email-templates/registry.ts"),
    "utf8",
  ).matchAll(/^ {2}'([a-z-]+)':/gm),
].map((m) => m[1]);

describe("internalSendToken", () => {
  it("is a fixed 64-character hex digest of the key", async () => {
    const a = await internalSendToken(SERVICE);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await internalSendToken(SERVICE)).toBe(a);
  });

  it("differs for a different key and never contains the key", async () => {
    const a = await internalSendToken(SERVICE);
    expect(await internalSendToken(`${SERVICE}x`)).not.toBe(a);
    expect(a).not.toContain(SERVICE);
    expect(a).not.toContain("sb_secret_");
  });

  it("is the SHA-256 of the key under this function's name, so it is good for nothing else", async () => {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`send-transactional-email:${SERVICE}`));
    expect(await internalSendToken(SERVICE)).toBe(Buffer.from(digest).toString("hex"));
  });
});

describe("authorizeSend: the header from our own functions", () => {
  it("lets the right token send every template, whatever bearer arrived, with no lookups", async () => {
    const token = await internalSendToken(SERVICE);
    for (const t of TEMPLATE_NAMES) {
      for (const bearer of [ARRIVED, "Bearer anon-key", null]) {
        const d = deps();
        const request = { templateName: t, recipientEmail: "anyone@example.com", idempotencyKey: null, internalToken: token };
        expect(await authorizeSend(bearer, request, d), `${t} ${bearer}`).toEqual({ ok: true, as: "service" });
        expect(d.getUser).not.toHaveBeenCalled();
        expect(d.isServiceRoleToken).not.toHaveBeenCalled();
      }
    }
  });

  it("refuses the call as it was before the header: the bearer that arrived, alone", async () => {
    const d = deps();
    const request = { templateName: "dm-notification", recipientEmail: "fan@example.com", idempotencyKey: "k" };
    expect(await authorizeSend(ARRIVED, request, d)).toEqual({ ok: false, status: 401, error: "Unauthorized" });
  });

  it("refuses any other value of the header", async () => {
    const right = await internalSendToken(SERVICE);
    for (const wrong of [
      await internalSendToken("some-other-key"),
      SERVICE,
      right.toUpperCase(),
      `${right} `,
      right.slice(0, 63),
      "",
      null,
    ]) {
      const request = { templateName: "dm-notification", recipientEmail: "fan@example.com", idempotencyKey: "k", internalToken: wrong };
      expect(await authorizeSend("Bearer anon-key", request, deps()), String(wrong)).toEqual({ ok: false, status: 401, error: "Unauthorized" });
    }
  });

  it("refuses the digest of an empty key when the function has no key", async () => {
    const request = { templateName: "dm-notification", recipientEmail: "fan@example.com", idempotencyKey: "k", internalToken: await internalSendToken("") };
    expect((await authorizeSend("Bearer anon-key", request, deps({ serviceRoleKey: "" }))).ok).toBe(false);
  });
});

describe("describeBearer names the kind of credential and never the credential", () => {
  it.each([
    [null, "none"],
    ["Basic abc", "not a bearer"],
    ["Bearer sb_secret_abc123", "secret key"],
    ["Bearer sb_publishable_abc123", "publishable key"],
    [`Bearer ${jwt({ role: "service_role" })}`, "jwt, role service_role"],
    [`Bearer ${jwt({ role: "authenticated", sub: "u" })}`, "jwt, role authenticated"],
    [`Bearer ${jwt({ sub: "u" })}`, "unrecognised"],
    ["Bearer not-a-jwt", "unrecognised"],
  ])("%s → %s", (header, expected) => {
    const out = describeBearer(header);
    expect(out).toBe(expected);
    const token = header?.split(" ")[1];
    if (token) expect(out).not.toContain(token);
  });
});

// Comments are stripped, so a commented-out line does not count.
const source = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

/** The full `functions.invoke('send-transactional-email', …)` call, counted by parentheses. */
const invokeCalls = (src: string) => {
  const calls: string[] = [];
  const marker = "functions.invoke('send-transactional-email'";
  for (let at = src.indexOf(marker); at !== -1; at = src.indexOf(marker, at + 1)) {
    let depth = 0;
    let end = at + "functions.invoke".length;
    for (; end < src.length; end++) {
      if (src[end] === "(") depth++;
      else if (src[end] === ")" && --depth === 0) break;
    }
    calls.push(src.slice(at, end + 1));
  }
  return calls;
};

describe("every function that invokes send-transactional-email sends the header", () => {
  const dir = join(process.cwd(), "supabase/functions");
  const callers = readdirSync(dir)
    .filter((f) => existsSync(join(dir, f, "index.ts")))
    .map((f) => ({ name: f, src: source(`supabase/functions/${f}/index.ts`) }))
    .filter((f) => invokeCalls(f.src).length > 0);

  it("finds the four callers there are today", () => {
    expect(callers.map((c) => c.name).sort()).toEqual(
      ["daily-user-report", "notify-comment", "notify-dm", "weekly-insights-report"],
    );
  });

  for (const name of ["daily-user-report", "notify-comment", "notify-dm", "weekly-insights-report"]) {
    it(`${name} imports the token and puts it on its send`, () => {
      const src = source(`supabase/functions/${name}/index.ts`);
      expect(src).toMatch(/import \{ INTERNAL_SEND_HEADER, internalSendToken \} from '\.\.\/_shared\/internalSend\.ts'/);
      expect(src).toMatch(/const serviceKey = Deno\.env\.get\('SUPABASE_SERVICE_ROLE_KEY'\)!/);
      const calls = invokeCalls(src);
      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatch(/\n\s*headers: \{ \[INTERNAL_SEND_HEADER\]: await internalSendToken\(serviceKey\) \},\n\s*\}\)$/);
    });
  }

  it("send-transactional-email reads the header into the check and logs what a refusal carried", () => {
    const src = source("supabase/functions/send-transactional-email/index.ts");
    expect(src).toMatch(/import \{ INTERNAL_SEND_HEADER \} from '\.\.\/_shared\/internalSend\.ts'/);
    expect(src).toMatch(/import \{ describeBearer \} from '\.\.\/_shared\/requireAdmin\.ts'/);
    expect(src).toMatch(/idempotencyKey: explicitIdempotencyKey,\s*internalToken: req\.headers\.get\(INTERNAL_SEND_HEADER\),\s*\},/);
    expect(src).toMatch(
      /if \(!auth\.ok\) \{\s*console\.warn\('Send refused', \{\s*templateName,\s*status: auth\.status,\s*bearer: describeBearer\(req\.headers\.get\('Authorization'\)\),\s*internalHeader: req\.headers\.has\(INTERNAL_SEND_HEADER\),\s*\}\)\s*return new Response/,
    );
  });

  it("uses a header name the request can carry unchanged", () => {
    expect(INTERNAL_SEND_HEADER).toMatch(/^x-[a-z-]+$/);
  });
});
