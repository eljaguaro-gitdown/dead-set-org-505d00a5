# Playback sprint — status

Resume file. A fresh session reads this and DECISIONS.md and continues.

## Where we are (2026-11-07, branch `claude/dead-set-playback-sprint-k87tl2`)

**How the gate is judged now** (owner decision, DECISIONS.md 2026-11-07):

- WebKit iPhone latency = the app's share over a bare-`<audio>` floor, p50 ≤ 300 ms and p90 ≤ 1.0 s.
- The absolute p50 ≤ 1.5 s / p90 ≤ 3.0 s are judged on `chromium-iphone`.
- Every other row is absolute on both profiles.
- Field confirmation happens after publish.

**Where the bench runs:** `.github/workflows/tapebench.yml` on a GitHub runner. Edit `scripts/tapebench/ci-request.json` and push. Results are in the job log; the artifact host is unreachable from this sandbox. This sandbox's own egress is below Fast-4G, so local runs are for diagnosis only.

**Last runner results** (60-tap samples, build `5dbf402`, before the poster, Plan B timing, shim and proxy fixes):

| Profile | Success | p50 / p90 | Ack ≤ 300 ms | Silent > 8 s | Blocked | Plan B | Floor p50 / p90 | App's share p50 / p90 |
|---|---|---|---|---|---|---|---|---|
| chromium-desktop | 52/52 | 587 ms / 1.49 s | 59/59 | 0 | 0 | 6/6 | 451 / 776 ms | 118 / 440 ms |
| webkit-iphone | 31/52 | — | 59/59 | 24 | 15 | 3/6 | 4.53 / 8.12 s | 664 ms / 3.18 s |

**Fixed since then:**

- Poster prefetch goes index-first. It had filled the link for ~3 s.
- Named recordings get index rows (migration `20261107020000`).
- Plan B steps in at 7.6 s with the sure thing prefetched at 4 s. At 8.0 s every rescued tap had still counted as silent.
- The shim reports its activation window, so the 15 "blocked" were silent-pool blessings refused outside a gesture.
- The proxy drains its queue before closing a tunnel.

A local 20-tap check after these showed blocked 0, ack 20/20 and silent 2. The runner run on `7991bf4` (webkit-iphone + chromium-iphone) was requested at the time of writing.

**Open on WebKit:**

- Plan B tapes that start at 7.6 s and stay silent on WebKitGTK. Traced; the floor alone reaches 8 s at p90.
- WebKitGTK re-probes the file's end several times, one connection per probe. That is the instrument, not the app.

**Deploy order when the gate passes:**

1. Apply migration `20261107020000_tape_index_stored_recordings.sql` to production. It must come first, or index-tapes' new no_match rows violate the old constraint.
2. Ask the Lovable agent to deploy `index-tapes` and `admin-users`.
3. Verify the hourly refresh with a probe.
4. Publish the frontend.
5. Add the `web_releases` row.
6. Confirm `build_sha` in PostHog.

The first two tape-index migrations are already applied.

**Also fixed in passing:** `stamp-build-sha.yml` was invalid YAML (`'chore: stamp build'` unquoted inside `${{ }}`). It had never run, and on main it would never have stamped. It is quoted now, and `workflowsParse.test.ts` parses every workflow.

## Runs

Sandbox runs below the baseline are for diagnosis; the deciding runs are the runner's.

### Run `2026-11-07T0043-webkit-iphone-baseline-0383bf5`

webkit-iphone · build `baseline-0383bf5` · 2026-11-07T00:43:22.211Z · 27.29 min · 319 taps scored (0 bench errors, 16 blocked by the sandbox's network policy and not scored) · baseline: pre-sprint player (0383bf5 engine, live Archive lookups, 12 s caps), telemetry only

| Metric | Value | Target | |
|---|---|---|---|
| Play success (night has a tape → sound ≤ 15 s) | 0.3% (1/295) | ≥ 98% | fail |
| Tap-to-first-sound p50 (strict) | ∞ | ≤ 1.5 s | fail |
| Tap-to-first-sound p90 (strict) | ∞ | ≤ 3.0 s | fail |
| — over taps that sounded: p50 / p90 | 14.67 s / 14.67 s | | |
| Acknowledged within 300 ms | 0.0% (0/319) (p50 578 ms) | every tap | fail |
| Silent wait over 8 s | 98 taps | 0 | fail |
| Autoplay blocked / NotSupportedError | 252 taps | 0 | fail |
| No-tape nights covered by Plan B | 0.0% (0/22) | 100% | fail |
| Unknown-truth nights that sounded (matcher) | 0.0% (0/2) | report | |
| Production writes stubbed | 443 | (none reached production) | |

**Verdict:** targets not met

By surface (tape exists): songbook_spotlight 0/9, p90 ∞ · version_picker 0/124, p90 ∞ · landing_pick 0/39, p90 ∞ · setlist_poster 1/121, p90 ∞ · issue 0/2, p90 ∞

Failures on nights that have a tape:
- **autoplay_blocked@gesture** × 251: Althea 1979-08-04 (songbook_spotlight); Ripple 1989-09-27 (songbook_spotlight); Bird Song 1971-02-19 (songbook_spotlight); Bird Song 1995-06-30 (songbook_spotlight); Stella Blue 1995-07-06 (songbook_spotlight); Slipknot! 1974-06-20 (songbook_spotlight); …
- **no answer** × 27: The Other One 1995-07-08 (version_picker); Playing in the Band 1971-02-18 (version_picker); Scarlet Begonias 1974-03-23 (version_picker); Slipknot! 1974-06-20 (version_picker); Sugaree 1972-05-26 (version_picker); Shakedown Street 1979-10-25 (version_picker); …
- **uncertain@lookup** × 12: Scarlet Begonias  (setlist_poster); Stella Blue  (setlist_poster); Going Down the Road Feeling Bad  (setlist_poster); Eyes of the World  (setlist_poster); Uncle John's Band  (setlist_poster); El Paso  (setlist_poster); …
- **unreachable@lookup** × 4: Crazy Fingers 1975-02-28 (songbook_spotlight); Eyes of the World 1973-02-09 (songbook_spotlight); Stella Blue 1972-06-17 (songbook_spotlight); Ripple 1980-10-04 (setlist_poster)
