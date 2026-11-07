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
