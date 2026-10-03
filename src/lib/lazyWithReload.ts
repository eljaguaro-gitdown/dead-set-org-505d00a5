import { lazy, type ComponentType } from "react";

/**
 * Route chunks that survive a deploy.
 *
 * Every route is lazy(), so each is a separately-hashed chunk. Ship a new
 * build and those filenames change — but a tab that was already open still
 * holds the old module graph. The next navigation asks for a chunk that no
 * longer exists, the SPA fallback (`/* -> /index.html`) answers that .js
 * request with index.html, and the browser refuses it:
 *
 *   'text/html' is not a valid JavaScript MIME type.
 *
 * which lands the reader on the error screen for no reason of their own. It
 * happens on every deploy to everyone mid-session, and it is invisible to us
 * because the people it hits are the ones already using the site.
 *
 * The recovery is simply to fetch the new index.html: one reload and the
 * stale graph is gone. The sessionStorage flag makes sure a genuinely broken
 * chunk reloads once and then surfaces, instead of looping forever.
 */

const RELOAD_FLAG = "ds_chunk_reload_at";
/** A second failure this soon after a reload is a real error, not a stale chunk. */
const RELOAD_WINDOW_MS = 10_000;

/** Chrome, Safari and Firefox each word this differently. */
const isStaleChunkError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    /not a valid JavaScript MIME type/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /ChunkLoadError/i.test(message)
  );
};

const recentlyReloaded = (): boolean => {
  try {
    const at = Number(sessionStorage.getItem(RELOAD_FLAG) ?? 0);
    return at > 0 && Date.now() - at < RELOAD_WINDOW_MS;
  } catch {
    // Private mode, blocked storage: treat as "already tried" so we never loop.
    return true;
  }
};

const markReloaded = () => {
  try {
    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
  } catch {
    /* nothing to do; the guard above fails closed */
  }
};

/**
 * True when this error was handled by reloading. Exported so the error
 * boundary can recover from a stale chunk thrown outside a route import.
 */
export const recoverFromStaleChunk = (error: unknown): boolean => {
  if (!isStaleChunkError(error) || recentlyReloaded()) return false;
  markReloaded();
  window.location.reload();
  return true;
};

/**
 * Drop-in for React.lazy that reloads once when the chunk is gone.
 * On reload the import resolves against the new index.html and the reader
 * lands where they were going.
 */
export const lazyWithReload = <T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
) =>
  lazy(async () => {
    try {
      return await factory();
    } catch (error) {
      if (recoverFromStaleChunk(error)) {
        // The reload is already in flight. Never resolving keeps React from
        // rendering an error screen in the moment before the page goes away.
        return await new Promise<{ default: T }>(() => {});
      }
      throw error;
    }
  });
