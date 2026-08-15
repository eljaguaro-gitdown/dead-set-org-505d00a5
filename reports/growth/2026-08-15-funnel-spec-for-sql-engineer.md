# Activation Funnel — Definition Spec for SQL Engineer
## Follow-up to `reports/growth/2026-08-15.md` — 2026-08-15

**Scope:** Jay has decided to write funnel SQL in-house (Option 2 from the prior report). This document defines WHAT to measure and the identity/data-quality rules the SQL must respect. It does not contain SQL — a separate SQL engineer implements from this spec. Everything below is grounded in the production row counts/columns supplied in the task brief plus an independent code trace of every write path (`src/lib/*Track*.ts`, `src/components/VisitorTracker.tsx`, `src/hooks/useAuth.ts`, `src/pages/Builder.tsx`, `supabase/functions/track-visit`, `supabase/functions/og-image`, and the relevant migrations). Where I made a judgment call, I say so and why — the SQL engineer should implement exactly what's specified, not re-derive it.

---

## 0. Corrections absorbed from this pass (per the brief)

1. **`wizard_events` coverage gap is real and is a top priority.** Confirmed by direct grep: `trackWizardEvent` is called only from `src/components/CosmicCharlieDialog.tsx` (`wizard_opened` line 139, `priority_selected` line 186, `generate_clicked` lines 243/292). `src/components/CosmicCharlieWelcome.tsx` — the primary entry point for fresh-builder/guest/`?wizard=true` traffic — has zero telemetry calls (confirmed by grep, no `trackWizardEvent` or `posthog` reference in that file). The main wizard funnel is dark; only the mid-build "improve" dialog is instrumented. Treat instrumenting `CosmicCharlieWelcome.tsx` as a top-priority gap, on par with the SPA-route gap (see §4.1).
2. **`ab_test_assignments` is dormant**, last row 2026-07-14. See §4.6 — do not build a "current" standing view on it; treat as historical-only until/unless Jay relaunches a live test.

---

## 1. Canonical activation funnel

Seven steps, source table, exact predicate, denominator, and known gap for each. All predicates assume the identity-stitching rules in §2 and the exclusions in §5.

| # | Step | Source | Predicate (exact) | Denominator | Known gap |
|---|---|---|---|---|---|
| 0 | **Visit** | `page_visits` | Any row. One row = one *full* page load (hard nav or fresh tab) — **not** one row per SPA route change (see §4.1). | Distinct `visitor_id` in window | Cannot reconstruct in-app navigation (e.g. `/` → `/builder` via client-side routing produces only the `/` row). Only the **first-ever** `page_visits` row for a given `visitor_id` is a true "landing page"; any other row is "a page that happened to trigger a full reload" (refresh, deep link, PWA relaunch), not a session's landing page. |
| 1 | **Attributed visit** | `visitor_attribution` | Row exists for `visitor_id`. | Distinct `visitor_id` with a row — **NOT** total visitors (see §5h) | Row is inserted only `if (landingSource \|\| cleanReferrer)` (`track-visit/index.ts:125`) — direct/typed-URL/no-referrer visitors never get a row, ever. Use only for source-mix breakdown of the attributable subset, never as a stand-in for total visitors. |
| 2 | **Builder/wizard engagement** | `wizard_events` | `event_name = 'wizard_opened'` | Distinct `visitor_id`/`user_id` (resolved per §2) in window | Charlie-Dialog-only today (see §0.1) — cannot yet stand in for "entered builder" generally, and cannot yet see the manual/non-Charlie guest path at all (see §4.2). Usable once Welcome is instrumented; even then it only covers the Charlie-guided door, not the manual-add door. |
| 3 | **Setlist created** | `setlists` | Row exists with `creator_id = <user>`. | Distinct `creator_id` in window | `created_at` is stamped identically whether this is a fresh signed-in build or a guest's local draft transferred at the instant of sign-in (`Builder.tsx` guest-transfer effect, ~lines 493–565) — no `source` column exists to tell them apart. See §4.3 for the timing-proximity heuristic to approximate this, and its limits. |
| 4 | **Slots added ("meaningfully built")** | `setlist_slots` | `setlist_id` has **≥3** rows. | Distinct `setlist_id` (or creator) in window | Threshold of 3 is a judgment call, not a schema fact — 1–2 slots plausibly means "poking at the UI," not real construction intent. State the threshold explicitly in every view; make it a named constant so it's trivially adjustable, not hard-coded in five places. |
| 5 | **Shared** | `share_events` | `share_type IN ('setlist','poster')` **and** `setlist_id IS NOT NULL`. Explicitly **exclude** `share_type = 'cta_click'` (a different metric, see §5f) and `share_type = 'app_link'` (generic app referral, not tied to a specific setlist). | Distinct `setlist_id` shared, over distinct `setlist_id` created, in window | None beyond §5f. |
| 6 | **Played** | `play_events` | Row exists; completion defined as `completed = true` (see §3, playback section, for why `completed` and not `ended_reason='finished'`). | Distinct `setlist_id` / `song_id` plays, and completion rate over non-orphaned rows | See §3 for the two-different-thresholds trap and the orphaned-`in_progress`-row handling. |

---

## 2. Identity-stitching rules

### 2.1 The identifiers in play (three, not two — this is the easy mistake to make)

1. **`ds_visitor_id`** (localStorage) — used by `page_visits`, `visitor_attribution`, `auth_events`, `share_events`, `wizard_events`, `play_events` (anonymous rows only), `ab_test_assignments`.
2. **`user_id`** (Supabase `auth.users.id`) — the durable post-signup identity.
3. **`ds_anon_session_id`** (localStorage, `src/lib/anonSession.ts`) — used **only** by `draft_setlists.anon_session_id`. **This is a separate UUID in a separate localStorage key, generated independently of `ds_visitor_id`.** It is not the same value, has no FK or join key back to `ds_visitor_id`, and there is no code path anywhere that reconciles the two. `draft_setlists` rows cannot be stitched to any other funnel table by ID today, full stop. (In practice this is close to moot — see §4.2, `draft_setlists` appears to have no live writers at all.)

### 2.2 Canonical person key

For any row in `page_visits` / `auth_events` / `share_events` / `wizard_events` / `play_events`:

```
person_id = CASE
  WHEN user_id IS NOT NULL THEN 'u:' || user_id::text
  WHEN visitor_id IS NOT NULL THEN 'v:' || visitor_id
  ELSE NULL  -- orphan row, see 2.4
END
```

Use `user_id` as canonical **whenever present on the row**, even if `visitor_id` is also present on that same row (this happens routinely — `trackAuthEvent`, `trackShare`, `trackWizardEvent` all write both fields when both are available; `play_events` is the one table that actively nulls `visitor_id` once `user_id` is known, per `playEventTracker.ts:64`). Never let one physical person get double-counted as both `u:<id>` and `v:<id>` in the same query.

### 2.3 Pre/post-signup retroactive stitching (lifetime metrics only)

For **lifetime** metrics (e.g. "has this person ever created a setlist"), once a `visitor_id` is known to have been linked to a `user_id` (either `visitor_attribution.user_id IS NOT NULL` for that `visitor_id`, or any `auth_events`/`share_events`/`wizard_events` row carries both fields together for that pair), treat all historical rows under that `visitor_id` and all rows under that `user_id` as the same person retroactively.

**Do not** apply this retroactively for **period-bucketed** metrics (e.g. "new visitors this week"). A visitor who first appeared anonymously in week 1 and signed up in week 5 is a "new visitor" in week 1 only — do not also count them as a new/attributed visitor in week 5 just because that's when the `user_id` link resolved.

### 2.4 Orphan rows (no `visitor_id`, no `user_id`) — report, never drop or silently merge

Several tracking helpers **read** `ds_visitor_id` from localStorage but do not **write** it if absent — only `VisitorTracker.tsx` and `abTest.ts` create the key if missing. `trackShare.ts`, `authFunnel.ts`, `wizardEvents.ts`, and `playEventTracker.ts` all just call `localStorage.getItem("ds_visitor_id")` and pass through `null` if it isn't there yet. This creates a real race on a brand-new device/tab: a fast interaction (e.g. tapping "share" on a freshly opened `/setlist/:id` link before `VisitorTracker`'s effect resolves) can produce a row with **both** `visitor_id` and `user_id` null — not "anonymous," genuinely unattributable.

Rule: every funnel view must bucket and display these as their own explicit row/line ("unattributable"), never silently drop them (undercounts real activity) and never silently fold them into one contiguous "anonymous" bucket (overcounts — they are not provably the same person as any other anonymous row). At beta scale (~40 users), even single-digit orphan counts can move a percentage meaningfully — call the raw count out plainly.

### 2.5 Cross-device / cross-browser — not solvable in SQL

There is no mechanism linking two different `ds_visitor_id`s (e.g. phone + laptop) to the same anonymous person before signup. `link_visitor_to_user` only fires for the `visitor_id` present in the *same* browser's localStorage at the moment that browser observes a `SIGNED_IN` event. A person who browses anonymously on mobile, then signs in on desktop, will show as two distinct anonymous "people" pre-signup and correctly consolidate to one only from the moment desktop signs in. This is a structural limitation of the current identifier model — state it plainly to Jay as permanent, not a bug to chase in SQL; fixing it would require a product feature (e.g. cross-device magic-link handoff), out of scope here.

### 2.6 `visitor_attribution.signed_up_at` is not "signed up" — use `profiles.created_at`

**This is the highest-risk trap in the whole spec.** `link_visitor_to_user` (the RPC that writes `visitor_attribution.user_id`/`signed_up_at`) is called from `useAuth.ts` on **every** `SIGNED_IN` event (line 128), not only on genuine new-account creation. An *existing* user signing in on a browser/device whose `ds_visitor_id` has never been linked before (new device, private window, cleared storage) will get a **fresh** `visitor_attribution` row with `signed_up_at = now()` — even though their account is months old. `FunnelWidget.tsx` (the existing admin dashboard) already had to work around exactly this: its code comment reads *"count signups by joining against TRUE signup records (`auth.users.created_at`), not `visitor_attribution.signed_up_at`, which fires on re-link from new devices for existing users"* (`FunnelWidget.tsx:129-131`).

**Ground truth for "this user signed up at time T" is `profiles.created_at`** (stamped by the `handle_new_user` trigger the instant the `auth.users` row is inserted — migration `20260318232431`). Rule: **never** use `visitor_attribution.signed_up_at` to count signups in any period. Use `profiles.created_at` joined by `user_id`. Read `visitor_attribution.user_id`/`signed_up_at` only as "this `visitor_id` got linked to this `user_id` at this time" — useful for reconstructing *which first-touch source an account is associated with*, not for counting the signup event itself.

---

## 3. Secondary standing views

### 3.1 Share loop

- **"Share" definition:** `share_events WHERE share_type IN ('setlist','poster') AND setlist_id IS NOT NULL`. See §5f — this table is mixed-purpose; never aggregate it unfiltered.
- **Channel granularity limit:** `channel` values come from a fixed `ShareChannel` union in `trackShare.ts` (`copy_link, twitter, facebook, tiktok, instagram, native_share, sms, whatsapp, email, download_plate`). There is no `imessage` value — iOS Share Sheet shares (which almost certainly include most iMessage shares, per the standing brief) collapse into `native_share`, indistinguishable from Mail, AirDrop, or any other native share-sheet target. **Cannot isolate iMessage specifically from this data** — say so plainly rather than assuming `native_share ≈ iMessage`.
- **Entry side — better news than the prior report implied.** A share-loop *recipient's* first landing on `/setlist/:id` is, by construction, always a fresh full page load (a link opened from iMessage/social is never an in-app SPA navigation) — so unlike the landing→builder problem, `page_visits` **does** reliably capture the recipient's entry. What's still missing is (a) their auth state at that moment (the dead `setlist_viewer_loaded` event was the only source of this — see §4.4), and (b) proof that a specific visit was *caused* by a specific share rather than organic `/browse` traffic or a search hit, since no per-share tracking token exists in share URLs today (see §4.5).
- **Recommended view shape**, given the above:
  1. **Recipient entry** — parse `page_visits.page_path` for `/setlist/<uuid>` (see §5g for the shared regex), grouped by `setlist_id`, restricted to the **first** `page_visits` row per `(visitor_id, setlist_id)` pair (repeat visits from the same visitor to the same setlist are not new recipients).
  2. **Recipient conversion** — of the visitor_ids from (1), what fraction later resolve to a `user_id` (via `visitor_attribution.user_id` or any `auth_events`/`wizard_events` row for that `visitor_id` carrying a `user_id`), and within what latency.
  3. **Recipient engagement** — of the visitor_ids from (1), what fraction generate a `play_events` row on that same `setlist_id` while still anonymous (i.e. before `visitor_id` disappears from `play_events` at signup — remember `play_events.visitor_id` is nulled once `user_id` exists, so join on `setlist_id` + `visitor_id` for the anonymous window only).
  4. Report all three **per setlist**, not just in aggregate — the "highest-leverage unsolved problem" framing in the brief implies Jay wants to see which specific shared setlists convert and which don't, not just a blended rate.

### 3.2 Playback engagement

- **Starts:** `count(*)` from `play_events` in window, segmented by `setlist_id` / device (§5c) / new-vs-returning.
- **Completion rate — use `completed = true` as the metric of record**, not `ended_reason = 'finished'`. These are **two different thresholds computed at two different moments and they disagree in a real band**:
  - `ended_reason = 'finished'` is decided at track-transition time in `AudioPlayerContext.tsx` (`maybeFinalizeFinished`, line 243-253) using **`currentTime / duration >= 0.85`**.
  - `completed` (boolean column) is computed inside `finalizePlayEvent` (`playEventTracker.ts`, `isCompleted()`) using **`duration_played_ms / track_duration_ms >= 0.9`**, applied regardless of `ended_reason` — so a listen that ends via `ended_reason='skipped'` can still have `completed=true` if ≥90% had played before the skip.
  - **A track ending between 85–90% listened will show `ended_reason='finished'` but `completed=false`.** Report both fields in the standing view, label the discrepancy band explicitly, and use `completed` as the primary "did the play_events fix hold" number since that's the language the standing context already uses ("finish-rate").
- **Orphaned `in_progress` rows:** rows where `ended_reason = 'in_progress'` and `ended_at IS NULL` (the `finalizePlayEvent` beacon never landed — tab crash, force-quit, failed `pagehide` fire). Recommend excluding these from the completion-rate denominator (they are neither finished nor not-finished, they're missing data), but reporting their count/share as a separate instrumentation-health line — a rising orphan rate is itself a signal (e.g. of the gapless-engine reliability question the prior report flagged as unmonitored).
- **Per-setlist rollup:** group by `setlist_id`, since the standing brief cares about which specific reconstructions land.

### 3.3 Creator retention

- **Creator** = any `user_id` with ≥1 row in `setlists`. There is no anonymous "creator" concept at the DB level today (§4.2/§4.3) — `setlists.creator_id` is `NOT NULL`, FK to `auth.users`.
- **Repeat creator** (judgment call): a creator with **≥2 setlists whose `created_at` values are more than 24h apart**. Rationale: a single guest-build-then-immediately-duplicate session (e.g. accidental double-save, or building two variants back to back right after signing up) shouldn't count as "returned." Report the raw distinct-creator count and total-setlist count alongside this derived rate so the threshold's sensitivity is visible, not hidden inside one number.
- QA/founder exclusion (§5a) applies directly here — `creator_id` maps 1:1 to `auth.users`/`profiles`, so the email-pattern join is straightforward.

---

## 4. What is NOT answerable today (and what unlocks it)

### 4.1 Landing → builder, SPA-level (standing priority #1) — CONFIRMED unreconstructable, independently re-derived

Re-verified directly in code, not assumed from the prior report: `VisitorTracker.tsx` is mounted once, in `App.tsx:91`, inside a `useEffect(..., [])` with an **empty dependency array** — it fires exactly once per full page load and never again on `react-router-dom` client-side navigation. A visitor landing on `/` and then clicking through to `/builder` without a hard reload produces exactly **one** `page_visits` row (`/`) and nothing for `/builder`. **This confirms the prior report's read is correct, not a re-guess.** Unlocked by: prior report's migration-plan step 2 (per-route pageview table, firing on every `location.pathname` change — mirror `UtmCapture.tsx`'s existing `useEffect([location.pathname])` pattern, not `VisitorTracker`'s mount-once pattern).

### 4.2 Guest ("anonymous draft mode") building activity — manual/non-Charlie path — NEW finding, corrects an assumption in the task brief

The brief's framing ("Anonymous draft mode (build-before-auth) is live; verify it is instrumented") assumes the `draft_setlists` table is where that activity lives. It is not. Independent grep of `src/` shows **`getAnonDraftClient()` (`src/lib/anonSession.ts`) has zero callers anywhere outside `src/test/anonDraftRls.test.ts`** (which creates and deletes its own rows as an RLS smoke test). The actual "build before auth" UX in `Builder.tsx` — `isGuestMode`, `guestSlots` React state, `sessionStorage.setItem("deadset-guest-cache", ...)` — is **100% client-memory + `sessionStorage`**, and touches Supabase for the first time only at the moment of sign-in (the `setlists` insert inside the `handleAuthenticated`/guest-persist effect, ~`Builder.tsx:493-565`).

Practical implications:
- `draft_setlists` is very likely near-empty in production despite the table, RLS policies, and client factory all existing and passing tests. **Confirm the actual row count before building any view on it** — it wasn't in the grounding row-count table provided, which itself is a hint.
- There is currently **no server-side signal at all** for "an anonymous visitor started building" via the manual/non-Charlie path. The only guest-builder signal that exists is `wizard_events` (Charlie path), and today only from the Dialog surface (§0.1), not Welcome.
- Unlocked by, in order of cost: **(cheap)** add a `wizard_events`-style fire on first guest slot-add in `Builder.tsx` (telemetry-only, no persistence change) — recommended as the fast unlock. **(bigger, real product change)** actually wire `getAnonDraftClient()`/`draft_setlists` into the guest-mode state so drafts persist across refresh/crash, which both derisks lost work and makes `draft_setlists` a real data source — worth flagging to Jay as a separate product-quality improvement, not a pure-telemetry ask.

### 4.3 Setlist origin (guest-transferred vs. fresh signed-in build)

No `source`/`origin` column exists on `setlists`. The only approximation is a **timing-proximity heuristic**: join a `setlists.created_at` to the same `user_id`'s `auth_events` rows (`oauth_returned`, `email_confirmed`, `signin_email_succeeded`) and treat a setlist created within a short window of a sign-in event as "likely guest-transferred." Recommend a **generous window (not sub-second)** — the persist effect explicitly waits for the songs catalog to load before it can resolve slot IDs (`Builder.tsx:515-519`, re-runs the effect if `songs.length === 0`), so on a slow connection this can take several seconds, not milliseconds. This is an **inference, never a fact** — label it as such in any view that uses it, and never present a "% guest-transferred" number without that caveat attached. Unlocked cleanly by: adding a `source text` (or `metadata jsonb`) column to `setlists`, stamped at the two different `.from("setlists").insert(...)` call sites (guest-transfer path vs. normal in-app "new setlist" path) — a small, low-risk change for a build session.

### 4.4 Share-loop recipient auth state at `/setlist/:id`

The dead `setlist_viewer_loaded` PostHog event (enumerated in the prior report) was the only thing that ever captured whether a poster-page visitor arrived signed-in or anonymous. Nothing replaces it today. Unlocked by the prior report's migration-plan step 3 (restore that insert as a real Supabase row).

### 4.5 Which specific share caused a specific recipient's visit/signup

Even after §4.4 ships, this remains open: `share_events` records the **sharer's** action (type/channel/setlist_id), not a trackable link the **recipient's** later visit can be joined back to — there is no per-share tracking token embedded in share URLs today (confirmed: `trackShare.ts` only logs that a share happened, it does not mint or attach any token to the URL being shared). The best available signal, even with everything above shipped, is **setlist-level correlation** ("this setlist got shared, and then got visits/signups in the following days") — never a proven single-recipient attribution chain. This is the real ceiling on "the highest-leverage unsolved problem" as currently instrumented; naming it explicitly so it isn't assumed to be solved once §4.4 ships. A real fix (per-share tracking token in the URL) is a product change, out of scope for the SQL layer.

### 4.6 `ab_test_assignments` — dormant, don't build a "live" view on it

Last row 2026-07-14, `landing_vs_autostart` test. The client code (`abTest.ts` — `getVariant()`, `markConversion()`) still runs and would still insert rows if invoked, but nothing new has landed in over a month, which most likely means either the test was manually stopped or nothing in the UI branches on `variant` anymore. Recommend Jay confirm which — a coin-flip test that no longer actually changes any UI would silently explain a "plateau" if anyone tried to read it as still-live. Any view built on this table should be clearly labeled historical/frozen, not part of the current weekly funnel.

### 4.7 Cross-device/cross-browser journeys

Not fixable in SQL — see §2.5. Name it so no engineering time gets spent chasing it at this layer.

---

## 5. Data-quality traps — checklist for the SQL engineer

**(a) QA/test contamination — confirmed, real pattern, real production incident.** Dispatch 003 (2026-08-13) bounced 3 QA test addresses that had auto-joined the recipient list (`supabase/migrations/20260814050444_...sql`). Exact exclusion predicate to reuse (join via `user_id → auth.users.email`):
```
email ILIKE 'qa-verify-%'
OR email ILIKE 'test\_%@dead-set.org' ESCAPE '\'
OR email ILIKE '%@dead-set-org-qa.test'
OR email ILIKE '%.test' OR email ILIKE '%.example' OR email ILIKE '%.invalid' OR email ILIKE '%.localhost'
OR email ILIKE '%@example.com' OR email ILIKE '%@example.org' OR email ILIKE '%@example.net'
```
The 2026-08-08 report also separately named **"DJ Dead Set"** (a display-name pattern, not email) and **Jay's own founder account** (`eljaguaro@gmail.com` / handle `grateful_jaguaro`) as accounts to exclude from "typical user" cohort math. Recommend **two versions of every standing view**: *raw* (everyone — for exact denominators like "total signups to date") and *real-user* (excludes the email patterns above plus the founder's own `user_id`) — always label which is being shown, never blend silently.

Hard limitation: this filter only works on rows carrying `user_id`. **Anonymous-only rows (visitor_id, no user_id) cannot be filtered this way** — no visitor_id allowlist/denylist exists. This matters concretely because `qa-release` (`.claude/agents/qa-release.md`, checklist items 3–5: Auth / Anonymous draft flow / Share loop) explicitly verifies against "the live/preview URL" with real browser interaction before every publish — this plausibly writes real `auth_events`/`page_visits` rows (and, once instrumented, `wizard_events` on Welcome) on every release gate run. The authenticated portion of that traffic is caught by the email filter above if it uses the `qa-verify-*` pattern; the anonymous portion (page loads, guest-mode clicks, pre-signup) is not caught by anything today. Flag as an open gap, not a solved one.

**(b) Bot/crawler traffic — lower risk than typical, by architecture.** `supabase/functions/og-image/index.ts` serves link-unfurl crawlers (iMessage/Slack/Discord/WhatsApp/social preview bots) a separate server-rendered HTML/SVG response directly, which never executes the React SPA or its `VisitorTracker` component — most unfurl-bot hits never reach `page_visits` at all. Note: that file defines a `BOT_UA` regex (`/bot|crawl|spider|facebook|twitter|slack|discord|telegram|whatsapp|linkedin|pinterest|preview|embed|fetch|curl/i`) but **it is dead code — never referenced anywhere else in the function**, so don't assume active bot-gating is happening there; it isn't gating anything today. Residual risk is any crawler that executes JS (some modern preview services do headless rendering). Recommend applying that same `BOT_UA` regex defensively to `page_visits.user_agent` in any top-of-funnel view — cheap insurance, base rate is probably already low given the architecture.

**(c) Mobile vs. desktop segmentation — no existing server-side classifier.** `src/hooks/use-mobile.tsx` classifies by CSS viewport width client-side only and is never persisted anywhere. The SQL engineer must parse `page_visits.user_agent` directly. Recommend `user_agent ~* 'Mobi|Android|iPhone|iPad|iPod'` → mobile, else desktop — **but flag a known false-negative**: iPadOS 13+ Safari sends a desktop-class UA by default (no "iPad" token) unless the user has explicitly disabled "Request Desktop Website." Given the Dead Set audience (older, at-home listening plausible) this could meaningfully understate mobile / overstate desktop specifically for iPad traffic. No clean server-side fix exists — state this as a known blind spot in every device-segmented view rather than trusting the regex silently, especially given "mobile is the dominant traffic source" is a standing fact this data is meant to support.

**(d) Timezone.** Every timestamp is `timestamptz` (stored UTC); nothing in the existing code converts timezone anywhere (`FunnelWidget.tsx` buckets by UTC calendar day; both `pg_cron` jobs are scheduled in UTC). **Decision (judgment call, stated explicitly): report calendar-day/week boundaries in `America/New_York`** for the weekly growth review, since Jay is US-based per the standing brief — but keep all raw predicates/joins in UTC and apply `AT TIME ZONE 'America/New_York'` only at the final `GROUP BY day` step, never convert whole tables. Note DST-transition weeks in a one-line SQL comment so a future editor doesn't "fix" a 23/25-hour week thinking it's a bug. If Jay isn't actually Eastern, this is a one-line string swap — flag it as an assumption, not a discovered fact.

**(e) `generated_at` vs. `created_at`.** `cosmic_charlie_history.generated_at` is the only table in the schema that doesn't use `created_at` for its primary timestamp. Per the grounding pass this table is the real Charlie-usage signal (5 generations 2026-08-14, 2 on 2026-08-15) and should feed the wizard/builder-engagement view once any UNION-style query spans it alongside other event tables. Alias explicitly (`generated_at AS event_at`) with an inline comment noting the inconsistency, so a copy-pasted `created_at` reference doesn't silently error or, worse, silently succeed against some future compatibility column.

**(f) `share_events` is mixed-purpose.** `share_type = 'cta_click'` (landing/poster CTA-click intent, via `trackCtaClick.ts`, already live for `poster_build_setlist_guest_header`/`_bottom`) is commingled with real shares (`app_link`/`setlist`/`poster`, via `trackShare.ts`) in the same table. Always filter `share_type` explicitly; never aggregate the raw table as "shares."

**(g) `page_visits` has no `setlist_id` column.** Any setlist-level view must parse `page_path` (text) for the `/setlist/:id` pattern. Use one shared fragment everywhere it's needed, e.g. `substring(page_path from '^/setlist/([0-9a-f-]{36})')`, rather than each view reinventing the parse — an inconsistent regex across views would silently produce different totals for "visits to setlist X" between two reports that both claim to answer the same question.

**(h) `visitor_attribution` under-coverage.** Only ~15% of `page_visits` rows correspond to a `visitor_attribution` row in the grounding pull (857 vs. 5644) — not because most visitors are unattributed in reality, but because the insert is gated on `landingSource || cleanReferrer` (§1, step 1). Never use `visitor_attribution` row count as a visitor-total proxy; always use `page_visits` distinct `visitor_id` for totals, and use `visitor_attribution` only for source-mix breakdown of the attributable subset.

**(i) `draft_setlists` — confirm row count before building anything on it.** Per §4.2, it very likely has near-zero rows in production despite the table/RLS/client all existing and passing a test. Don't assume "anonymous draft mode is live" implies this table has data — the code trace says it doesn't.

---

## Handoff note

Every judgment call above (slot threshold for "meaningfully built," repeat-creator window, timing-proximity window for setlist origin, reporting timezone) is written as a named, adjustable constant, not a hard-coded assumption — please keep them that way in the SQL so Jay can tune thresholds without a new migration. Ping back on anything in §4 before building a view that silently assumes a gap is closed.
