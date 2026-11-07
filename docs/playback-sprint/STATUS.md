# Playback sprint — status

Resume file. A fresh session reads this and DECISIONS.md and continues.

## Exit target

| Metric | Baseline | Target | Latest |
|---|---|---|---|
| Play success (tape exists → sound within 15 s) | tbd | ≥ 98% | — |
| Tap-to-first-sound p50, WebKit iPhone, Fast-4G | tbd | ≤ 1.5 s | — |
| Tap-to-first-sound p90, same | tbd | ≤ 3.0 s | — |
| Visible acknowledgment of the tap | 450 ms card | ≤ 300 ms, every tap | — |
| Silent wait over 8 s | up to 25 s | 0 taps | — |
| autoplay_blocked / NotSupportedError in WebKit | 10 field / 30 d | 0 in bench | — |
| Taps on a night with no playable tape | dead end | 100% card + Plan B sound | — |

## Runs

(none yet)

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
