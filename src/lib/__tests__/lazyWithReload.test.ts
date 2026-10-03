import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { recoverFromStaleChunk } from "@/lib/lazyWithReload";

/**
 * The failure this exists to prevent, seen in production on 2026-10-03:
 * tapping a link after a deploy landed on "The band's off-key." with
 *
 *   'text/html' is not a valid JavaScript MIME type.
 *
 * Every route is lazy(), so each is its own hashed chunk. A deploy renames
 * them; a tab opened before it asks for the old name; the SPA fallback hands
 * back index.html; the browser refuses to run HTML as JavaScript. It happens
 * to everyone mid-session on every deploy, and it looks like whichever button
 * they happened to press.
 */

const reload = vi.fn();

beforeEach(() => {
  reload.mockReset();
  sessionStorage.clear();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, reload },
  });
});
afterEach(() => sessionStorage.clear());

describe("recoverFromStaleChunk", () => {
  it("reloads on the MIME-type error Safari actually threw", () => {
    expect(recoverFromStaleChunk(new Error("'text/html' is not a valid JavaScript MIME type."))).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("recognises how the other browsers word the same failure", () => {
    for (const message of [
      "Failed to fetch dynamically imported module: https://x/assets/Auth-abc.js",
      "error loading dynamically imported module",
      "Importing a module script failed.",
      "ChunkLoadError: Loading chunk 42 failed.",
    ]) {
      sessionStorage.clear();
      reload.mockReset();
      expect(recoverFromStaleChunk(new Error(message))).toBe(true);
      expect(reload).toHaveBeenCalledTimes(1);
    }
  });

  it("leaves a real error alone", () => {
    expect(recoverFromStaleChunk(new TypeError("x is not a function"))).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads once and then lets the error through — never a loop", () => {
    const err = new Error("'text/html' is not a valid JavaScript MIME type.");
    expect(recoverFromStaleChunk(err)).toBe(true);
    expect(recoverFromStaleChunk(err)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("will reload again once the window has passed — a later deploy is a new event", () => {
    const err = new Error("Failed to fetch dynamically imported module");
    expect(recoverFromStaleChunk(err)).toBe(true);
    sessionStorage.setItem("ds_chunk_reload_at", String(Date.now() - 60_000));
    expect(recoverFromStaleChunk(err)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("handles a non-Error throw without exploding", () => {
    expect(recoverFromStaleChunk("'text/html' is not a valid JavaScript MIME type.")).toBe(true);
    expect(recoverFromStaleChunk(null)).toBe(false);
  });
});
