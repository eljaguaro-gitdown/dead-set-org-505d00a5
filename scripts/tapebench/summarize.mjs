#!/usr/bin/env node
/**
 * Score a TapeBench run against the ground-truth labels, append the summary
 * to docs/playback-sprint/STATUS.md, and write a compact committed report.
 *
 *   node scripts/tapebench/summarize.mjs scripts/tapebench/reports/raw/<runId>.json [--no-status]
 *
 * Definitions (the Exit Target in STATUS.md, made exact):
 *   success        a tap on a night labelled "yes" that produced its first
 *                  sound within 15 s of the click (play_first_sound.ms).
 *                  A Plan B sound counts only when the tap's own night failed
 *                  for an Archive-side reason (kind unreachable / wont_play /
 *                  timeout) — never for a matcher miss.
 *   tap-to-sound   play_first_sound.ms over "yes" taps. p50/p90 are reported
 *                  two ways: over the taps that sounded, and STRICT, with every
 *                  "yes" tap that did not sound counted as infinitely slow.
 *                  The target is graded on STRICT.
 *   ack            the first visible answer to the click: the tap-ack marker,
 *                  the digging card, the oops card, the bar's error, a toast,
 *                  the autoplay prompt, or the sound itself.
 *   silent         ms from the click to sound OR an honest answer (oops card,
 *                  bar error, toast, autoplay prompt, Plan B card). The digging
 *                  card is reassurance, not an answer, so it does not count.
 *   blocked        play_failed kind=autoplay_blocked, a shim refusal, or a
 *                  NotSupportedError in the console.
 *   plan B         a tap on a "no" night (or one that failed Archive-side)
 *                  whose page later produced a sound from another night.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const rawPath = process.argv[2];
if (!rawPath) { console.error("usage: summarize.mjs <raw report>"); process.exit(2); }
const run = JSON.parse(fs.readFileSync(path.resolve(root, rawPath), "utf8"));
const labels = JSON.parse(fs.readFileSync(path.join(root, "scripts/tapebench/labels.json"), "utf8")).labels;

const pct = (arr, p) => {
  if (arr.length === 0) return null;
  const s = [...arr].sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[i];
};
const fmtMs = (v) => (v === null ? "—" : v === Infinity ? "∞" : v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${Math.round(v)} ms`);
const rate = (n, d) => (d === 0 ? "—" : `${((100 * n) / d).toFixed(1)}% (${n}/${d})`);
const ARCHIVE_SIDE = new Set(["unreachable", "wont_play", "timeout"]);

const rows = run.taps.map((t) => {
  const label = labels[t.id]?.truth ?? "unlabelled";
  const recs = t.taps ?? [];
  const req = recs.find((r) => r.event === "play_requested");
  const mine = req ? recs.filter((r) => r.tap_id === req.tap_id) : [];
  const sound = mine.find((r) => r.event === "play_first_sound");
  const failed = mine.find((r) => r.event === "play_failed");
  // A later tap on the page that sounded = Plan B (the bench never taps twice).
  const later = recs.filter((r) => r.tap_id !== req?.tap_id);
  const laterReq = later.find((r) => r.event === "play_requested");
  const planB = laterReq ? later.find((r) => r.tap_id === laterReq.tap_id && r.event === "play_first_sound") : null;
  const m = t.marks ?? {};
  const soundMs = sound?.ms ?? null;
  const honest = [m.oops, m.barError, m.toast, m.autoplayPrompt, m.planB].filter((v) => typeof v === "number");
  const answerMs = Math.min(soundMs ?? Infinity, ...honest, planB ? (failed?.ms ?? 0) + 0 : Infinity);
  const ackMs = Math.min(m.ack ?? Infinity, m.crate ?? Infinity, soundMs ?? Infinity, ...honest);
  const blocked =
    failed?.kind === "autoplay_blocked" ||
    (t.shim?.blocked ?? 0) > 0 ||
    (t.consoleErrors ?? []).some((e) => /NotSupportedError/.test(e));
  const planBMs = planB ? planB.ms + (failed?.ms ?? 0) : null;
  const success =
    label === "yes" &&
    ((soundMs !== null && soundMs <= 15000) ||
      (!!planB && !!failed && ARCHIVE_SIDE.has(failed.kind) && planBMs !== null && planBMs <= 15000));
  return {
    id: t.id, surface: t.surface, title: t.title, showDate: t.showDate, label,
    soundMs, failed: failed ? { kind: failed.kind, stage: failed.stage, ms: failed.ms } : null,
    planB: !!planB, ackMs, answerMs, blocked, success, benchError: t.benchError ?? null,
    writes: (t.stubbedWrites ?? []).length,
  };
});

const valid = rows.filter((r) => !r.benchError);
const yes = valid.filter((r) => r.label === "yes");
const no = valid.filter((r) => r.label === "no");
const unknown = valid.filter((r) => r.label === "unknown" || r.label === "unlabelled");
const sounded = yes.filter((r) => r.soundMs !== null).map((r) => r.soundMs);
const strict = yes.map((r) => (r.soundMs !== null ? r.soundMs : Infinity));
const ackOk = valid.filter((r) => r.ackMs <= 300).length;
const silent = valid.filter((r) => r.answerMs > 8000).length;
const blocked = valid.filter((r) => r.blocked).length;
const noCovered = no.filter((r) => r.planB).length;

const metrics = {
  success: { n: yes.filter((r) => r.success).length, d: yes.length },
  p50: pct(strict, 50), p90: pct(strict, 90),
  p50Sounded: pct(sounded, 50), p90Sounded: pct(sounded, 90),
  ack300: { n: ackOk, d: valid.length },
  ackP50: pct(valid.map((r) => r.ackMs), 50),
  silentOver8s: silent,
  blocked,
  noTapePlanB: { n: noCovered, d: no.length },
  unknownSounded: { n: unknown.filter((r) => r.soundMs !== null).length, d: unknown.length },
  benchErrors: rows.length - valid.length,
  stubbedWrites: rows.reduce((a, r) => a + r.writes, 0),
};

const pass = {
  success: metrics.success.d > 0 && metrics.success.n / metrics.success.d >= 0.98,
  p50: metrics.p50 !== null && metrics.p50 <= 1500,
  p90: metrics.p90 !== null && metrics.p90 <= 3000,
  ack: metrics.ack300.n === metrics.ack300.d,
  silent: metrics.silentOver8s === 0,
  blocked: metrics.blocked === 0,
  planB: metrics.noTapePlanB.d === 0 || metrics.noTapePlanB.n === metrics.noTapePlanB.d,
};
const allPass = Object.values(pass).every(Boolean);

const failures = {};
for (const r of yes.filter((r) => !r.success)) {
  const key = r.failed ? `${r.failed.kind}@${r.failed.stage}` : r.soundMs !== null ? "sound>15s" : "no answer";
  (failures[key] ??= []).push(`${r.title} ${r.showDate ?? ""} (${r.surface})`);
}
const bySurface = {};
for (const r of yes) {
  const s = (bySurface[r.surface] ??= { n: 0, ok: 0, ms: [] });
  s.n++; if (r.success) s.ok++; s.ms.push(r.soundMs ?? Infinity);
}

const ok = (b) => (b ? "PASS" : "fail");
const md = `
### Run \`${run.runId}\`

${run.profile} · build \`${run.sha}\` · ${run.startedAt} · ${run.minutes} min · ${valid.length} taps scored (${metrics.benchErrors} bench errors)${run.note ? ` · ${run.note}` : ""}

| Metric | Value | Target | |
|---|---|---|---|
| Play success (night has a tape → sound ≤ 15 s) | ${rate(metrics.success.n, metrics.success.d)} | ≥ 98% | ${ok(pass.success)} |
| Tap-to-first-sound p50 (strict) | ${fmtMs(metrics.p50)} | ≤ 1.5 s | ${ok(pass.p50)} |
| Tap-to-first-sound p90 (strict) | ${fmtMs(metrics.p90)} | ≤ 3.0 s | ${ok(pass.p90)} |
| — over taps that sounded: p50 / p90 | ${fmtMs(metrics.p50Sounded)} / ${fmtMs(metrics.p90Sounded)} | | |
| Acknowledged within 300 ms | ${rate(metrics.ack300.n, metrics.ack300.d)} (p50 ${fmtMs(metrics.ackP50)}) | every tap | ${ok(pass.ack)} |
| Silent wait over 8 s | ${metrics.silentOver8s} taps | 0 | ${ok(pass.silent)} |
| Autoplay blocked / NotSupportedError | ${metrics.blocked} taps | 0 | ${ok(pass.blocked)} |
| No-tape nights covered by Plan B | ${rate(metrics.noTapePlanB.n, metrics.noTapePlanB.d)} | 100% | ${ok(pass.planB)} |
| Unknown-truth nights that sounded (matcher) | ${rate(metrics.unknownSounded.n, metrics.unknownSounded.d)} | report | |
| Production writes stubbed | ${metrics.stubbedWrites} | (none reached production) | |

**Verdict:** ${allPass ? "**ALL TARGETS MET**" : "targets not met"}

By surface (tape exists): ${Object.entries(bySurface).map(([s, v]) => `${s} ${v.ok}/${v.n}, p90 ${fmtMs(pct(v.ms, 90))}`).join(" · ")}

Failures on nights that have a tape:
${Object.keys(failures).length === 0 ? "- none" : Object.entries(failures).sort((a, b) => b[1].length - a[1].length).map(([k, v]) => `- **${k}** × ${v.length}: ${v.slice(0, 6).join("; ")}${v.length > 6 ? "; …" : ""}`).join("\n")}
`;

const outDir = path.join(root, "scripts/tapebench/reports");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, `${run.runId}.json`), JSON.stringify({ runId: run.runId, profile: run.profile, sha: run.sha, startedAt: run.startedAt, settings: run.settings, metrics, pass, allPass, failures, rows }, null, 1));
if (!process.argv.includes("--no-status")) fs.appendFileSync(path.join(root, "docs/playback-sprint/STATUS.md"), md);
process.stdout.write(md);
