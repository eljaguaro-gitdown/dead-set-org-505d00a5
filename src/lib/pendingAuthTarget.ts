/**
 * Where a fan was headed when email sign-up made them stop and confirm.
 *
 * The confirmation link opens a NEW tab from the mail app and lands on "/".
 * ?redirect= lived in the old tab's URL and post_oauth_target lives in the old
 * tab's sessionStorage, so both are gone, and a friend who tapped a
 * collaboration invite (/join/:token) signed up, confirmed, and was dropped on
 * the homepage with the invite never accepted. Seen 2026-11-20.
 *
 * localStorage survives into the new tab when it opens in the same browser.
 * Kept for a day; only in-app paths are accepted.
 */

const KEY = "ds_pending_auth_target";
const TTL_MS = 24 * 60 * 60 * 1000;

const isInAppPath = (path: string) =>
  path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\");

export const stashPendingAuthTarget = (path: string | null | undefined) => {
  if (!path || !isInAppPath(path)) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() }));
  } catch {
    // storage unavailable: nothing to carry, the fan lands on "/" as before
  }
};

export const clearPendingAuthTarget = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
};

/** Returns the stashed path once, then forgets it. */
export const consumePendingAuthTarget = (now = Date.now()): string | null => {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  clearPendingAuthTarget();
  try {
    const { path, at } = JSON.parse(raw) as { path?: unknown; at?: unknown };
    if (typeof path !== "string" || typeof at !== "number") return null;
    if (now - at > TTL_MS || now < at) return null;
    return isInAppPath(path) ? path : null;
  } catch {
    return null;
  }
};
