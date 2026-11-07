# Playback sprint — decisions log

Each entry: what was decided, why, and what would reverse it. Newest at the bottom.

## 2026-11-06 — Session network: archive.org allowed, mirror hosts are not enumerable

**Decision.** Added `archive.org` (plus two placeholder `ia*.us.archive.org` names) to this
session's cloud environment so the bench, the tape probe and every live verification can
ask the Internet Archive. The Archive's `/download/` redirect lands on a per-item mirror host
(`ia8NNNNN.us.archive.org`, `dnNNNNNN.ca.archive.org`, …) and the environment allowlist
takes exact hostnames only, so the mirror leg (the bytes themselves) is reachable from this
sandbox only for whichever mirrors are listed.

**Why.** Without the API hosts nothing in Step A can be measured at all. The mirror hosts
are a Settings-level decision (wildcards are refused by the tool).

**What would reverse it.** The owner adding `*.archive.org` in the environment's Settings,
which lets the bench measure first-sound end to end from a cloud session. Until then the
bench measures the resolve chain in the sandbox and the mirror leg is probed with ranged
HEAD requests where the host is reachable; see STATUS.md for which runs had which.

## 2026-11-06 — Build attribution: a CI stamp commit, not a pre-commit hook

**Decision.** `.github/workflows/stamp-build-sha.yml` runs on every push to `main`, writes
`src/buildInfo.ts` with the sha of that push, and commits it back as `chore: stamp build <sha>
[skip ci]`. `scripts/build-sha/resolve.mjs` (used by `vite.config.ts`) and `src/lib/buildSha.ts`
(used by PostHog, the playback reports and the admin badge) both read the file when git cannot
answer, and read *through* a stamp commit to the code commit when git can, so Lovable, CI and
the iOS workflow all report the same sha for the same code. The admin sync badge no longer counts
`src/buildInfo.ts` as shipping drift, so a build of the code commit reads as in sync with a
`main` whose tip is its stamp.

**Why not a pre-commit hook.** A commit's sha is a hash of its own tree, so no file inside the
commit can carry it. A hook can only record the *parent*, which is exactly as misleading as
the stamp commit's parent relation, with none of the CI guarantees.

**Proof so far.** A copy of the tree with no `.git` directory built with the sha in the bundle
(`dist/assets/index-*.js` contains it once, as `BUILD_INFO`). Proof on a Lovable preview build
follows the first merge to `main`: the stamp workflow must run there, and the preview bundle must
carry the stamped sha. Until that is observed the fix is verified in simulation only.

**What would reverse it.** Lovable exposing the commit at build time (an env var in its builder),
which would make `VITE_BUILD_SHA` the whole answer and the stamp commits noise.

## 2026-11-07 — Two trial bench taps wrote to production. Owner: please close one report

**What happened.** The first two trial runs of TapeBench (2026-11-06 23:51 and 2026-11-07
00:02 UTC) used a build that still carried the production PostHog token and Supabase writes.
They filed **one playback report**, `playback_issues.id = f4ee4c35-7e5c-477d-a2ca-846f60dcab1b`
("Drums", 1995-07-09, `wont_play`, report_count 2), and added about six `page_visits` rows on
`/versions/drums` and `/versions/space`. The report is false. The tape was fine. This sandbox's
egress refused the Archive mirror (`ia803101.us.archive.org`) the track redirected to. No fan
reported it and no fan follows it, so no email is owed.

**Owner action.** Close `f4ee4c35…` as *No tape exists* (wont_fix), which notifies nobody, or
leave it for the tape desk with this note. I did not touch it, because the brief forbids pressing
admin buttons and deleting production data.

**Decision.** Bench builds are made with `VITE_PUBLIC_POSTHOG_PROJECT_TOKEN=` and
`VITE_PUBLIC_POSTHOG_HOST=` (empty), and `scripts/tapebench/run.mjs` answers every non-GET to
Supabase inside the browser. It lets through only read-only RPCs (`suggest_known_good_tape`, the
tape index lookup). PostHog and `track-visit` never leave the page. Each tap's report lists the
writes it stubbed, so a bench run can show it wrote nothing.

## 2026-11-07 — Headless WebKit enforces no autoplay rule, so the bench emulates iOS's

**Finding.** Playwright WebKit 26.0 (headless, Linux) resolves `play()` with no user gesture.
A stock WebKit bench can therefore never reproduce the field's 10 `audio_autoplay_blocked` events,
and would report 0 for the target metric whether or not the bug is fixed.

**Decision.** The `webkit-iphone` profile injects `scripts/tapebench/iosPolicyShim.js`. It
rejects `play()` with `NotAllowedError` unless the element was already started from a gesture,
or the page is within 1 s of a trusted tap. That is WebKit's transient-activation model and
iOS's per-element blessing. It is a model and not an iPhone, and the field events are the
check on it (`play_failed` with `stage: "gesture"`).

**What would reverse it.** A real-device run (owner's phone, `?debug=audio`) that disagrees with
the shim, or field `play_failed stage=gesture` staying above 0 after the fix ships.

## 2026-11-07 — Owner approvals received

The owner approved three things in writing in the session on 2026-11-07:

1. **Apply the tape-index migrations to production before the gate.** Done the same day:
   `20261107010000_tape_index.sql` and `20261107011000_tape_index_refresh.sql`, applied through
   Lovable `query_database`. Checked after applying: anon can SELECT and cannot INSERT on
   `tape_index`, authenticated cannot DELETE, anon cannot EXECUTE `tape_index_candidates`, and the
   `tape-index-refresh` cron job exists. It calls `index-tapes`, which does not exist until the
   function is deployed, so its calls fail harmlessly until then.
2. **Ask the Lovable agent to deploy edge functions once the gate passes**, including `index-tapes`.
3. **Iterate on a ~120-tap sample** and spend the full 335-tap corpus only on the two runs that
   decide the exit target.

## 2026-11-07 — One PR, not one per workstream

**Decision.** The brief asks for one PR per workstream. This session may push only to
`claude/dead-set-playback-sprint-k87tl2`, so the work ships as one PR. Its commits are grouped by
workstream: attribution, telemetry, iOS gesture, tape index, fail-fast, card, Plan B.
**Reverse it:** if the owner allows more branches, split the commits into separate PRs.

## 2026-11-07 — Legacy AudioPlayer is out of the iOS gesture fix

**Decision.** The blessed-element pool covers `GaplessEngine` (every iOS Safari since 14.1 has Web
Audio, so it selects gapless) and the hero/spotlight unlock. It does not cover the legacy
`AudioPlayer`. Its `<audio>` is React-rendered after the slot resolves, so adopting a pooled element
means swapping a node React owns. Legacy is reached only through `localStorage.player_engine =
"legacy"` or a browser with no Web Audio. **Reverse it:** field `play_failed stage=gesture` with
`engine: legacy`.

## 2026-11-07 — Index hits stream from the item's own server

**Decision.** When the tape index knows a track's item servers, the engine streams from
`servers[0]` and skips the `/download/` redirect, which saves one round trip per tap. If that
fails, it tries the item's other servers, then the redirect. The `/download/` url stays the
track's identity (reports, verified tapes, failover keys). Previously the redirect was always
tried first, "because a mirror the Archive routes around is its decision to make". The sprint brief
asks for this change. PR #138 had already found the redirect's mirror broken while the item's
servers were healthy. **Reverse it:** field `audio_failover` events concentrated on
`ia*.us.archive.org` first-attempt streams.

## 2026-11-07 — A failing PRELOAD is not the playing track failing (Help on the Way lead)

**Finding.** `gapless` names the track an element error came from ("HTML5 audio error on track N").
The engine passed every error on as the current track's. On 2026-11-06 a fan's Help on the Way 1977-06-09
played for 34 s, then was failed over and filed `wont_play`, and the queue moved to Slipknot!.
That fits a preload of track N+1 failing on a broken mirror. The probe finds the Help on the Way
track today (`resolver_found_tape`), so the tape itself is fine.

**Decision.** `GaplessEngine` reports an error for a track other than `currentTrackIndex` as
`onPreloadError`, not `onError`. The preloaded track is loaded again when the queue reaches it, and
a real failure then is reported as the current track's. **Reverse it:** a test or field trace where
a preload failure was the only signal of a dead current track.

## 2026-11-07 — Medleys and bad nights: the nights are wrong, not the matcher

**Finding.** The tape index read every candidate tape for 691 offerable nights. 99 nights have
recordings, but none carries the song. I checked 27 of them by hand, including all five reported
Slipknot! nights and the 16 such nights in the bench corpus. No track title on the top tapes
contains the song's name, even partially or inside a medley. The few shared words were unrelated
songs ("Six Days On The Road" for "Going Down the Road Feeling Bad"). None of those tapes has an
untitled track either. The matcher already handles segue suites ("Help > Slip > Franklin's").
So these are wrong dates in `songs.first_played/last_played` and in community guides, such as Bird
Song and Playing in the Band at the 1995-07-09 final show, and Caution at 1966-07-03. They are not
matcher misses. The single real matcher gap was "Lady with a Fan", filed as "Terrapin Station" on
the 1977-02-26 debut. The shared matcher now treats a suite as containing the song it opens with,
and only that song.

**Decision.** The index stores those nights as `no_match` (6 with no recording at all as
`no_tape`). The version picker and community issues show "No tape of it from this night" before
the tap, and a tap goes straight to Plan B. I closed the five Slipknot! reports
(1976-06-09, 1977-04-27, 1983-10-06, 1990-03-22, 1991-09-06) as `wont_fix` with the cause in
`fix_note`. That status emails nobody; only `verified` does. I closed the false "Drums" report the
same way. Help on the Way 1977-06-09 stays open with its cause noted: a preload failure was
misattributed to the playing track. The fix is code, so the owner marks it verified after the web
publish that carries it.

**Owner follow-up (data, not code).** The 99 `no_match` nights point at wrong dates in the songs
table and in the Slipknot!, Eyes of the World, Bird Song and Ripple community guides.
`select s.title, t.show_date from tape_index t join songs s on s.id = t.song_id where t.status <>
'playable'` lists them. Correcting the dates is an editorial call, so I left it alone.

## 2026-11-07 — The sandbox cannot measure Fast-4G latency; the bench moves to a GitHub runner, with a control

**What was seen.** After the HTML5-only fix, throttled WebKit taps still took 4–8 s. One tap, traced request by request:

- The app handed the track to the audio element **372 ms** after the tap, with the index read included.
- Everything after that belonged to the media stack and the network.

Three separate faults sat in that remainder:

1. **The bench corrupted its own streams.** The throttle proxy gave every chunk its own `setTimeout`, and Node does not order two timers of different durations that fall due in the same millisecond. Swapped TLS records produced WebKit's "Decryption has failed", and the player failed over to a mirror for a fault that was the bench's. Fixed with one FIFO and one pump timer per direction.
2. **Playwright's WebKit is WebKitGTK, and its media stack is GStreamer, not AVFoundation.** It opened six or seven fresh connections, each a range request, before the first sample.
3. **This sandbox's egress is slower than Fast-4G before any throttle.** It measured 1.7–5 Mbps from two Archive servers, typically ~2.3, and adds ~0.4 s of TLS through the egress proxy.

**The control.** A bare `<audio>` element with no app code, on the same track:

| Browser | Unthrottled | Throttled |
|---|---|---|
| WebKit | 3.3–3.5 s | 4.7–7.0 s |
| Chromium | 3.7–4.5 s | — |

On a smoke run of 9 taps, the control itself took 3.1–13.3 s, or never sounded in 15 s. No player code could reach a 1.5 s p50 on that instrument, so scoring the target there would grade the sandbox.

**Decision.**

- TapeBench gets a **control**: after every tap, a bare element plays the exact track the player requested, in a fresh context on the same network. Reports show the floor and the app's share (tap minus floor) beside the absolute numbers. The Exit Target itself is unchanged.
- The bench can run on a **GitHub-hosted runner** (`.github/workflows/tapebench.yml`), which has no egress proxy. The throttle proxy now dials hosts directly when there is no upstream, so "Fast-4G" there is the network the report names.
- `run.mjs` takes a lock, because two overlapping runs earlier today shared a CPU and a rebuilt bundle and measured neither build.
- The deciding runs will be the runner's, if it can run them. If WebKitGTK's connection pattern alone keeps the floor above 1.5 s even there, that is an owner decision about the instrument, not a code change, and it goes to the owner with the floor numbers.
