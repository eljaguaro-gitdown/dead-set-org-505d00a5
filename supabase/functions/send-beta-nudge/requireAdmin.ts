/**
 * Who may call send-beta-nudge: an admin, or the service role.
 *
 * `verify_jwt = true` in config.toml only proves the caller holds *a* valid
 * project JWT, and the anon key shipped inside the app is one. Before this
 * check, that public key could make a real send (an empty `recipient_ids`
 * mails every profile) or a dry run, which returns `recipient_email` for any
 * user id. `profiles.user_id` is world-readable, so a dry run per id read out
 * every user's email address. Confirmed against production on 2026-10-08 with
 * the anon key and a dry run.
 *
 * Kept free of Deno APIs, with the two lookups passed in, so the Vitest suite
 * can exercise every branch. Same shape as admin-users' check: the service
 * role is let through for internal calls, anyone else must be a signed-in user
 * with the `admin` role.
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
}

export const checkAdmin = async (
  authHeader: string | null,
  deps: AdminCheckDeps,
): Promise<AdminCheck> => {
  const match = authHeader?.match(/^Bearer\s+(\S+)$/);
  if (!authHeader || !match) return { ok: false, status: 401, error: "Unauthorized" };

  if (deps.serviceRoleKey && match[1] === deps.serviceRoleKey) {
    return { ok: true, callerId: null };
  }

  const userId = await deps.getUserId(authHeader);
  if (!userId) return { ok: false, status: 401, error: "Unauthorized" };

  if (!(await deps.isAdmin(userId))) {
    return { ok: false, status: 403, error: "Forbidden: admin only" };
  }
  return { ok: true, callerId: userId };
};
