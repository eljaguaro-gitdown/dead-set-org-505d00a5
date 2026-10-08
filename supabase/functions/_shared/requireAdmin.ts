/**
 * Who may call an admin edge function: an admin, or the service role.
 * send-beta-nudge and admin-users both run this before anything else.
 *
 * `verify_jwt = true` in config.toml only proves the caller holds *a* valid
 * project JWT, and the anon key shipped inside the app is one. Before this
 * check, that public key could make a real send-beta-nudge send (an empty
 * `recipient_ids` mails every profile) or a dry run, which returns
 * `recipient_email` for any user id. `profiles.user_id` is world-readable, so a
 * dry run per id read out every user's email address. Confirmed against
 * production on 2026-10-08 with the anon key and a dry run. admin-users sets
 * `verify_jwt = false` and returns every account's email, so it needs the same
 * check, and its own hand-written copy had no test that could see it removed.
 *
 * Kept free of Deno APIs, with the lookups passed in, so the Vitest suite can
 * exercise every branch. The service role is let through for internal calls;
 * anyone else must be a signed-in user with the `admin` role.
 *
 * The service role is recognised in two ways. A bearer equal to this
 * function's own key is the fast path. A bearer that is a *different* valid
 * service-role key is the other: the database calls with the vault secret
 * `email_queue_service_role_key`, which is a genuine service-role JWT for this
 * project but not the same string as SUPABASE_SERVICE_ROLE_KEY (#102), and
 * Lovable rewrote it on 2026-10-08, so the two cannot be relied on to match.
 * A token's own claim to be the service role decides only whether to ask;
 * `isServiceRoleToken` then proves it with a call only the service role can
 * make. Every other token goes to the user check without that extra call.
 */

export type AdminCheck =
  | { ok: true; callerId: string | null }
  | { ok: false; status: 401 | 403; error: string };

export interface AdminCheckDeps {
  /** The project's service-role key. An empty value never matches. */
  serviceRoleKey: string;
  /** The user a bearer token belongs to, or null (the anon key has none). */
  getUserId: (authHeader: string) => Promise<string | null>;
  /** Whether that user holds the `admin` role. */
  isAdmin: (userId: string) => Promise<boolean>;
  /**
   * Whether Supabase accepts this token as the service role, proven by a call
   * only the service role can make. Asked only of a token that claims to be one.
   */
  isServiceRoleToken: (token: string) => Promise<boolean>;
}

/**
 * Whether a token says it is the service role. Unverified, and only ever used
 * to decide whether `isServiceRoleToken` is worth asking: a secret-style key,
 * or a JWT whose `role` claim is `service_role`. Anything unreadable is no.
 */
const claimsServiceRole = (token: string): boolean => {
  if (token.startsWith("sb_secret_")) return true;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    // JWTs drop base64's "=" padding. Node, jsdom and Deno decode it anyway,
    // so no test here can tell this padding from none; it stays for any
    // runtime whose atob is strict, where a missing pad would refuse every
    // database caller.
    const payload = JSON.parse(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)));
    return payload?.role === "service_role";
  } catch {
    return false;
  }
};

export const checkAdmin = async (
  authHeader: string | null,
  deps: AdminCheckDeps,
): Promise<AdminCheck> => {
  const match = authHeader?.match(/^Bearer\s+(\S+)$/);
  if (!authHeader || !match) return { ok: false, status: 401, error: "Unauthorized" };

  const token = match[1];
  if (deps.serviceRoleKey && token === deps.serviceRoleKey) {
    return { ok: true, callerId: null };
  }

  // A different service-role key (#102). A lookup that throws counts as not
  // proven, and the token falls through to the user check, which refuses it.
  if (claimsServiceRole(token)) {
    let proven = false;
    try {
      proven = await deps.isServiceRoleToken(token);
    } catch {
      proven = false;
    }
    if (proven) return { ok: true, callerId: null };
  }

  const userId = await deps.getUserId(authHeader);
  if (!userId) return { ok: false, status: 401, error: "Unauthorized" };

  if (!(await deps.isAdmin(userId))) {
    return { ok: false, status: 403, error: "Forbidden: admin only" };
  }
  return { ok: true, callerId: userId };
};
