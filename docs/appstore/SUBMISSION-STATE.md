# App Store submission — current state

**Read this before doing anything toward the iOS submission.** It exists because
the submission's state does not live in this repo: most of it lives in App Store
Connect, Lovable Cloud, and the Supabase auth config, and a session that reads
only the repo will draw confident wrong conclusions. That happened repeatedly on
2026-09-17; the corrections are banked in `CLAUDE.md`.

**Last updated:** 2026-09-20, after run 21 uploaded build 22 from `3bcde32`.

Paths beginning `claude/` below are docs in the **Dead Set Claude project**, not
files in this repo — don't go looking for them on disk. Everything else is
repo-relative.
**Update this file whenever submission state changes.** A stale version of this
doc is worse than no doc, because it will be believed.

---

## Where things stand

| | |
|---|---|
| App Store Connect | Record exists — **Apple ID 6799269210**, "Dead Set: Wake Now Discover", iOS App 1.0 at *Prepare for Submission* |
| Builds | **21 uploaded.** Builds 1–19 are from 2026-08-07 to 2026-08-21. Build 21 went up 2026-09-17 (run 20). **Build 22 was uploaded 2026-09-20 by run 21** and is the newest |
| Build pipeline | Works, and it is CI. **Every build came from `ios-testflight.yml`** |
| CI workflow | `.github/workflows/ios-testflight.yml`, `workflow_dispatch`, **run 21 times, every run succeeded**, 2026-08-07 to 2026-09-20 |
| Code | PR #35's submission-blocking fixes are on `main`; build 22 adds 43 further commits |

**Builds 1–19 all predate the fixes — do not submit any of them.** Build 19 still
renders Steal Your Face in the header and still has the broken native auth
redirect. Submitting it would ship the IP exposure that PR #35 removed, and
screenshots taken from it would put a Grateful Dead Productions mark on the
store page.

**Build 22 is the current submission candidate.** Uploaded 2026-09-20 by run 21
of the CI workflow (run id 35535662846), from `main` at `3bcde32` — the same sha
the QA gate graded. The run's own log ends `Upload succeeded.` / `Uploaded App` /
`** EXPORT SUCCEEDED **` at 20:31:14 UTC.

**The build number 22 is derived, not read off a log.** `run_number` was 21
(GitHub API) and `BUILD_NUMBER_OFFSET` is 1 in the workflow file at the sha that
was checked out, so the archive step computed 22. The step's log echo shows
`$(( 21 + ${BUILD_NUMBER_OFFSET} ))` unevaluated, so the literal string "22"
appears nowhere in the run log — **App Store Connect is the confirming
authority.** Check it there, and expect a creation time of roughly 20:31 UTC
(build creation lands one workflow-duration, 3 min here, after the run start).
While a build is Processing, ASC shows a placeholder tile instead of the app
icon; that is not a missing asset.

Build 21 (2026-09-17, from `23cc133`) remains valid and submittable — it is
simply older. Build 22 carries everything in it plus 43 commits.

**What build 22 adds over build 21:** PostHog instrumentation (genuinely
initialized now, with session replay, autocapture, heatmaps and surveys
explicitly disabled), guest-funnel events, the "Play the N sleepers" button fix,
a share-metric correction (CTA clicks no longer counted as shares), Songbook
Issue 002, era-aware liner notes, the `encodeArchiveNotes` dedupe, and a
typecheck/lockfile cleanup. **Nothing under `ios/` or `capacitor.config.ts`
changed**, so the native shell is byte-for-byte the build-21 configuration.

**Gate status:** `qa-release` returned **PASS WITH NOTES** on `3bcde32` — no
blocks, 8 items passed, 3 unobservable in a sandbox with no browser and no
egress (on-device email confirmation, `/setlist/:id` for a logged-out viewer,
live PostHog delivery). Those three are exactly what this TestFlight build
exists to let a real device settle.

The ASC timestamps also settle where the earlier builds came from. Each build's
creation time is one workflow-duration after its run started: run 18 (Aug 9
3:40 PM local) → build 18 at 3:43 PM, run 19 (Aug 21 2:49 AM) → build 19 at
2:53 AM, run 20 (Sep 17 4:52 PM) → build 21 at 4:55 PM. The icons agree too:
builds 13–17 carry the old mark, 18 onward the Cosmic Charlie icon that landed
Aug 9, the day build 18 was created.

## What PR #35 fixed

1. **Retired Steal Your Face.** The exact mark was rendered in 8 components via
   `StealYourFace.tsx`. Now `CharlieMark.tsx` renders Matt Leunig's Cosmic
   Charlie. Guideline 4.1(c); Rhino actively enforces this mark.
2. **Gapless player can fail visibly.** `GlobalAudioPlayer` routes to
   `GaplessPlayerBar` on iOS, so `AudioPlayer.tsx` never mounts and all its
   recovery code was dead. `transport` now carries `error`/`retry`, with
   resolution and stall watchdogs.
3. **Native auth completes.** Redirects were `window.location.origin` =
   `capacitor://localhost`. Now `authRedirectTo()` + the `org.deadset.app`
   scheme + `DeepLinkPlugin.swift`.
4. **Stream-only Archive items honored.** `archiveOrg.ts` now reads
   `access-restricted-item` / `stream_only` and never requests a restricted
   lossless original. 12s `AbortController` on every archive.org fetch.
5. **Telemetry.** Listen clock no longer freezes on tab hide; presence no longer
   ghosts. See `claude/deadset_play_telemetry_finding.md` (Claude project).
6. **Non-affiliation disclaimer** in footer, About, store description, reviewer
   notes. `ads.txt` deleted. Privacy manifest reconciled with the policy and the
   ASC questionnaire.
7. **Charlie at mark sizes.** The illustration is ~20% mandala border, which
   destroys him below 88px. `src/lib/charlieArt.ts` picks a face crop under that
   threshold.

## What is left, in dependency order

1. ~~**Run the CI workflow.**~~ **Done twice** — run 20 → build 21
   (2026-09-17), run 21 → build 22 (2026-09-20), both `Upload succeeded`.
   The offset fix **is now merged to `main`** (verified: `BUILD_NUMBER_OFFSET: 1`
   on `origin/main`), so this doc's former warning that it was stranded on
   `claude/wonderful-hawking-qav0uh` (PR #36) is obsolete — a dispatch from
   `main` is safe. The offset was briefly 20, on the mistaken belief that Xcode
   had uploaded builds 1–19 and this workflow had never run; that would have
   uploaded build 40. See `CLAUDE.md`.
2. **Screenshots** — iPhone **6.5"** only (1242x2688, 2688x1242, 1284x2778,
   2778x1284). ASC uses only the first three on the install sheet. Must come
   from build 21 or later so Cosmic Charlie appears, not Steal Your Face;
   prefer **build 22**, the newest. One caveat if the share poster is among
   them: `SetlistPoster.tsx:819` styles the new version-note caption
   `hsl(28 20% 44%)`, which computes to **4.18:1** on `#0a0a0a` — under AA's
   4.5:1 for small italic text. The `dead.gold` token would give 6.49:1. Not a
   rejection risk, but it is in the frame on the surface most likely to be
   screenshotted.
3. **Demo account** `eljaguaro+appreview@gmail.com` — create AND confirm on
   build 21 or later; those are the builds where native email confirmation
   works. Missing credentials is a near-automatic 2.1 rejection. Give the
   reviewer **email credentials** regardless of what else the sign-in screen
   offers — a reviewer cannot be asked to own a Google or Apple account.

   **Changed after build 22:** Google and Apple sign-in now work inside the
   iOS app, via `ASWebAuthenticationSession` (`ios/App/App/WebAuthPlugin.swift`
   + `src/lib/oauthSignIn.ts`). They were hidden before because Google refuses
   OAuth in an embedded web view and a WKWebView redirect cannot round-trip
   back. Two consequences for the submission:
   - **Guideline 4.8 now applies.** Offering Google means Sign in with Apple
     must be offered too — it is, on the same screen. Do not ship a build that
     offers one without the other.
   - **Supabase must allow-list `org.deadset.app://auth-callback`** (Lovable →
     project → Cloud → Users → Auth settings → Redirect URLs). It is the same
     entry email confirmation already depends on, and OAuth deliberately sends
     the bare callback with no query string so both legs match one allow-list
     entry. Nothing changes on the Google or Apple developer console side —
     those still redirect to Supabase's own `/auth/v1/callback`.
4. **Description** — paste from `metadata.md`; the field was still empty as of
   2026-09-17. Subtitle goes under **App Information**, not the version page.
5. **Age Rating** — under **App Information** (not "Ratings and Reviews", which
   is customer reviews). See the open decision below.
6. **App Privacy** — Privacy Policy URL lives here, not on the version page.
   Declare Product Interaction *linked*, Device ID *linked*, neither tracking.
   **Needs a reconciliation pass before submission (new with build 22).** A
   third-party analytics SDK now genuinely ships inside the bundle: `posthog-js`
   is in `dist/` and `.init()`s inside the WKWebView, sending events straight to
   `VITE_PUBLIC_POSTHOG_HOST` rather than through Supabase. Three consequences:
   - `PrivacyInfo.xcprivacy`'s header comment still claims "No third-party
     analytics, attribution, or tracking SDKs are bundled" and "All backend
     calls hit our own backend" — both now false.
   - `identifyUser()` (`src/hooks/useAuth.ts`) sends **email address and display
     name** to PostHog, but those two `NSPrivacyCollectedDataType` entries list
     only AppFunctionality/Authentication purposes. The Analytics purpose is
     missing — an undercount, not just stale prose.
   - `NSPrivacyTracking=false` / empty `NSPrivacyTrackingDomains` still look
     defensible: this is first-party product analytics, not cross-app ad
     tracking under ATT, and replay/autocapture/heatmaps/surveys are explicitly
     off in `src/lib/posthog.ts`.
   `metadata.md`'s App Privacy section (written 2026-09-17, pre-PostHog) happens
   to cover Product Interaction and Device ID already, but names no third-party
   processor. A manifest that disagrees with the ASC questionnaire is a known
   rejection trigger — fix before **submission**, not before TestFlight.
   (Correcting a stale claim in the other direction: the comment in
   `src/lib/posthog.ts` says the manifest "does not declare ProductInteraction".
   It does — linked, for AppFunctionality+Analytics.)
7. **App Review** — demo credentials + paste `reviewer-notes.md`.
8. **Pricing and Availability** → Free.

## Decisions taken

- **Steal Your Face → Cosmic Charlie** (Jay, 2026-09-17). The 60s spin was
  dropped: a rotating portrait reads as a bug where a rotating disc read as a
  record. Reversible.
- **Deep links use a hand-written Swift plugin, not `@capacitor/app`** — see
  `claude/deadset_native_deeplink_decision.md` (Claude project). Driven by the
  bun.lock
  constraint below, not by preference.
- **Lovable's security findings are triaged, not auto-fixed** — see
  `claude/deadset_security_findings_triage.md` (Claude project). Do **not** use
  "Try to fix all":
  the Critical's obvious fix breaks anonymous play telemetry.

## Decisions still open (Jay)

- **Age rating.** The Indica/Sativa vibe labels read as drug references, pushing
  to 12+/17+. Renaming the two chips is cheaper than the badge.
- **Diagnostics declarations.** `PrivacyInfo.xcprivacy` declares CrashData and
  PerformanceData. **This changed with build 22:** PostHog's exception capture
  is deliberately left ON (`src/lib/posthog.ts` explains why — it reports errors,
  not behaviour), so CrashData is no longer a declaration for data never
  collected. PerformanceData still is. The open question narrows to whether to
  drop the PerformanceData entry.
- **`EraArt.tsx` motifs.** It draws hand-line `syf` and `bolt` shapes. Much
  weaker exposure than the exact logo, and `DESIGN.md` governs that system.
- **Counsel questions** — the "Dead Set" name (a 1981 GD album title), whether
  the band's revocable taping forbearance covers an app with accounts, and
  whether to approach Rhino at all.

## Not done, deliberately

- **Taper / source / lineage per recording.** Nothing in `src/` reads those
  fields. This is the strongest affirmative argument under guideline 5.2 and the
  thing Relisten does that Dead Set does not. Worth building; not a blocker.
- **Edge-function rate limiting.** Nine analytics tables accept anonymous
  INSERTs with no `WITH CHECK`, and the repo is public, so the schema is public.
  A data-integrity problem, not a disclosure one.

## Precedent worth keeping in the reviewer notes

Relisten (App Store ID 715886886, on the store since 2014), Live Music Archive,
and Attics all stream Grateful Dead from the LMA and name the band in their
listings. **None of them uses a Grateful Dead logo.** That was the distinction
that mattered, and it is why item 1 above was a blocker.
