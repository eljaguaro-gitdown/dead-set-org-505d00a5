/**
 * The owner's own inboxes: where the sign-up alert may go (send-transactional-email's
 * authorize.ts) and where the tape desk's alerts go (tape-desk). Never a fan.
 *
 * It lives in _shared/ because the edge-function bundler packs only a function's
 * own folder and _shared/. tape-desk once imported it from
 * ../send-transactional-email/authorize.ts, and its deploy failed with
 * "Module not found" (2026-11-24). Kept free of Deno APIs so Vitest can import it.
 */
export const OWNER_INBOXES = ["grateful_jaguaro@dead-set.org", "eljaguaro@gmail.com"];
