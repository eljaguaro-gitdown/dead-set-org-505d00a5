/**
 * Who may send which transactional email (#101).
 *
 * This function has `verify_jwt = true`, which only proves the caller holds
 * *a* valid project JWT, and the anon key shipped in the app is one. Before
 * this check, that public key could send any of the templates to any address
 * from noreply@notify.dead-set.org, and the internal templates skip the
 * suppression list. Probed against production on 2026-10-08.
 *
 * - The service role (this function's own key, or another service-role key
 *   Supabase confirms; see _shared/requireAdmin.ts) and admins may send
 *   anything to anyone. That covers the database triggers, the daily and
 *   weekly reports, notify-dm, notify-comment and the admin dashboard.
 * - A signed-in fan may ask for exactly what the app asks for on their
 *   behalf: their own welcome email, to their own address, and the sign-up
 *   alert, to the owner's inboxes only and once per account per inbox.
 * - Anyone else is refused. The email sign-up form's call before a session
 *   exists is one of these; the on_auth_user_created_emails trigger sends the
 *   same welcome email under the same idempotency key, so nothing is lost.
 *
 * Kept free of Deno APIs, with the lookups passed in, so the Vitest suite can
 * run it.
 */
import { checkAdmin } from "../_shared/requireAdmin.ts";

export type SendAuthorization =
  | { ok: true; as: "service" | "admin" | "self" }
  | { ok: false; status: 401 | 403; error: string };

export interface SendAuthorizationDeps {
  /** The function's own service-role key. */
  serviceRoleKey: string;
  /** The user a bearer token belongs to, or null (the anon key has none). */
  getUser: (authHeader: string) => Promise<{ id: string; email: string | null } | null>;
  /** Whether that user holds the `admin` role. */
  isAdmin: (userId: string) => Promise<boolean>;
  /** Whether Supabase accepts this token as the service role. */
  isServiceRoleToken: (token: string) => Promise<boolean>;
}

export interface SendRequest {
  templateName: string | undefined;
  recipientEmail: string | undefined;
  idempotencyKey: string | null;
}

/** Where the sign-up alert may go: the same two inboxes `useAuth.ts` names. */
export const OWNER_INBOXES = ["grateful_jaguaro@dead-set.org", "eljaguaro@gmail.com"];

const FORBIDDEN = { ok: false, status: 403, error: "Forbidden" } as const;
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export const authorizeSend = async (
  authHeader: string | null,
  request: SendRequest,
  deps: SendAuthorizationDeps,
): Promise<SendAuthorization> => {
  // One user lookup per request, shared by the admin check and the fan rules.
  let user: ReturnType<SendAuthorizationDeps["getUser"]> | undefined;
  const lookUp = (header: string) => (user ??= deps.getUser(header));

  const admin = await checkAdmin(authHeader, {
    serviceRoleKey: deps.serviceRoleKey,
    getUserId: async (header) => (await lookUp(header))?.id ?? null,
    isAdmin: deps.isAdmin,
    isServiceRoleToken: deps.isServiceRoleToken,
  });
  if (admin.ok) return { ok: true, as: admin.callerId ? "admin" : "service" };
  // Only "signed in, not an admin" goes on to the fan rules; anything else,
  // the anon key included, is refused here.
  const signedInFan = "status" in admin && admin.status === 403;
  if (!signedInFan || !authHeader) return { ok: false, status: 401, error: "Unauthorized" };

  // A signed-in fan without the admin role.
  const fan = await lookUp(authHeader);
  const { templateName, recipientEmail, idempotencyKey } = request;
  if (!fan || !recipientEmail) return FORBIDDEN;

  if (templateName === "welcome-email") {
    return fan.email && same(recipientEmail, fan.email) ? { ok: true, as: "self" } : FORBIDDEN;
  }

  if (templateName === "new-signup-notification") {
    const inbox = OWNER_INBOXES.find((o) => same(o, recipientEmail));
    // The key ties the alert to the caller and the inbox, so the idempotency
    // claim lets each account send it once per inbox, ever.
    return inbox && idempotencyKey === `new-signup-notify-${fan.id}-${recipientEmail}`
      ? { ok: true, as: "self" }
      : FORBIDDEN;
  }

  return FORBIDDEN;
};
