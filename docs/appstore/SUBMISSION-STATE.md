# App Store submission — current state

**Read this before doing anything toward the iOS submission.** It exists because
the submission's state does not live in this repo: most of it lives in App Store
Connect, Lovable Cloud, and the Supabase auth config, and a session that reads
only the repo will draw confident wrong conclusions. That happened repeatedly on
2026-09-17; the corrections are banked in `CLAUDE.md`.

**Last updated:** 2026-09-23 — **iOS App 1.0 (build 27) was REJECTED on
2026-09-22 at 17:02 PT under Guideline 2.1, Information Needed.** Submission ID
`f8593d8a-e9fc-4a91-a4b5-dabad5b63632`, submitted 01:12 PT the same day.

**Read the rejection before reacting to it.** Apple's own first line is that the
app "has been submitted by a developer account that has a limited App Review
history" and they "need additional information to better understand the app".
No defect, no crash, no policy finding, and nothing cited against the binary.
The "Prevent Common Issues" list at the foot of the message is boilerplate
attached to every 2.1 — it is not a list of findings against this app, and
reading it as one will send someone rebuilding things that were never wrong.

**No new build is required.** Build 27 is unchanged and still the right binary.
The response is a reply, a replaced Notes field, and a screen recording, then
Resubmit on the same submission. Everything needed is drafted in
[`review-response-2.1.md`](review-response-2.1.md), with the 4000-character
Notes replacement in [`reviewer-notes-v2.txt`](reviewer-notes-v2.txt) (3952
characters, counted, 48 spare).

Apple asked for six things: a screen recording from a physical device, purpose
and audience, setup and access, external services, regional differences, and
evidence of rights to protected third-party material.

**The trap in the recording, which is worth more than the rest of it:** Apple
requires account deletion to be demonstrated. Recording that on
`eljaguaro+appreview@gmail.com` destroys the credentials the reviewer needs and
earns a second 2.1, this time on "Accessing the app". Create a throwaway
account on camera, use it throughout, and delete that one.

Three things the earlier submission did **not** settle, unchanged by the
rejection:

1. **EU DSA trader status is still undeclared.** It is not a submission-blocking
   field; it is enforced separately, and an app without a verified declaration
   is removed from the EU App Store. Declare **non-trader** (free, no ads, no
   IAP, no subscriptions; the only donate link points at archive.org, not the
   developer). Declaring trader would publish a home address, phone and email
   on the EU product page.
2. **Whether the release is manual.** If "Automatically release this version"
   was left selected, approval ships the app at whatever hour Apple approves it,
   with no chance to line up the web publish or the dispatch.
3. **The published web IS behind `main` — now confirmed, not inferred.** See
   below.

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
| Builds | **26 uploaded.** Builds 1–19 are from 2026-08-07 to 2026-08-21; builds 21–27 on 2026-09-17 to 09-21. **Build 27 was uploaded 2026-09-21 by run 26, from `main` at `0353397`,** and is the submission candidate. Build 23's OAuth is broken — see below |
| Build pipeline | Works, and it is CI. **Every build came from `ios-testflight.yml`** |
| CI workflow | `.github/workflows/ios-testflight.yml`, `workflow_dispatch`, **run 26 times, every run succeeded**, 2026-08-07 to 2026-09-21 |
| Code | PR #35's submission-blocking fixes are on `main`; build 22 adds 43 further commits |

**Builds 1–19 all predate the fixes — do not submit any of them.** Build 19 still
renders Steal Your Face in the header and still has the broken native auth
redirect. Submitting it would ship the IP exposure that PR #35 removed, and
screenshots taken from it would put a Grateful Dead Productions mark on the
store page.

**Build 27 is the submission candidate — submit this one.** Uploaded
2026-09-21 by run 26 (run id 35573327254) from `main` at `0353397`, `Upload
succeeded` at 07:34:02 UTC. Build number derived as always: run_number 26 +
offset 1. The number was **derived, then confirmed**: the run's own log
could not be read from this environment (the Actions log-archive host is
blocked by egress policy), so the arithmetic stood alone until the build
installed from TestFlight onto Jay's phone showing **27**. Derivation and
device agree.

**Build 26 was the candidate for about three hours and is superseded.** It
was cut from `edb7d5c`, one commit before the two fixes below landed, so it
ships the consent alert naming the app "App" and the signup dead end. Do not
substitute it.

**It is the first build on which every submission claim is simultaneously
true**, which is why earlier builds should not be substituted for it:

| Claim | True since |
|---|---|
| Cosmic Charlie, no Steal Your Face | build 21 |
| Native deep link handles password reset | build 21 |
| Google and Apple sign-in in the app | build 24 |
| Share-poster caption clears AA contrast | build 25 |
| Privacy manifest declares Analytics on Email and Name | **build 26** |
| No phantom `PerformanceData` on the privacy label | **build 26** |
| No cannabis strain names in the vibe chips | build 26 |
| Sign-in consent alert names "Dead Set", not "App" | **build 27** |
| Signup failures get an actionable message | **build 27** |
| OAuth start event actually reaches `auth_events` | **build 27** |

Answer the age-rating questionnaire and the App Privacy questionnaire against
**this** build. Against build 25 the strain labels are still present and the
manifest still understates what PostHog receives.

The version-record fields — Age Ratings, Content Rights, App Review
Information, pricing, screenshots — attach to version 1.0, not to a build.
Swapping the selected build from 26 to 27 does not reset any of them.

---

**Build 25** (the previous candidate). Uploaded 2026-09-21 by run
24 (run id 35551481149) from **`main`** at `df1497e`, `Upload succeeded` at
01:40:53 UTC. The first build since 22 cut from `main` rather than a branch, so
"the newest build is `main`" is true again. It is build 24 plus the share-poster
caption contrast fix and the two admin-dashboard fixes (PRs #55 and #56).

**Google and Apple sign-in are both confirmed working on device.** Google on
build 24; **Apple confirmed separately on build 26, 2026-09-21 06:06 UTC** —
`auth.identities` shows the `apple` provider signing in at that moment, so
guideline 4.8 rests on a completed round trip rather than on a reading of the
code. The two had only ever been confirmed together before, which left open
the one thing no static check could close: whether the Apple provider was
actually enabled in Lovable Cloud. It is.

**Gate status, stated plainly:** `qa-release` last ran against `3bcde32`
(build 22), returning PASS WITH NOTES. Builds 23, 24 and 25 were dispatched on
Jay's direct instruction without re-running it. Every change since went through
a PR with CI green (typecheck, tests, build), so this is not an unreviewed
build — but `CLAUDE.md` calls that gate mandatory before an App Store build,
and **it should be run against whatever sha is actually submitted**, so the
verdict names the shipping commit.

**TestFlight distribution note:** `ITSAppUsesNonExemptEncryption` is `false` in
`Info.plist`, so no export-compliance question blocks a build from reaching
testers once it finishes processing. Internal testers need an App Store Connect
account (Users and Access) and get builds with no review; external testers need
**Beta App Review**, which requires the demo account in item 3 below — so that
item gates beta testing, not just submission.

---

**Build 24** (the previous candidate). Uploaded 2026-09-20 by run
23 (run id 35538389237) from `d9aa820`, `Upload succeeded` at 21:23:13 UTC. It
is build 23 plus the one line that makes the OAuth plugin exist at runtime.

**Build 23 is superseded and its OAuth is broken** — details below. Uploaded by
run 22 (run id 35537759220) from `b4cfc2f` on
`claude/ios-testflight-build-update-13rsaa` — **not from `main`**, so merge
that branch before anyone reasons about `main` as the shipping code. Log ends
`Upload succeeded` / `** EXPORT SUCCEEDED **` at 21:11:10 UTC. Build number
derived the same way as below: run_number 22 + offset 1.

**What build 23 adds over 22: Google and Apple sign-in work inside the iOS
app.** They were hidden on native because Google refuses OAuth in an embedded
web view; the app now runs the flow through `ASWebAuthenticationSession`
(`ios/App/App/WebAuthPlugin.swift` + `src/lib/oauthSignIn.ts`). **Guideline 4.8
now applies** — Google and Apple must both be offered, and both are.

**Build 23's OAuth does not work — do not test or submit it for that.** The
buttons render, and tapping one raises `"WebAuth" plugin is not implemented on
ios`. The Swift compiled fine and was in the target; it was never *registered*.
App-embedded Capacitor plugins are not auto-discovered — they must be added to
`bridge?.registerPluginInstance(...)` in
[`MainViewController.swift`](../../ios/App/App/MainViewController.swift), whose
own comment says so. `WebAuthPlugin` was missing from that list.

Nothing in CI can catch this, which is the point worth keeping: a plugin
missing from the registration list compiles, archives, uploads and installs,
and fails only when a finger touches the button. A plugin missing from
`project.pbxproj` fails the same way — an unreferenced source is skipped
silently. Both listings are now asserted by
[`nativePluginsRegistered.test.ts`](../../src/lib/__tests__/nativePluginsRegistered.test.ts),
which was confirmed to fail when the registration line is removed. **Any new
`*Plugin.swift` needs both listings, and that test is what remembers.**

---

**Build 22** (the previous candidate) remains valid. Uploaded 2026-09-20 by run 21
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
   prefer **build 24**, the newest. ~~One caveat if the share poster is among
   them: the version-note caption is under AA.~~ **Fixed** — the caption is
   `hsl(28 20% 39%)`, 4.59:1, and every hand-written text colour on the poster
   now clears AA against the paper it sits on.

   *Correction worth keeping:* this entry first recorded that caption as
   **4.18:1 on `#0a0a0a`**. Both halves were wrong. The text does not sit on
   the app's near-black page background — it sits inside `.jcard-paper`, the
   cream J-card, `hsl(42 40% 88%)`. Measured against the right background the
   real figure was **3.79:1**: a worse failure than the one reported, arrived
   at by taking a claim about the background on trust and only checking the
   colour. A contrast ratio is a property of a pair, and
   [`posterContrast.test.ts`](../../src/lib/__tests__/posterContrast.test.ts)
   now reads the background out of `index.css` rather than restating it.
3. ~~**Demo account**~~ **Done 2026-09-21.** `eljaguaro+appreview@gmail.com`
   exists, email provider, signs in, handle `deadset_review`. The password is
   NOT recorded in this repo — it goes straight into App Store Connect (item 7).
   Give the reviewer **email credentials** regardless of what else the sign-in
   screen offers: a reviewer cannot be asked to own a Google or Apple account.
   Missing credentials is a near-automatic 2.1 rejection.

   **Correction, because this doc had it wrong:** it said to "create AND
   confirm" the account, and called build 21 "the first build where native
   email confirmation works". **Email confirmation is switched off for this
   project.** The account was created and confirmed 27 milliseconds apart, and
   29 of 30 email signups since March were auto-confirmed the same way. There
   is no confirmation email and nothing to click.

   The code claim was not wrong, only irrelevant: `authRedirectTo()` +
   `DeepLinkPlugin.swift` do work, and **password reset still depends on
   them** — that is the flow to test on device if you want the deep link
   exercised, not signup. Worth knowing separately: with confirmations off,
   anyone can register with an address they do not own. That is a product
   choice, not a submission blocker.

   **Changed after build 22:** Google and Apple sign-in now work inside the
   iOS app, via `ASWebAuthenticationSession` (`ios/App/App/WebAuthPlugin.swift`
   + `src/lib/oauthSignIn.ts`). They were hidden before because Google refuses
   OAuth in an embedded web view and a WKWebView redirect cannot round-trip
   back. Two consequences for the submission:
   - **Guideline 4.8 now applies.** Offering Google means Sign in with Apple
     must be offered too — it is, on the same screen. Do not ship a build that
     offers one without the other.
   - **Supabase allow-list: already done, verified 2026-09-20.** Lovable →
     project → Cloud → Users → Auth settings → Redirect URLs holds BOTH
     `org.deadset.app://auth-callback` and `org.deadset.app://auth-callback**`
     (12 of 50 entries used; Site URL is `https://www.dead-set.org/`). The
     wildcard entry is what covers a callback carrying a query string, so the
     password-reset deep link (`?next=%2Freset-password`) is allow-listed too.
     OAuth still sends the bare callback — `signInWithProvider` passes no
     `next`, because `smartRedirect` already handles where to land — but that
     is now a simplicity choice, not a constraint the allow-list imposes.
     Nothing changes on the Google or Apple developer console side: those
     still redirect to Supabase's own `/auth/v1/callback`.
4. **Description** — paste from `metadata.md`; the field was still empty as of
   2026-09-17. Subtitle goes under **App Information**, not the version page.
5. **Age Rating** — under **App Information** (not "Ratings and Reviews", which
   is customer reviews). See the open decision below.
6. **App Privacy** — Privacy Policy URL lives here, not on the version page.
   Declare Product Interaction *linked*, Device ID *linked*, neither tracking.
   ~~**Needs a reconciliation pass before submission (new with build 22).**~~
   **Done 2026-09-21** — but **not yet in a build**: `PrivacyInfo.xcprivacy` is
   a bundled resource, so the corrected manifest reaches Apple only in a
   TestFlight build cut after this commit. Build 25 and earlier carry the old
   one. Cut a build before submitting, or the manifest Apple reads is the wrong
   one.

   What was wrong, kept for the record: a third-party analytics SDK genuinely
   ships inside the bundle — `posthog-js` is in `dist/` and `.init()`s inside
   the WKWebView, sending events straight to `VITE_PUBLIC_POSTHOG_HOST` rather
   than through Supabase. Three consequences, all now fixed:
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
   Fixed: the manifest header no longer claims no third-party analytics is
   bundled, Email Address and Name carry the Analytics purpose, and
   `metadata.md`'s App Privacy section now names PostHog as a processor and
   says which fields reach it. A manifest that disagrees with the ASC
   questionnaire is a known rejection trigger, so **answer the questionnaire
   from `metadata.md`, not from memory**.
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

## The published web is behind `main` — confirmed 2026-09-22

**Answered by the badge, not by inference.** `/admin` on a phone reports:

```
APP CODE IN SYNC            <- wrong, see below
THIS BUILD    5387c6c       built 1d ago
GITHUB MAIN   0353397       pushed 1d ago
main is 11 commits ahead - nothing that ships
```

The deployed build is **`5387c6c`**. `main` is `0353397`. Six of the eleven
intervening commits are source files — `src/lib/authFunnel.ts`,
`src/lib/authErrors.ts`, `src/pages/Auth.tsx`, `src/components/AuthModal.tsx`,
`src/components/CosmicCharlieDialog.tsx` and the two test files. So `75b58fa`
is **not** live, and neither is the strain-chip rename.

Two earlier attempts to establish this by inference — Lovable's
`latest_commit_sha` (which describes the project's code, not the deployment)
and the shape of `auth_events` rows — both pointed the right way and neither
could prove it. The badge answered it in one page load. That is now a banked
correction in `CLAUDE.md`.

**The badge was also lying, and had always been lying.** "nothing that ships"
over six changed source files was not bad luck: GitHub's compare `files` is the
diff from the merge base to HEAD, and the badge asked
`compare/main...{buildSha}`, which puts the build at HEAD. A build that is
behind is an ancestor of `main`, so the merge base IS the build and `files`
comes back empty — making `appFiles` empty and `docsOnly` structurally true for
every behind build that has ever existed. The one state the badge exists to
catch was the one state it could not see.

Fixed in `cfcf99e`: the call is now `compare/{buildSha}...{branch}`, with
status and counts inverted to stay build-relative, and `docsOnly` claimable
only when status is `behind` — for an ahead or diverged build an empty `files`
means "cannot see", not "nothing changed". The tests had passed throughout
because they used the old direction AND populated `files` on a behind response,
a shape the API cannot emit; every fixture is now real and the 2026-09-22 state
is a named regression test.

**So the badge fix is itself only on `main`.** Until the web is published, the
instrument stays blind. Publishing needs a current PASS from `qa-release`
(`/pre-release`), and that gate cannot pass from an environment without browser
reachability — the 2026-09-22 run returned BLOCK for exactly that reason, with
no code defects found: `npm ci` clean, `tsc` 0 errors on both projects, 181/188
tests passing (the 7 are `anonDraftRls.test.ts` needing Supabase egress).

If it is behind, publishing requires a current PASS from `qa-release` first
(`/pre-release`). That gate is not waivable for a "small" publish.


## Decisions still open (Jay)

- ~~**Age rating.**~~ **Decided 2026-09-21 (Jay): renamed, not accepted.** The
  three strain-named chips are now Late Night, Daytime Show and Day Into Night.
  The chip **ids** are unchanged (`indica`/`sativa`/`hybrid`)
  because they are persisted to `vibe_ids` and never rendered; renaming them
  would orphan existing rows for no user-visible gain.

  **Correction, 2026-09-21: the drug-reference answer is not "none".** This
  doc and the advice given from it both said to answer NONE once the chips
  were renamed. Grepping the copy afterwards found three first-party
  references that have nothing to do with the chips and still ship in build
  27: the hero line "found, inhaled, and passed on"
  (`src/components/landing/HeroSection.tsx:893`, also `public/podcast.html:169`),
  the era name "The Acid Years" (`src/components/ShowPlate.tsx:5`), and
  "Acid Tests" in the era blurb (`src/components/EraTooltip.tsx:13`). The
  honest answer to *Alcohol, Tobacco, or Drug Use or References* is
  **INFREQUENT**, which is expected to move the rating off 13+. The hero line
  is visible in the App Store screenshots, so the questionnaire and the
  submitted artwork have to agree. Not recommended: cutting the copy to win
  the lower band — the Acid Tests are a documented 1965–66 event series and
  the era name is accurate.

  Profanity NONE and Horror/Fear NONE both hold. The only profanity-adjacent
  hit anywhere is the song title "Hell in a Bucket" in `EraTooltip.tsx`.
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
