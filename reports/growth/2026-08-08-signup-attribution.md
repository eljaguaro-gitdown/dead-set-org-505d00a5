# Growth Review — 2026-08-08 (Signup Attribution Special)

**Scope note:** This pass ran on **Supabase attribution data only** (`visitor_attribution`, `page_visits`, `auth_events`), pre-pulled by the orchestrator on 2026-08-08 ~20:45 UTC. `POSTHOG_API_KEY` / `POSTHOG_PROJECT_ID` were not set and no PostHog MCP was connected in this session — no PostHog numbers appear anywhere below. This is a departure from the standard weekly WoW funnel format; the standing top-of-funnel (landing→builder) and share-loop (`/setlist/:id`) priorities are **not** covered here and should be picked back up in the next full weekly review once PostHog access is restored. See the PostHog follow-up list at the end.

## Question asked
Jay: "Where do our signups actually come from, and what should we test next?"

## Headline answer
We mostly can't say, yet — and the reason is a code-level attribution gap, not just small-sample noise. Full detail below.

## The data (as received)

### 1. `visitor_attribution` first-touch source → visitors/signups, all time (site launched ~2026-04-24)
| Source | Visitors | Signups | Window |
|---|---|---|---|
| dead-set.org (self-referral, pre-Jul-11 artifact) | 256 | 30 | 2026-04-25 → 2026-07-11 |
| www.dead-set.org (self-referral, post-Jul-11) | 77 | 23 | 2026-07-11 → 2026-08-08 |
| (direct/none) | 13 | 12 | 2026-04-24 → 2026-08-08 |
| lovable (lovable.dev + preview URLs) | 360 | 2 | — |
| instagram | 14 | 2 | 2026-04-26 → 2026-05-17 (nothing since) |
| facebook | 14 | 0 | through 2026-08-04 |
| google (organic) | 4 | 0 | — |
| l.threads.com | 1 | 0 | — |
| junk/scraper long tail (~10 domains) | ~1 each | 0 | — |
| netlify deploy previews | ~7 | 0 | — |

### 2. Last-30-days `page_visits` (693 views / 203 unique visitors)
no-referrer 367v/155u · self-referral www.dead-set.org 106v/73u · lovable.dev 78v/6u · accounts.google.com 17v/8u (OAuth returns) · appleid.apple.com 4v/3u · google.com organic 2v/1u · **zero instagram-referred views**.

### 3. `auth_events` funnel, all time
- `auth_modal_opened`: 190
- Google OAuth: 32 redirects started → 48 `oauth_returned` (returns > starts — treat as an instrumentation artifact, likely multi-fire on return, not a >100% conversion)
- Apple OAuth: 10 started → 3 returned (Apple sign-in was **broken until 2026-08-07**, now fixed — exclude pre-fix Apple numbers from any rate calc)
- Email signup: 28 attempts → **15 failed** → 13 succeeded; 52 `email_confirmed` events
- Email sign-in: 11 attempts → 4 failed → 7 succeeded

### 4. Signups by month
Apr 19, May 21, Jun 2 (collapse), Jul 21 (recovery, coincides with beta push), Aug 6-so-far. Total registered users: 52, of which an estimated 8–10 are QA/test/founder accounts (`qa-verify-*`, `test-*`, "DJ Dead Set," Jay's own).

## Root cause: why attribution looks broken

I traced the pipeline in code rather than just trusting the caution flagged in the brief.

- `supabase/functions/track-visit/index.ts` → `classifySource()` builds `visitor_attribution.first_source` from **only two inputs**: `document.referrer` (parsed for known hostnames — google, facebook, twitter, reddit, instagram, lovable) and a raw `?ref=` query-string param. **It never reads `utm_source` or any other `utm_*` param.**
- `src/components/VisitorTracker.tsx` (the client caller) sends `referrer: document.referrer` and `ref_param: new URLSearchParams(location.search).get("ref")` — again, `ref`, not `utm_source`.
- `src/components/UtmCapture.tsx` is a **separate, parallel** system: it captures `utm_source/medium/campaign/content/term` into `sessionStorage` and registers them as **PostHog super-properties** only. It does not write to Supabase at all.

Net effect: **Supabase's `visitor_attribution`/`page_visits` tables and PostHog's utm-based attribution are two disconnected pipelines that don't talk to each other.** Any campaign tagged with `utm_source=instagram` will show up correctly in PostHog (once we can query it) but will show up in Supabase as whatever `document.referrer` happens to be — which, for Instagram's in-app browser, is typically empty. When `document.referrer` is empty and there's no `?ref=` param, `classifySource()` falls through to the generic bucket: effectively "no-referrer" in `page_visits`, and in `visitor_attribution` either no insert at all or a self-referral row if the *next* touch (e.g., an OAuth redirect back to `dead-set.org`) is what actually gets first-touch-inserted at the point signup completes.

This explains two things in the dataset directly:
1. **Why the two self-referral buckets dominate signups** (53 of ~69 non-junk all-time signups, ~77%): they're not really "the marketing site referring itself" — they're the fallback bucket absorbing OAuth-redirect returns (`accounts.google.com`, `appleid.apple.com` show up separately in `page_visits` but the *first-touch* row for that visitor may already have been set on an earlier empty-referrer visit, or overwritten) and empty-referrer landings generally, of which in-app-browser social traffic is a major and unquantified component.
2. **Why Instagram shows zero referred views in the last 30 days** despite being described as the main social channel: it's very unlikely the channel went dark for 30 days without anyone noticing — far more likely IG's in-app browser is stripping the referrer on every click, and today's bio link carries no `ref` param to compensate, so those visits land silently in "no-referrer" instead of "instagram."

**Bottom line: we do not currently have reliable signup-source data for ~75%+ of signups, and the likely biggest single unmeasured channel is Instagram.** This is a measurement problem to fix before drawing any channel-mix conclusions, not a genuine finding that organic/self-referral traffic drives most signups.

## Secondary findings (real signal, not attribution artifacts)

- **Lovable-referred traffic (360 visitors, the single largest bucket) converts at 0.6% (2 signups)** — this is overwhelmingly dev/preview traffic and should be excluded from any external marketing-channel conversion math; leaving it in silently deflates blended conversion rates and could mislead a "which channel works" comparison.
- **Email signup fails 54% of the time (15 of 28 attempts)** — this is the single worst step visible in the whole funnel, worse in relative terms than any channel-mix question. Failure reasons live in `auth_events` metadata, which was not pulled for this pass (see follow-up list). Given 190 `auth_modal_opened` vs. only ~42-44 real (non-QA) registered users total-to-date, the modal→success drop-off is large, and email failures are a plausible meaningful contributor.
- **Google OAuth returns (48) exceeding starts (32)** and **Apple OAuth's pre-fix 70% loss (10→3, fixed 2026-08-07)** are both real but need re-baselining, not a conversion read right now: Google's numbers look like a double-fire bug in the return handler, and Apple's history before Aug 7 should be dropped from any rate calculation going forward.
- **Small-sample caution:** the beta cohort is ~40 Founding Deadheads and total registered users is 52 (many QA). Any single-digit weekly swing (Instagram's 2 signups, June's collapse to 2 signups) is well within noise for a cohort this size — treat month-over-month attribution splits as directional at best.

## What moved and why (release context)
Recent commits (per `git log`) are all iOS/Capacitor work — native audio engine, lock-screen metadata, Apple sign-in fix (2026-08-07) — not landing/attribution changes. No landing-page or track-visit changes shipped in this window, so the attribution gap described above is not new; it has likely been present since `track-visit`/`UtmCapture` were built as separate systems, and simply hasn't been diagnosed until now because nobody had queried Supabase and code side by side.

## This week's experiment

**Hypothesis:** A meaningful share of the "no-referrer" and self-referral buckets in `visitor_attribution` is actually Instagram traffic, hidden because Instagram's in-app browser strips `document.referrer` and today's bio/story/post links carry no `?ref=` param for `classifySource()` to fall back on.

**Change (community-steward action, not a code change):** Update the Instagram bio link and all new story/post/reel CTAs to append a `?ref=` query param that the existing pipeline already reads — e.g. `?ref=instagram-bio`, `?ref=instagram-story`, `?ref=instagram-post`, `?ref=instagram-reel` — distinct per placement so medium is recoverable later. Note: `utm_source=instagram` (the orchestrator's original suggestion) should still be added too since it feeds the separate PostHog pipeline, but **`ref=` is the parameter that actually moves the Supabase numbers analyzed in this report** — send both.

**Follow-up for a build session (not this session — I don't edit `src/`):** Consider making `classifySource()` in `supabase/functions/track-visit/index.ts` also parse `utm_source` (with `ref` taking precedence if both present), so the Supabase and PostHog attribution pictures converge instead of silently diverging. Flagging this as a concrete, small, high-value fix for Jay to route to a build session.

**Measured by:** `visitor_attribution` rows where `first_source` starts with `instagram` — visitor count and signup count, week-over-week, for the two weeks following the link change, compared against a trailing baseline (14 visitors / 2 signups across ~3.5 weeks of activity to date, i.e. ~4 visitors/week baseline). Also watch whether the "no-referrer" share of `page_visits` shrinks correspondingly.

**Decision threshold:** Given the beta's small scale, don't over-read a 2x swing. Call it validated if instagram-attributed visitors in the two-week post-change window are **≥3x the ~4/week baseline (i.e., ≥12 in two weeks)** AND at least one additional signup attributes to instagram that the current pipeline would have missed. If validated, route "how do we grow Instagram-driven signups" to community-steward as a real, measurable channel rather than a guess. If not validated at that threshold with reasonable posting volume, the honest read is that Instagram isn't currently a meaningful signup driver at beta scale, independent of measurement — worth knowing either way.

**Status of last week's experiment:** No prior week-1 experiment in `reports/growth/` to report against — this is the first report in this directory.

## Runner-up (not this week's pick, but flagged)
**Email signup failure investigation.** 15 of 28 email signup attempts fail (54%) — the largest concrete leak visible in this dataset. Not proposed as this week's experiment because it needs a diagnostic pull first (failure reasons live in `auth_events.metadata`, not retrieved this pass) before a specific fix can be tested. Recommend as next week's PostHog/Supabase follow-up: pull `auth_events` metadata for failed email signups, bucket by error type (weak password, duplicate email, rate limit, network/timeout), and turn the top bucket into a proper experiment.

## PostHog follow-up list (run when POSTHOG_API_KEY / POSTHOG_PROJECT_ID or MCP are available)
1. `utm_source` breakdown via PostHog super-properties (from `UtmCapture.tsx`) for Instagram bio/story/post/reel — this is the *only* place real Instagram-tagged traffic is currently visible; cross-check against the Supabase `ref=` numbers once both exist.
2. `dispatch_link_landed` event volumes and conversion, segmented by `utm_source`/`utm_medium` — validate whether email-dispatch traffic is under- or over-counted in the Supabase attribution tables the same way Instagram is.
3. Full `auth_modal_opened` → OAuth/email-started → signup-succeeded funnel, segmented by device (mobile vs. desktop — mobile is the dominant traffic source per standing context) and new vs. returning visitor.
4. Landing → builder anonymous-draft conversion (the standing top-of-funnel priority) — not touched in this attribution-only pass; needs its own segmented pull next.
5. `/setlist/:id` share-loop entry and conversion (the standing highest-leverage priority) — also not touched here; needs mobile vs. desktop and entry-path segmentation.
6. Apple sign-in success rate for the two weeks post-2026-08-07 fix vs. the broken period, to confirm the fix actually recovered conversions rather than just event volume.
7. Google OAuth start vs. return event de-duplication — confirm the 32-starts/48-returns mismatch is a client double-fire and not a data-loss issue on the starts side.
