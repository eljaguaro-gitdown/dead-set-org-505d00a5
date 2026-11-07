#!/usr/bin/env node
/**
 * TapeBench: tap play on every night in the corpus, in a real browser, against
 * the real Archive, and time what a fan would get.
 *
 *   VITE_TAPEBENCH=1 npx vite build --outDir dist-bench
 *   node scripts/tapebench/run.mjs --profile webkit-iphone [--limit N] [--workers 3] [--only <surface>]
 *   node scripts/tapebench/run.mjs --profile chromium-desktop
 *
 * Profiles:
 *   webkit-iphone     Playwright WebKit, iPhone 15 emulation, Fast-4G throttle
 *                     (170 ms RTT, 9 Mbps down, 1.5 up — scripts/tapebench/throttle-proxy.mjs),
 *                     and the iOS autoplay rule emulated (iosPolicyShim.js).
 *   chromium-desktop  Chromium at 1280x800, unthrottled, no shim.
 *
 * Each tap gets a FRESH browser context (cold HTTP cache, no localStorage),
 * loads the tap's real route, waits 1.5 s as a reader would, then clicks the
 * bench dock (src/lib/tapebench/TapeBenchDock.tsx), which makes the surface's
 * own calls. The tap's outcome is the app's own telemetry record
 * (play_first_sound / play_failed, src/lib/player/tapTelemetry.ts), plus the
 * moment each on-screen answer appeared. Nothing is scored here — see
 * summarize.mjs, which joins this with the ground-truth labels.
 *
 * Output: scripts/tapebench/reports/raw/<runId>.json (git-ignored) and a
 * compact scripts/tapebench/reports/<runId>.json (committed).
 *
 * Stewardship: one tap per worker at a time, three workers by default, and
 * every tap stops listening 20 s after the click or 6 s after its answer —
 * nobody downloads a whole show to run a benchmark.
 */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { startThrottleProxy } from "./throttle-proxy.mjs";

const require = createRequire(import.meta.url);
const { webkit, chromium, devices } = require("playwright");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : d; };
const flag = (n) => process.argv.includes(`--${n}`);

const profileName = arg("profile", "webkit-iphone");
const limit = Number(arg("limit", "0"));
const workers = Number(arg("workers", "3"));
const only = arg("only", "");
const ids = arg("ids", "");
const corpusPath = arg("corpus", "scripts/tapebench/corpus.json");
const settleAfterMs = Number(arg("settle", "1500"));
const listenMs = Number(arg("listen", "20000"));
const port = Number(arg("port", "4173"));
const note = arg("note", "");

const PROFILES = {
  "webkit-iphone": { browser: webkit, device: devices["iPhone 15"], throttle: { rttMs: 170, downMbps: 9, upMbps: 1.5 }, shim: true },
  "chromium-desktop": { browser: chromium, device: { viewport: { width: 1280, height: 800 } }, throttle: { rttMs: 0, downMbps: 0, upMbps: 0 }, shim: false, launch: { executablePath: "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", args: ["--autoplay-policy=no-user-gesture-required"] } },
};
const profile = PROFILES[profileName];
if (!profile) throw new Error(`unknown profile ${profileName}`);
if (flag("no-shim")) profile.shim = false;

const sha = (() => { try { return require("node:child_process").execSync("git rev-parse --short HEAD", { cwd: root }).toString().trim(); } catch { return "unknown"; } })();
const runId = `${new Date().toISOString().replace(/[:.]/g, "").slice(0, 15)}-${profileName}-${sha}`;
const shimSource = fs.readFileSync(path.join(root, "scripts/tapebench/iosPolicyShim.js"), "utf8");

let corpus = JSON.parse(fs.readFileSync(path.join(root, corpusPath), "utf8")).taps;
if (only) corpus = corpus.filter((t) => only.split(",").includes(t.surface));
if (ids) { const want = new Set(ids.split(",")); corpus = corpus.filter((t) => want.has(t.id)); }
if (limit) corpus = corpus.slice(0, limit);

async function startPreview() {
  if (!fs.existsSync(path.join(root, "dist-bench/index.html"))) throw new Error("build first: VITE_TAPEBENCH=1 npx vite build --outDir dist-bench");
  const proc = spawn("npx", ["vite", "preview", "--outDir", "dist-bench", "--port", String(port), "--strictPort", "--host", "127.0.0.1"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  // Poll the server rather than parse its (coloured) banner.
  proc.stdout.resume(); proc.stderr.resume();
  const deadline = Date.now() + 30000;
  for (;;) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`);
      if (res.ok) break;
    } catch { /* not up yet */ }
    if (Date.now() > deadline) { proc.kill(); throw new Error("preview did not start"); }
    await new Promise((r) => setTimeout(r, 300));
  }
  return proc;
}

/** Read-only RPCs the player calls; everything else that is not a GET is stubbed. */
const READ_RPCS = new Set(["suggest_known_good_tape", "tape_index_lookup", "has_role"]);

async function runTap(browser, proxyUrl, tap) {
  const writes = [];
  const t = { start: Date.now() };
  const ctx = await browser.newContext({
    ...profile.device,
    proxy: { server: proxyUrl, bypass: "127.0.0.1,localhost" },
    serviceWorkers: "block",
  });
  if (profile.shim) await ctx.addInitScript(shimSource);
  // The bench must never write to production. On 2026-11-07 two trial taps
  // filed a real playback report ("Drums" 1995-07-09) and four page visits
  // before this existed. Every non-GET to Supabase is answered here, except
  // the read-only RPCs the player needs to behave as it does for a fan; the
  // visit tracker and analytics never leave the browser.
  await ctx.route("**/*", (route) => {
    const req = route.request();
    const url = req.url();
    if (/posthog\.com/.test(url)) return route.fulfill({ status: 204, body: "" });
    if (/\/functions\/v1\/track-visit/.test(url)) return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    if (/\.supabase\.co\//.test(url) && req.method() !== "GET" && req.method() !== "HEAD" && req.method() !== "OPTIONS") {
      const rpc = url.match(/\/rest\/v1\/rpc\/([a-z_]+)/)?.[1];
      if (rpc && READ_RPCS.has(rpc)) return route.continue();
      writes.push(`${req.method()} ${url.replace(/^https:\/\/[^/]+/, "").slice(0, 80)}`);
      return route.fulfill({ status: rpc ? 200 : 201, contentType: "application/json", body: rpc === "report_playback_issue" ? '"00000000-0000-4000-8000-000000000000"' : "null" });
    }
    return route.continue();
  });
  // A first visit would raise the install banner over everything; the bench
  // measures the player, and the banner yields to the card anyway.
  await ctx.addInitScript(() => { try { localStorage.setItem("pwa_install_dismissed", String(Date.now())); } catch { /* */ } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error" || /NotSupportedError|NotAllowedError|MediaError|HTML5 audio error/.test(m.text())) consoleErrors.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${String(e).slice(0, 200)}`));
  const result = { id: tap.id, surface: tap.surface, title: tap.title, showDate: tap.showDate };
  try {
    await page.goto(`http://127.0.0.1:${port}${tap.route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector("#tapebench-tap", { state: "attached", timeout: 20000 });
    t.loaded = Date.now();
    await page.waitForTimeout(settleAfterMs);
    await page.evaluate((spec) => { window.__tapebenchSpec = spec; window.__deadSetTaps = []; }, tap);
    await page.click("#tapebench-tap", { force: true });
    const t0 = Date.now();
    // Listen until the tap settles (then 6 s more, to catch a Plan B sound
    // or a late on-screen answer), or until listenMs.
    let settledAt = null;
    while (Date.now() - t0 < listenMs) {
      await page.waitForTimeout(250);
      const settled = await page.evaluate(() => (window.__deadSetTaps || []).some((r) => r.event !== "play_requested"));
      if (settled && settledAt === null) settledAt = Date.now();
      if (settledAt !== null && Date.now() - settledAt > 6000) break;
    }
    const state = await page.evaluate(() => ({
      taps: window.__deadSetTaps || [],
      marks: window.__tapebenchMarks || null,
      shim: window.__iosShim || null,
      audio: Array.from(document.querySelectorAll("audio")).length,
      barError: document.querySelector("[data-player-error]")?.textContent?.trim() ?? null,
      oops: document.querySelector("[data-playback-oops]")?.textContent?.replace(/\s+/g, " ").trim().slice(0, 160) ?? null,
    }));
    Object.assign(result, state, { consoleErrors: consoleErrors.slice(0, 8), stubbedWrites: writes, timing: { loadMs: t.loaded - t.start, totalMs: Date.now() - t.start } });
  } catch (e) {
    result.benchError = String(e).slice(0, 300);
  } finally {
    await ctx.close().catch(() => {});
  }
  return result;
}

async function main() {
  const preview = await startPreview();
  const browser = await profile.browser.launch({ ...(profile.launch ?? {}) });
  const proxies = await Promise.all(Array.from({ length: workers }, () => startThrottleProxy(profile.throttle)));
  const results = [];
  let next = 0;
  const started = Date.now();
  await Promise.all(proxies.map(async (proxy, w) => {
    while (next < corpus.length) {
      const tap = corpus[next++];
      const r = await runTap(browser, proxy.url, tap);
      results.push(r);
      const sound = r.taps?.find((x) => x.event === "play_first_sound");
      const failed = r.taps?.find((x) => x.event === "play_failed");
      process.stderr.write(`[${results.length}/${corpus.length}] w${w} ${tap.surface.padEnd(18)} ${String(tap.title).slice(0, 22).padEnd(22)} ${tap.showDate ?? "          "} ${sound ? `sound ${sound.ms}ms` : failed ? `FAILED ${failed.kind}@${failed.stage} ${failed.ms}ms` : r.benchError ? `BENCH ${r.benchError.slice(0, 60)}` : "no answer"}\n`);
    }
  }));
  await browser.close();
  for (const p of proxies) await p.close();
  preview.kill();
  const report = {
    runId,
    profile: profileName,
    sha,
    note,
    startedAt: new Date(started).toISOString(),
    minutes: Math.round((Date.now() - started) / 600) / 100,
    settings: { settleAfterMs, listenMs, workers, throttle: profile.throttle, iosShim: profile.shim, device: profileName === "webkit-iphone" ? "iPhone 15" : "desktop 1280x800" },
    taps: results,
  };
  const rawDir = path.join(root, "scripts/tapebench/reports/raw");
  fs.mkdirSync(rawDir, { recursive: true });
  fs.writeFileSync(path.join(rawDir, `${runId}.json`), JSON.stringify(report, null, 1));
  console.log(path.join("scripts/tapebench/reports/raw", `${runId}.json`));
}

main().catch((e) => { console.error(e); process.exit(1); });
