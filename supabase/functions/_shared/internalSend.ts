/**
 * How our own functions show send-transactional-email that they hold the
 * service key.
 *
 * notify-dm, notify-comment and the daily and weekly reports call it through
 * `supabase.functions.invoke` on a service-role client, which sends the key
 * as the bearer token. That token does not reach the function as sent: on
 * 2026-10-08 notify-dm's call was refused with 401 by the #101 check, which
 * admits this function's own key and any token Supabase confirms as the
 * service role, so what arrived was neither. Calls made this way have all
 * been refused since #113 deployed.
 *
 * A header of our own arrives as sent. It carries a hash of the key rather
 * than the key, so a copy that ends up in a log can send email through this
 * one function and do nothing else.
 *
 * Kept free of Deno APIs so the Vitest suite can run it.
 */

export const INTERNAL_SEND_HEADER = "x-dead-set-internal-send";

export const internalSendToken = async (serviceKey: string): Promise<string> => {
  const bytes = new TextEncoder().encode(`send-transactional-email:${serviceKey}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
};
