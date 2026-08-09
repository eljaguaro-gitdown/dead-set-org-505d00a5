# Growth Review — 2026-08-09 (Instagram Cohort, First Visit)

**Scope note:** Ad-hoc analysis, not the standard weekly WoW funnel. No PostHog access this session (`POSTHOG_API_KEY`/`POSTHOG_PROJECT_ID` unset, no MCP) — the orchestrator pre-pulled Supabase-side numbers (`page_visits`, presence, `auth_events`, `share_events`) for the 75-minute window around Jay's 2026-08-08 ~23:45 UTC Instagram carousel post ("Little pockets," 3 setlists tagged `?ref=instagram-post`). Cohort is **~12 unique anonymous visitors** — small-sample, do not over-read any single percentage below. `src/` was read-only for this analysis (`SetlistPoster.tsx` and related lib/hook files); no app code was changed.

## Question asked
Jay: "Let's analyze the Instagram visitors' behavior — what they did and did not do. How do we hold on, engage, retain, and get signups? I'm concerned about our site design."

## The honest read, by confidence level

**High confidence (presence channel is a separate, independently-working system — Realtime broadcast, not the broken Postgres write path):**
- ~12 anon visitors landed directly on `/setlist/:id` within ~10 min of the post; arrivals cluster 23:48–23:56 UTC.
- 6 of them held "Viewing Setlist" presence for several minutes — genuine attention, not bounce-and-gone.
- **Zero** of them navigated to any other route (no `/`, `/browse`, `/auth`, no second setlist). Every visitor's `page_visits` rows are 1–2 (SPA double-fire) on the single landing page and nothing else.
- **Zero** `auth_modal_opened` events from the cohort — confirmed against the code: on this page, `auth_modal_opened` only fires via a full page-visit to `/auth` (`Auth.tsx:35`) or the `AuthModal` component; nothing else on the poster page triggers it. Since page_visits shows zero secondary navigation, this is internally consistent, not a separate anomaly: **nobody tapped Upvote, nobody tapped a song-heart, nobody tapped the comment "Sign in" link.** All three of those are the only sign-in affordances on the page, and all three went untouched.
- Only 1 `share_events` row in the window, and it's Jay's own `copy_link` (`ShareDropdown.tsx:63`) — the cohort did not re-share.

**Cannot be concluded (instrumentation gap — genuinely unknown, not "no"):**
- Whether anyone pressed Play / tapped a song. `play_events` shows 0 rows with `user_id IS NULL` over the trailing 30 days — but I traced the code and found the anonymous play-tracking path has **two separate, real bugs** (below) that would silently produce exactly this signature (zero usable anonymous rows) *regardless of whether people actually played anything*. So "0 anonymous play_events" cannot be read as "nobody played" — it is at least partly, and maybe entirely, a broken sensor.

## Root causes found in the anonymous play-tracking path (code-verified, not speculation)

`src/lib/playEventTracker.ts` is the only place `play_events` rows get written, and `AudioPlayerContext.tsx:390` calls it unconditionally (no auth gate) whenever `playingSlot` changes — so the *call* happens for anon plays too. Two RLS-shaped bugs downstream then break it:

1. **`startPlayEvent` can't see its own insert.** It does `supabase.from("play_events").insert({...}).select("id").single()` (`playEventTracker.ts:60-75`). The table's only RLS `SELECT` policy is `"Admins can read play events"` (admin-only) — there is no policy letting a non-admin (anon *or* authenticated) read back their own row. Postgres RLS filters `RETURNING`/`.select()` output through the applicable `SELECT` policy, so for every non-admin caller this `.select().single()` comes back empty/erroring, `data` is falsy, and the code does `if (error || !data) return;` — **`active` never gets set, so `finalizePlayEvent` is a permanent no-op for the rest of that listening session.** This matches the "Jay's own session shows play_events, but the cohort shows none" pattern exactly: Jay is admin, so his `SELECT` policy passes and his round-trip works (which is also why his FLAC-era stale rows are visible to him — separate issue, same conclusion: the plumbing only works for admins).
2. **Even where an insert *does* land, `finalizePlayEvent`'s `UPDATE` can't match its own row for anon visitors.** The anonymous `UPDATE` RLS policy (`20260430054551_...sql:44-58`) requires `visitor_id = current_setting('request.headers')::json->>'x-visitor-id'`. Nothing in the client ever sends an `x-visitor-id` header — the default Supabase client (`src/integrations/supabase/client.ts`) sets no global headers, and `playEventTracker.ts`'s `.update()` call doesn't attach one either (`x-visitor-id` is only ever read server-side, inside the `ai-deadhead` edge function). So even a successful anonymous insert can never be finalized — it would sit stuck as `ended_reason: 'in_progress'`, `duration_played_ms: 0` forever, which is functionally as useless as no row at all.

Net effect: **anonymous play behavior on `/setlist/:id` — the single most important signal for "did the Instagram cohort actually listen" — is currently unmeasurable for everyone except admins.** This is bug #1 on the instrumentation checklist below, ranked ahead of anything cosmetic.

Two secondary, unverifiable-remotely confounds layer on top and should stay attached to any future read of this data:
- Meta's in-app browser webview (referrer classified "facebook" via the `l.facebook.com` wrapper) has its own autoplay/media quirks; can't rule out plays that were attempted and silently failed to start.
- Jay's own session shows a cascade of `error`-ended play events from a same-evening FLAC→MP3 URL migration; if that migration affected the precomputed playability/URLs for these three specific setlists mid-window, a cold visitor's tap-to-play could plausibly have errored (`AudioPlayerContext.tsx:485-489` does surface a `toast.error("Couldn't find audio for this song")` on resolution failure — which *would* have been visible in a webview, this isn't a native-permission thing, just unverified whether it fired for this cohort).

## Landing-page evaluation: `/setlist/:id` for a cold Instagram visitor

Read through `src/pages/SetlistPoster.tsx` end to end as a landing page (hook → listen friction → next-step affordances → signup ask timing). Jay is right to be concerned, but not for a stylistic reason — the parchment/J-card treatment is on-brand and not the problem. The problem is what's *available to tap* and *when the ask arrives*.

**What a cold visitor actually sees, top to bottom:**
1. Fixed header: Back/Home, a **"Play All" pill (always visible, one tap, no scroll)**, an optional "X/Y on tape" badge, Share dropdown. This part is good — the single lowest-friction "hear it now" action is immediately reachable.
2. The J-card: "Grateful Dead" small-caps, hand-lettered setlist title, "curated by [name] · [era]", date. Purely decorative/context — no explanation of what Dead Set *is*, no tagline, no "join us" framing anywhere in this block. A visitor with zero prior context (a friend-of-a-friend forwarded the IG post) gets no orientation beyond "here is a Grateful Dead setlist."
3. The song list itself (tap-to-play per row, hover-only version info on desktop — irrelevant on mobile).
4. Optional liner-notes description.
5. **Bottom flap:** Upvote button, Save/Heart button, *then* — only if `!user` — the single anonymous-facing conversion CTA: **"Build your own dream show →"**. Then play count, footer branding.
6. Comments section (post box requires sign-in; the sign-in link is a plain `<a href="/auth">`, not a router `Link`, so it's a hard page reload rather than an SPA transition — minor, but inconsistent with the rest of the app).
7. Report-this-setlist link, Show Plate block with its own "Share Plate" button.

**Concrete design findings (validating Jay's concern with specifics):**

- **The only anonymous-friendly next-step CTA is scroll-gated behind the entire setlist + two dead-end buttons.** "Build your own dream show →" is real, on-brand, and — per `Builder.tsx` — genuinely leads into the anonymous-draft flow (guest state cached in `sessionStorage`, no auth wall), which is exactly the funnel Jay wants to prove out. But it's not visible without scrolling past everything else, and it is **not instrumented**: `HeroSection.tsx`'s equivalent landing-page CTA calls `trackCtaClick("hero_build_setlist_guest", ...)` into `share_events`; the poster-page CTA (`SetlistPoster.tsx:979-986`) is a bare `onClick={() => navigate("/builder")}` with no tracking call at all. We could not measure clicks on this button tonight even with full PostHog access.
- **The two affordances a visitor's thumb is most likely to land on — Upvote and the song/setlist Heart — are both hard auth walls with no continuity.** Both do `toast.error(...); navigate("/auth")` with no `?redirect=` param and no draft/guest fallback (unlike Builder's anon mode). `Auth.tsx` supports an explicit `redirect` search param and `getPostAuthRedirect()` would otherwise send a fresh signup to `/builder?wizard=true` — but since the poster page never passes `redirect`, even a visitor who *does* complete signup from here lands in the builder, not back on the setlist they wanted to upvote/save. This is a real, verified gap, though — note — it wasn't actually exercised by this cohort, since `page_visits` shows nobody clicked either button.
- **No above-the-fold "what is this / who's behind it" hook.** Every piece of orientation copy (tagline, community framing) that exists elsewhere in the app (landing hero) is absent from this surface. For a cold friend-of-a-friend visitor this matters more than for the founding-40, who already know the app.

**Where I'd push back on "the design is the problem":** the poster-as-artifact concept itself is working as designed — 6 of 12 visitors held presence for minutes, which is a *good* dwell signal for a static, non-interactive-feeling page and suggests the content (a real, well-formed setlist) is landing fine as a shareable object. The failure mode isn't "ugly" or "confusing," it's "no reachable middle step between look-at-this and full-signup" — nothing anonymous-friendly and low-commitment sits between "stare at the poster" and "create an account."

## Share-loop status (standing priority #2)

Unmoved by this post in the way that matters: the loop is **share → cold view → ??? → nothing comes back**. This is the first real IG-referred traffic in the last 30 days (prior 30-day `page_visits` showed zero instagram-referred views; lifetime instagram attribution before tonight was 14 visitors / 2 signups per the 2026-08-08 report). Tonight's cohort added ~12 more cold views and, on current evidence, zero re-shares, zero signups, zero auth prompts. The loop is not converting, and — critically — we still can't see the one behavior (listening) most likely to correlate with intent to convert, because of the play-tracking bugs above.

## Landing → builder status (standing priority #1)

The anonymous-draft builder itself looks structurally sound from a read of `Builder.tsx` (guest state cached in `sessionStorage`, no auth wall to start building). But the one on-ramp to it from this specific high-value surface (`/setlist/:id`) is unmeasured (no `trackCtaClick`) and scroll-buried. We cannot currently say whether anonymous draft mode is "moving the number" for share-loop traffic specifically, because the traffic that would prove it (tonight's cohort) never reached the CTA in an instrumented way, and possibly never reached it by scrolling at all.

## This week's experiment

**Hypothesis:** The Instagram/share-loop cohort isn't converting because the only anonymous-friendly next step ("Build your own dream show →") is invisible without a long scroll and untracked — not because the poster page's content or aesthetic is off-putting.

**Change:** Duplicate the existing signed-out CTA ("Build your own dream show →", same copy, same destination/anon-draft behavior) into the fixed header area next to "Play All," visible without scrolling, for `!user` sessions only. Add `trackCtaClick("poster_build_setlist_guest", "/builder")` to *both* the header copy and the existing bottom-flap copy (so we can tell which position wins). Do not touch anything else on the page this round — one change, isolated.

**Measured by:** `share_events` rows with `share_type='cta_click'` and `channel` in (`poster_build_setlist_guest_header`, `poster_build_setlist_guest_bottom`) — reuse the existing table, no migration needed — cross-referenced with `page_visits` on `/builder` where the referring path is `/setlist/:id`, and `draft_setlists` creation in the following session.

**Threshold:** At ~12 visitors/post scale this is not a statistically powered test — treat it as an existence proof, not a significance test. Ship it as a permanent instrumentation + placement fix (not a flagged A/B) and re-evaluate after the *next* two Instagram posts (~20-30 cohort visitors combined). Call it a win if **any** anonymous visitor from a future IG cohort reaches `/builder` from the poster page (currently unmeasured/zero) and a **flat or better** dwell/lingering rate on the poster itself (don't regress the one thing that's currently working — people are willing to stay and look).

**Status of last week's experiment:** N/A — last week's report (`2026-08-08-signup-attribution.md`) was also an ad-hoc PostHog-outage pass with no standing experiment in flight; the standard weekly WoW funnel review (and any prior queued experiment) should resume once PostHog access is restored.

## Instrumentation fixes required before the next Instagram post

1. **Anonymous play tracking (top priority, root-caused above).** Two independent fixes needed in the same migration:
   - Add a `SELECT` RLS policy on `play_events` for the row owner (mirror the existing anon `UPDATE` policy's `visitor_id = x-visitor-id header` check, plus `auth.uid() = user_id` for signed-in non-admins) so `startPlayEvent`'s `.select().single()` can see its own insert.
   - Either send an `x-visitor-id` header globally from the client (matching what the anon `UPDATE` policy already expects), or change the `UPDATE` policy to match on `visitor_id` from the row body instead of a header nobody sends. Either fix, not both, but pick one and make it consistent with `pausePlayEvent`/`resumePlayEvent`/`finalizePlayEvent`'s local-only accounting.
   - Once fixed, re-verify: an anonymous incognito session should produce a `play_events` row with `ended_reason` != `in_progress` after finishing/skipping a track.
2. **Instrument the poster-page "Build your own dream show →" CTA** with `trackCtaClick`, matching the landing hero's pattern (`hero_build_setlist_guest`) — currently silent, see above.
3. **Pass `redirect=` through to `/auth`** from the Upvote and Save/Heart sign-in prompts on `SetlistPoster.tsx` (and ideally from the comment-box sign-in link, which should also become a router `Link` rather than a hard `<a>` reload) so a visitor who does sign in from this surface lands back on the setlist, not in the builder/my-setlists. Not urgent for measurement, but will silently undercount "signup intent from poster" conversions once people do start clicking, and undermines the funnel if a future test tries to lift Upvote/Save click-through.
4. **Confirm the `ref=instagram-post` tag survives into `visitor_attribution`/`page_visits`** for this specific post (the 2026-08-08 report flagged the attribution self-pollution fix as merged-but-not-yet-published) — if it's not live yet, tonight's cohort may not be cleanly separable from other traffic in PostHog once access is restored.
5. **Re-run this same cohort read in PostHog once credentials are available**, specifically pulling `setlist_viewer_loaded` (already fires today, includes `referrer` and `auth_state` — `SetlistPoster.tsx:387-397`) to cross-check the Supabase `page_visits` count and get session-duration data PostHog captures natively that presence-channel dwell time only approximates.
