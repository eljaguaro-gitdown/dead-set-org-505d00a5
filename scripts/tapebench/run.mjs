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
// --no-control skips the bare-element control (half the Archive traffic).
const withControl = !flag("no-control");
// A different build's output to serve (the baseline worktree's dist-bench).
const distDir = path.resolve(arg("dist", path.join(root, "dist-bench")));

// This sandbox's preinstalled Chromium; a CI runner uses Playwright's own.
const SANDBOX_CHROME = "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";
const PROFILES = {
  "webkit-iphone": { browser: webkit, device: devices["iPhone 15"], throttle: { rttMs: 170, downMbps: 9, upMbps: 1.5 }, shim: true },
  "chromium-desktop": { browser: chromium, device: { viewport: { width: 1280, height: 800 } }, throttle: { rttMs: 0, downMbps: 0, upMbps: 0 }, shim: false, launch: { ...(fs.existsSync(SANDBOX_CHROME) ? { executablePath: SANDBOX_CHROME } : {}), args: ["--autoplay-policy=no-user-gesture-required"] } },
};
const profile = PROFILES[profileName];
if (!profile) throw new Error(`unknown profile ${profileName}`);
if (flag("no-shim")) profile.shim = false;

const sha = arg("sha", "") || (() => { try { return require("node:child_process").execSync("git rev-parse --short HEAD", { cwd: root }).toString().trim(); } catch { return "unknown"; } })();
const runId = `${new Date().toISOString().replace(/[:.]/g, "").slice(0, 15)}-${profileName}-${sha}`;
const shimSource = fs.readFileSync(path.join(root, "scripts/tapebench/iosPolicyShim.js"), "utf8");

let corpus = JSON.parse(fs.readFileSync(path.join(root, corpusPath), "utf8")).taps;
if (only) corpus = corpus.filter((t) => only.split(",").includes(t.surface));
if (ids) { const want = new Set(ids.split(",")); corpus = corpus.filter((t) => want.has(t.id)); }
if (limit) corpus = corpus.slice(0, limit);
// --sample N: a stratified, seeded sample for iteration runs (the owner
// approved ~120-tap runs while iterating; the full corpus decides the target).
const sampleN = Number(arg("sample", "0"));
if (sampleN && sampleN < corpus.length) {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const by = new Map();
  for (const t of corpus) (by.get(t.surface) ?? by.set(t.surface, []).get(t.surface)).push(t);
  const out = [];
  for (const [, list] of by) {
    const want = Math.max(1, Math.round((list.length / corpus.length) * sampleN));
    const shuffled = [...list].sort(() => rnd() - 0.5);
    out.push(...shuffled.slice(0, want));
  }
  corpus = out;
}

async function startPreview() {
  if (!fs.existsSync(path.join(distDir, "index.html"))) throw new Error(`build first: VITE_TAPEBENCH=1 npx vite build --outDir ${distDir}`);
  const proc = spawn("npx", ["vite", "preview", "--outDir", distDir, "--port", String(port), "--strictPort", "--host", "127.0.0.1"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
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
  // The first audio the player asked for: what the control below replays.
  let mediaUrl = null;
  page.on("request", (q) => { if (!mediaUrl && /archive\.org\/.+\.(mp3|ogg|flac|m4a)(\?|$)/i.test(q.url())) mediaUrl = q.url(); });
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
    result.mediaUrl = mediaUrl;
    Object.assign(result, state, { consoleErrors: consoleErrors.slice(0, 8), stubbedWrites: writes, timing: { loadMs: t.loaded - t.start, totalMs: Date.now() - t.start } });
  } catch (e) {
    result.benchError = String(e).slice(0, 300);
  } finally {
    await ctx.close().catch(() => {});
  }
  return result;
}

/**
 * The control: a bare <audio> element, no app code at all, handed the exact
 * track the player asked for, in a fresh context on the same throttled
 * network, a moment after the tap. Its time to first sound is the floor this
 * browser and this network put under ANY player, so the app's own share of a
 * tap is (tap's first sound − control's first sound).
 *
 * Why it exists (DECISIONS.md, 2026-11-07): Playwright's WebKit is WebKitGTK,
 * whose media stack is GStreamer, not the AVFoundation an iPhone uses. It
 * opens a fresh connection for every range request it makes while probing an
 * mp3 (six or seven before the first sample), and this sandbox's egress to
 * the Archive measured 1.7–5 Mbps — under the Fast-4G profile before any
 * throttle is applied. A bare element on the Archive took 3.3 s unthrottled
 * and 4.7–7.0 s throttled. Without a control the bench grades the instrument.
 */
async function runControl(browser, proxyUrl, url) {
  const ctx = await browser.newContext({ proxy: { server: proxyUrl, bypass: "127.0.0.1,localhost" } });
  try {
    const page = await ctx.newPage();
    await page.setContent("<p>control</p>");
    return await page.evaluate(async (u) => {
      const a = new Audio();
      const t0 = performance.now();
      a.src = u;
      a.play().catch(() => {});
      return await new Promise((res) => {
        const iv = setInterval(() => {
          if (a.currentTime > 0) { clearInterval(iv); a.pause(); a.removeAttribute("src"); a.load(); res(Math.round(performance.now() - t0)); }
          else if (a.error || performance.now() - t0 > 15000) { clearInterval(iv); res(null); }
        }, 25);
      });
    }, url);
  } catch {
    return null;
  } finally {
    await ctx.close().catch(() => {});
  }
}

/**
 * One run at a time. On 2026-11-07 a run that had not exited kept tapping
 * while a second one started: six workers shared one CPU and the sandbox's
 * egress, and a rebuild swapped dist-bench under the first run's server, so
 * both reports measured a machine that was not the one described in them.
 */
function takeLock() {
  const lock = path.join(root, "scripts/tapebench/reports/raw/.lock");
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  try {
    const pid = Number(fs.readFileSync(lock, "utf8"));
    if (pid && pid !== process.pid) { process.kill(pid, 0); throw new Error(`another TapeBench run is live (pid ${pid}); stop it first`); }
  } catch (e) {
    if (/another TapeBench/.test(String(e))) throw e; // ESRCH / ENOENT: stale or absent
  }
  fs.writeFileSync(lock, String(process.pid));
  process.on("exit", () => { try { if (Number(fs.readFileSync(lock, "utf8")) === process.pid) fs.unlinkSync(lock); } catch { /* */ } });
}

async function main() {
  takeLock();
  const preview = await startPreview();
  // A browser that dies mid-run (a container restart, an OOM) is relaunched
  // rather than failing every tap after it as a bench error.
  let browser = await profile.browser.launch({ ...(profile.launch ?? {}) });
  let relaunching = null;
  const ensureBrowser = async () => {
    if (browser.isConnected()) return browser;
    relaunching ??= profile.browser.launch({ ...(profile.launch ?? {}) }).then((b) => { browser = b; relaunching = null; return b; });
    return relaunching;
  };
  const proxies = await Promise.all(Array.from({ length: workers }, () => startThrottleProxy(profile.throttle)));
  const results = [];
  let next = 0;
  const started = Date.now();
  await Promise.all(proxies.map(async (proxy, w) => {
    while (next < corpus.length) {
      const tap = corpus[next++];
      proxy.refused.clear();
      proxy.tunnels.clear();
      let r = await runTap(await ensureBrowser(), proxy.url, tap);
      if (r.benchError && /has been closed/.test(r.benchError)) {
        proxy.refused.clear();
        r = await runTap(await ensureBrowser(), proxy.url, tap); // once more, on a live browser
      }
      r.sandboxRefused = [...proxy.refused];
      r.tunnels = Object.fromEntries(proxy.tunnels);
      if (withControl && r.mediaUrl) r.controlMs = await runControl(await ensureBrowser(), proxy.url, r.mediaUrl);
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
    settings: { control: withControl, upstream: process.env.HTTPS_PROXY ? "sandbox egress proxy" : "direct", settleAfterMs, listenMs, workers, throttle: profile.throttle, iosShim: profile.shim, device: profileName === "webkit-iphone" ? "iPhone 15" : "desktop 1280x800" },
    taps: results,
  };
  const rawDir = path.join(root, "scripts/tapebench/reports/raw");
  fs.mkdirSync(rawDir, { recursive: true });
  fs.writeFileSync(path.join(rawDir, `${runId}.json`), JSON.stringify(report, null, 1));
  console.log(path.join("scripts/tapebench/reports/raw", `${runId}.json`));
  // Open tunnels can keep the proxies' servers alive; the report is written.
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
