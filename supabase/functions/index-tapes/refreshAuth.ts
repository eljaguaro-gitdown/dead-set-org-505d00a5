/**
 * Who may run the hourly refresh (#155).
 *
 * The refresh walks tape_index_candidates(), which reads private setlists'
 * slots, and spends Archive requests, so only the service role may start it.
 *
 * It used to accept one proof: `x-dead-set-internal` equal to a hash of THIS
 * function's own service key. The `tape-index-refresh` cron job builds that
 * hash from the vault secret `email_queue_service_role_key`, which is a
 * genuine service-role key for the project but not the same string as
 * SUPABASE_SERVICE_ROLE_KEY (the split in _shared/requireAdmin.ts, #102).
 * So every refresh since the function deployed was refused with 401, and the
 * index stopped at the sprint's seed of 2026-11-07.
 *
 * Now two proofs are accepted:
 *   - the header, unchanged: the fast path for a caller holding this
 *     function's own key;
 *   - a bearer that Supabase confirms as the service role, the same check the
 *     database's email triggers already pass (checkAdmin). An admin's own
 *     token is NOT enough here: the refresh has no admin use.
 *
 * Kept free of Deno APIs, with the lookups passed in, so Vitest can call it.
 */
import { checkAdmin } from "../_shared/requireAdmin.ts";

export interface RefreshAuthDeps {
  serviceRoleKey: string;
  /** sha256("index-tapes:" + serviceRoleKey), hex. */
  expectedInternal: string;
  isServiceRoleToken: (token: string) => Promise<boolean>;
}

export type RefreshAuth = { ok: true; via: "header" | "bearer" } | { ok: false; why: string };

export async function refreshAuthorized(
  headers: { internal: string | null; authorization: string | null },
  deps: RefreshAuthDeps,
): Promise<RefreshAuth> {
  if (headers.internal && deps.expectedInternal && headers.internal === deps.expectedInternal) {
    return { ok: true, via: "header" };
  }
  if (headers.authorization) {
    const check = await checkAdmin(headers.authorization, {
      serviceRoleKey: deps.serviceRoleKey,
      // No user may run the refresh, admin or not: only the service role.
      getUserId: async () => null,
      isAdmin: async () => false,
      isServiceRoleToken: deps.isServiceRoleToken,
    });
    if (check.ok && check.callerId === null) return { ok: true, via: "bearer" };
  }
  return {
    ok: false,
    why: headers.internal ? "internal header did not match" : headers.authorization ? "bearer is not the service role" : "no credential",
  };
}
