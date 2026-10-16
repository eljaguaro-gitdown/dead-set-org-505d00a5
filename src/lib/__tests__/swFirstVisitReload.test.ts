/**
 * The service-worker bootstrap in index.html reloads the page when a new SW
 * takes control. sw.js calls skipWaiting + clients.claim, so on a FIRST visit
 * the brand-new SW claims the page and fires controllerchange too — and the
 * old handler reloaded every first-time visitor ~1s after first paint. PostHog
 * saw it as a duplicate $pageview on 71% of first-ever home sessions (growth
 * report 2026-10-16), halving the measured bounce rate.
 *
 * These tests run the real inline script from index.html against a fake
 * navigator.serviceWorker, rather than grepping it, so they see what it does.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

function bootstrapScript(): string {
  const html = readFileSync(resolve(__dirname, "../../../index.html"), "utf8");
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const sw = scripts.find((s) => s.includes("serviceWorker.register"));
  if (!sw) throw new Error("service-worker bootstrap script not found in index.html");
  return sw;
}

function runBootstrap({ controller }: { controller: object | null }) {
  const listeners: Record<string, Array<() => void>> = {};
  const reg = { update: vi.fn(), addEventListener: vi.fn() };
  const serviceWorker = {
    controller,
    register: vi.fn(() => Promise.resolve(reg)),
    getRegistration: vi.fn(() => Promise.resolve(reg)),
    getRegistrations: vi.fn(() => Promise.resolve([])),
    addEventListener: (type: string, fn: () => void) => {
      (listeners[type] ??= []).push(fn);
    },
  };
  const reload = vi.fn();
  const win: Record<string, unknown> = { location: { hostname: "dead-set.org", reload } };
  win.self = win;
  win.top = win;
  const doc = { addEventListener: vi.fn(), visibilityState: "visible" };

  new Function("navigator", "window", "document", "setInterval", bootstrapScript())(
    { serviceWorker },
    win,
    doc,
    vi.fn(),
  );

  const controllerChange = () => (listeners.controllerchange ?? []).forEach((fn) => fn());
  return { reload, controllerChange, listeners };
}

describe("index.html service-worker reload", () => {
  it("registers a controllerchange handler", () => {
    const { listeners } = runBootstrap({ controller: null });
    expect(listeners.controllerchange).toHaveLength(1);
  });

  it("does not reload a first-time visitor when the first SW claims the page", () => {
    const { reload, controllerChange } = runBootstrap({ controller: null });
    controllerChange();
    expect(reload).not.toHaveBeenCalled();
  });

  it("still reloads that tab if a later SW update takes over", () => {
    const { reload, controllerChange } = runBootstrap({ controller: null });
    controllerChange(); // first install claims the page
    controllerChange(); // a deploy's new SW replaces it
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("reloads a returning visitor exactly once when a new SW replaces the old one", () => {
    const { reload, controllerChange } = runBootstrap({ controller: {} });
    controllerChange();
    expect(reload).toHaveBeenCalledTimes(1); // on the FIRST change, not a later one
    controllerChange();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
