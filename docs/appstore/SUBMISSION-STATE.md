# App Store submission — current state

**Read this before doing anything toward the iOS submission.** It exists because
the submission's state does not live in this repo: most of it lives in App Store
Connect, Lovable Cloud, and the Supabase auth config, and a session that reads
only the repo will draw confident wrong conclusions. That happened repeatedly on
2026-09-17; the corrections are banked in `CLAUDE.md`.

**Last updated:** 2026-09-18, after opening PR #39 (year-range dig-deep) and
correcting two stale claims about the CI offset fix.

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
| Builds | **20 uploaded.** Builds 1–19 are from 2026-08-07 to 2026-08-21. **Build 21 was uploaded 2026-09-17 by run 20** and is the first build carrying the PR #35 fixes |
| Build pipeline | Works, and it is CI. **All 19 builds came from `ios-testflight.yml`** |
| CI workflow | `.github/workflows/ios-testflight.yml`, `workflow_dispatch`, **run 20 times, every run succeeded**, 2026-08-07 to 2026-09-17 |
| Code | All submission-blocking fixes merged to `main` in PR #35 (5 commits) |
| Candidate | **PR #39 is open app code.** If it merges, the next build — not 21 — becomes the candidate. See "The candidate moves with app code" below |

**Builds 1–19 all predate the fixes — do not submit any of them.** Build 19 still
renders Steal Your Face in the header and still has the broken native auth
redirect. Submitting it would ship the IP exposure that PR #35 removed, and
screenshots taken from it would put a Grateful Dead Productions mark on the
store page.

**Build 21 is the first submittable build.** Uploaded 2026-09-17 by run 20 of
the CI workflow, from `23cc133`, whose app code is identical to `main` at
`e47817d`. Confirmed in App Store Connect as **1.0 (21), created Sep 17 2026
4:55 PM**, *Processing* at the time of writing — check it reached *Ready to
Submit* before building anything else on it. While a build is Processing, ASC
shows a placeholder tile instead of the app icon; that is not a missing asset.

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

1. ~~**Run the CI workflow** → uploads build 21.~~ **Done 2026-09-17** (run 20,
   `Upload succeeded`). The offset was briefly 20, set on the mistaken belief
   that Xcode had uploaded builds 1–19 and this workflow had never run — that
   would have uploaded build 40. Corrected to 1 before the run; see `CLAUDE.md`.
   ~~The offset fix is still only on `claude/wonderful-hawking-qav0uh` (PR #36)
   — merge it, or the next run dispatched from `main` reverts to offset 20.~~
   **Merged — this warning is resolved (2026-09-18).** Verified by content, not
   by branch name: `60959f9` on `main` is the merge commit for PR #36, and
   `.github/workflows/ios-testflight.yml` on `main` reads
   `BUILD_NUMBER_OFFSET: 1`. The next run is run_number 21 → **build 22**.
   **Note the trap this doc walked into:** the branch
   `claude/wonderful-hawking-qav0uh` was *reused* after #36 merged, and is now
   the head of **PR #37** (the sync badge, on hold). A "(PR #36)" pointer at
   that branch name therefore resolves to the wrong PR — the same branch-name
   collision banked in `CLAUDE.md`. Verify by sha and file content, never by
   branch name or remembered PR number.
2. **Screenshots** — iPhone **6.5"** only (1242x2688, 2688x1242, 1284x2778,
   2778x1284). ASC uses only the first three on the install sheet. Must come
   from build 21 or later so Cosmic Charlie appears, not Steal Your Face —
   and from **whichever build is actually the candidate**, which moves every
   time app code merges. Still not taken as of 2026-09-18, which is why
   merging PR #39 costs no screenshot rework.
3. **Demo account** `eljaguaro+appreview@gmail.com` — create AND confirm on
   build 21, which is the first build where native email confirmation works.
   Missing credentials is a near-automatic 2.1 rejection.
4. **Description** — paste from `metadata.md`; the field was still empty as of
   2026-09-17. Subtitle goes under **App Information**, not the version page.
5. **Age Rating** — under **App Information** (not "Ratings and Reviews", which
   is customer reviews). See the open decision below.
6. **App Privacy** — Privacy Policy URL lives here, not on the version page.
   Declare Product Interaction *linked*, Device ID *linked*, neither tracking.
7. **App Review** — demo credentials + paste `reviewer-notes.md`.
8. **Pricing and Availability** → Free.

## The candidate moves with app code

**Build 21 is the candidate only until the next app-code merge.** This is the
rule the "Where things stand" table points at, written out because it is the
thing a session re-derives wrongly: the candidate is not a build you pick, it
is whatever build carries the current `main`.

Open PRs, and what each does to the candidate:

| PR | Contents | Effect |
|---|---|---|
| **#39** year-range dig-deep | App code (`src/`) | **Supersedes build 21.** Requires a new CI run and re-verification |
| **#37** sync badge | App code, admin-only, cosmetic | Same effect — deliberately held until after submission for exactly this reason |
| **#38** reviewer notes | Docs only | None. Safe to merge against any candidate |

Merging #39 costs a CI run (run 21 → build 22) and a fresh `qa-release` pass.
It costs **no screenshot rework**, because screenshots have never been taken —
which is the argument for taking the feature now rather than after submission.

**`qa-release` is mandatory before any publish or App Store build, and it does
not carry over.** A PASS on build 21 says nothing about build 22. Run it in its
own git worktree, from a session that did not write the code.

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
  PerformanceData, but no crash/performance SDK ships anywhere in the project.
  Over-declaring is not a rejection risk but puts "Diagnostics" on the public
  privacy label for data never collected.
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
