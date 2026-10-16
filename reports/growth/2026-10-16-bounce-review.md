# Growth Review — 2026-10-16 — "Are people bouncing quickly, and why?"

Ad hoc question from the site owner, not the weekly review. PostHog project 617063 (US cloud), read through the PostHog MCP.
Every number below uses the shared external filter from `supabase/functions/_shared/posthogQuery.ts`:
`$host IN ('dead-set.org','www.dead-set.org') AND person_id NOT IN COHORT 579554 AND NOT coalesce($virt_is_bot,false)`.
`page_visits` was not used. The governed metric catalog is empty (`metric-list` returned 0), so every figure is a one-off derivation, not a saved definition.

**Front-door review is 2026-10-18, two days from now. Nothing here grades the bet.** The window is tiny (about 43 usable sessions since the ship), the 2026-10-03 baseline in the release doc holds play/setlist counts from Supabase and no bounce or duration figure, so the only "before" available is PostHog 2026-09-20 to 2026-10-03.

## Bottom line

1. **Yes, about half of sessions are single-page, not the roughly 27% PostHog's own Web Analytics shows.** PostHog's number is wrong for this site by about 2x, because first-time visitors get a second pageview about half a second after the first (see "Measurement defect" below). Corrected, 53% (23 of 43) of post-ship sessions and 55% (17 of 31) of pre-ship sessions were single-page with no interaction. The two are indistinguishable at this n (95% interval roughly +/-15 points each).
2. **New visitors who land on `/` mostly leave without choosing a song.** Among non-repeat visitors since 10-04: 24 sessions entered on `/`, 2 chose a song (8%).
3. **I found no evidence that errors, chunk-load failures or broken audio are driving the bounce.** But the instrumentation cannot see the main suspects (clicks, scroll, audible playback, web vitals, replay are all off or never fired), so "no evidence" is weak, not exculpatory.

## Definitions (exact)

- **Session** = PostHog `$session_id`, filtered as above, with at least one `$pageview`. Sessions with zero pageviews are reported separately (15 since 10-04, 3 before; see below).
- **Bounce (primary)** = exactly one distinct page after collapsing a pageview that repeats the previous pageview's URL within 2 seconds, AND no interaction event. Interaction = any event outside the passive set (`$pageview`, `$pageleave`, `$conversations_loaded`, `$set`, `$identify`, `$exception`, `*_viewed`, `auth_wall_shown`, `dispatch_link_landed`, `audio_error`, `audio_autoplay_blocked`) and no play event. In this data every single-page session also had zero interaction, so "bounce = single page".
- **Raw single-pageview** and **PostHog `$is_bounce`** are shown for comparison; both are distorted (below).
- **Windows (UTC):** pre = 2026-09-20 00:00 to 2026-10-03 23:59 (14 days; capture began 09-18/19 and 09-20 had zero external events). post = 2026-10-04 00:00 to now (2026-10-16 ~21:30, 12.9 days). last14d = 2026-10-02 to now (includes 2 pre-ship days, 2 sessions). The exact publish time of the 10-04 front door was not verified (the `/admin` sync badge was not reachable from here).
- **Tiers:** T0 = shared filter only. T1 = T0 minus crawler-like sessions (datacenter cities Ashburn/Prineville/Lulea/Clonee/Forest City/Boardman/Gallatin; referrers finday.com, recipebridge.com, hulbee.com, oskope.com; the "Claude" browser) = my headline. T2 = T1 minus persons with 3 or more sessions in the window (a rough "new-ish visitors" cut, not a true new-vs-returning split).
- **Duration** = first to last filtered event in the session (includes `$pageleave`). It is **understated** whenever no `$pageleave` fired, which is common on iOS (below).

## 1. How much bouncing

| Tier / window | Sessions (persons) | Bounce, corrected | Raw single-pv | PostHog `$is_bounce` | Dur p50 | Dur p75 | <10s | <30s | Pages/session mean (median) |
|---|---|---|---|---|---|---|---|---|---|
| T1 pre (09-20..10-03) | 31 (20) | **17/31 = 55%** | 9/31 = 29% | n/a | 7s | 195s | 52% | 58% | 2.42 (1) |
| T1 post (10-04..now) | 43 (35) | **23/43 = 53%** | 13/43 = 30% | n/a | 7s | 143s | 51% | 67% | 3.42 (1) |
| T1 last14d (10-02..now) | 45 (37) | **25/45 = 56%** | 15/45 = 33% | n/a | 5s | 119s | 53% | 69% | 3.31 (1) |
| T0 pre | 36 (25) | 20/36 = 56% | 10/36 = 28% | 8/36 = 22% | 9s | 145s | 50% | 61% | 2.28 dedup / 2.89 raw |
| T0 post | 48 (40) | 28/48 = 58% | 17/48 = 35% | 13/48 = 27% | 9s | 82s | 50% | 65% | 3.17 dedup / 3.71 raw |
| T2 pre (non-repeat) | 20 (18) | 13/20 = 65% | 5/20 = 25% | n/a | 3s | 40s | 65% | 75% | 1.85 (1) |
| T2 post | 33 (32) | 20/33 = 61% | 10/33 = 30% | n/a | 5s | 24s | 58% | 79% | 1.85 (1) |
| T2 last14d | 35 (34) | 22/35 = 63% | 12/35 = 34% | n/a | 4s | 22s | 60% | 80% | 1.80 (1) |

Reading it:
- **Pre vs post is flat.** 55% vs 53% is well inside noise at n=31 and n=43. The honest statement is "no detectable change".
- **The means are not representative.** The pages/session mean rises from 2.4 to 3.4 because a handful of long sessions (single sessions with 21 and 27 pageviews) swing it; the median is 1 in every window.
- **Duration percentiles are fragile.** p75 collapses when repeat visitors are removed (143s to 24s), meaning the long-tail comes from a few repeat users. The typical new visitor's session is 4 to 5 seconds at the median.
- **Duration is unmeasurable for most iOS bounces.** Of the 23 post-ship bounced sessions only 9 have a trustworthy dwell time (a `$pageleave` of 1s or more). The 9: 1.5, 3.9, 4.2, 4.5, 5.0, 7.4, 11.5, 15.3, 23.8 seconds (median 5.0; 6 of 9 under 10s). Of the 14 iOS bounces, only 4 have one. So the "<10s" column is a mix of real fast exits and sessions whose end we never saw.
- **First-ever vs seen-before (T1, corrected bounce):** first-ever sessions 20/34 = 59% post, 12/19 = 63% pre; seen-before 3/9 = 33% post, 5/12 = 42% pre.

### Measurement defect: first-time visitors are double-counted

Raw events show the landing page firing two `$pageview`s on the same URL 0.002 to 0.9 seconds apart, with a `$pageleave` of 0.4 to 0.6s between them (e.g. sessions `01a11d64-13f8...`, `01a13ba4-25d6...`, `01a1469d-ed5c...`). Of 48 first-ever home-entry sessions (T0), **34 (71%) have the duplicate; of 13 returning-person sessions, 1 (8%).** That fits a reload on first visit, and the code says exactly that:
- `public/sw.js` calls `self.skipWaiting()` and `self.clients.claim()`.
- `index.html` (lines ~82-88) runs `window.location.reload()` on `controllerchange`.
On a first install the page had no controller, the worker claims it, `controllerchange` fires, and the page reloads about a second after first paint. This is a code-reading hypothesis matched to the event pattern; I did not observe it in a browser (live site is blocked from this sandbox).
Consequences: (a) PostHog's built-in bounce (22% pre, 27% post, same sessions) understates single-page sessions by about half; (b) pages/session is inflated for new visitors; (c) new visitors, the people this experiment is about, may see a visible reload during the first second. Whether that costs anyone is unknown and untestable at this n.

### Traffic that is not people (excluded from T1, listed so it is not counted as acquisition)

- **Facebook crawlers, 10 sessions (7 with no pageview).** Referrer m.facebook.com / www.facebook.com, data-centre cities (Lulea SE, Clonee IE, Prineville, Forest City, Boardman, Gallatin), Android 10 "K" Chrome/154 user agent, three arriving within one second at 2026-10-04 07:13:47, and a fixed 39 to 41s dwell. The 10-04 burst follows a `setlist_shared` event from an owner-side iPhone session at 07:11:37. This looks like link-preview fetching, not readers, and PostHog's bot flag missed all of it. I saw **zero** identifiable human Facebook visits.
- **Spam/datacenter sessions, 7 (5 pre, 2 post)**: finday.com, recipebridge.com, hulbee.com, oskope.com, Ashburn desktop hits, and one "Claude" browser session.
- **Sessions with no pageview: 15 post, 3 pre.** Besides the 7 Facebook crawlers, these are same-site "self-referral" starts (3), `/messages` or `/setlist` opens at 0s with only a `$pageleave` (4, likely email/DM clicks), and one 8s direct. Excluded from every denominator above. They are a separate small instrumentation question (a `$pageleave` with no `$pageview` in the same session id).
- **Repeat/insider concentration.** Since 10-04, 10 of 43 T1 sessions come from persons with 3 or more sessions (a few Bay Area and Portland devices that do most of the playing and building). No filtered person visited `/admin`, so the cohort is catching the owner's admin sessions, but a handful of repeat users are plainly testers or beta members and dominate plays.

## 2. Where bouncers enter (T1, corrected bounce)

Every cell below is tiny. Treat anything under n=10 as an anecdote.

**By entry path**

| Entry | pre n (bounced) | post n (bounced) | last14d n (bounced) |
|---|---|---|---|
| `/` | 26 (15) 58% | 28 (14) 50% | 30 (16) 53% |
| `/versions/:slug` | 0 | 2 (1) | 2 (1) |
| `/songbook/:slug` | 2 (1) | 1 (0) | 1 (0) |
| `/songbook` (index) | 0 | 1 (1) | 1 (1) |
| `/setlist/:id` | 2 (1) | 3 (3) | 3 (3) |
| `/song/...` | 0 | 0 | 0 |
| other (`/messages`, `/auth`, `/about`, `/updates`...) | 1 (0) | 8 (4) | 8 (4) |

`/` is 28 of 43 post-ship sessions and carries half the bounces. **Only 2 external sessions have entered on `/versions/:slug` in 12 days**, so the new route's own bounce is unreadable, and the share loop has produced almost nothing to measure: 3 `/setlist/:id` arrivals (all single-page: one from l.instagram.com, one from an iOS Safari direct tap at 5s, one from a repeat desktop visitor).

**By source** (cannot separate iMessage/friend shares from direct: iMessage sends no referrer, so "direct" includes shared links)

| Source | post n (bounced) | last14d n (bounced) |
|---|---|---|
| direct | 29 (13) 45% | 30 (14) 47% |
| Instagram (l.instagram.com / instagram.com) | 4 (3) | 5 (4) 80% |
| Google search / Google app | 6 (3) 50% | 6 (3) 50% |
| same-site self-referral | 4 (4) | 4 (4) |
| Facebook | 0 human | 0 human |
| SMS link (messages.google.com) | 0 usable | 0 usable |

**By device**

| Device | pre n (bounced) | post n (bounced) | last14d n (bounced) |
|---|---|---|---|
| iOS Safari | 20 (10) 50% | 14 (9) 64% | 15 (10) 67% |
| iOS other browser (Chrome/Firefox iOS) | 3 (3) | 8 (5) 62% | 8 (5) |
| Android / other mobile | 1 (0) | 4 (1) | 4 (1) |
| Desktop | 7 (4) 57% | 17 (8) 47% | 18 (9) 50% |
| Mobile + tablet combined | 24 (13) 54% | 26 (15) 58% | 27 (16) 59% |

iOS Safari moved from 50% to 64%, but that is 10 of 20 versus 9 of 14; not a finding. Mobile is the majority of sessions (26 of 43 post-ship) and bounces slightly more than desktop (59% vs 50%), also not distinguishable at this n.

## 3. Why are they leaving — the evidence

**Press play before leaving?** By construction bounced sessions have none. Beyond them: of 33 non-repeat post-ship sessions, 2 had any play (6%; pre 2 of 20, 10%). Front-door steps among **non-repeat** visitors since 10-04: 24 `/` entries, 2 chose a song, 3 sessions reached the picker, 1 played from the picker, 1 played the Songbook spotlight card. Including repeat visitors, 6 sessions reached the picker and 2 played from it. The two non-internal visitors that reached `/versions/estimated-prophet` (a 5-minute iPhone session and an 11-second one) viewed the picker and did not press play: the "looked, did not listen" shape named in the release doc's outcome 2, on n=2. The one clear success is a Google-search visitor on Chrome iOS on 10-16 who chose Ramble On Rose and pressed play 7 times in the picker. n is far too small to say which way the experiment is going.

**Tap with no sound?** Zero `audio_error` and zero `audio_autoplay_blocked` events in any filtered session since 10-04. Before it: one `audio_autoplay_blocked` (iPhone, 09-24) and two `audio_error` format failures in one long desktop session (09-22). But that absence cannot clear the failure shape: **`audio_play_started` fires on the tap, and nothing records that sound actually began** (no playing/timeupdate event). A silent tap is invisible in this data.

**`$exception`:** none of the target errors. A search of all exception events since capture began for `MIME`, `dynamically imported`, `ChunkLoad`, `Importing a module script failed`, `text/html`, `Unexpected token` found 1 hit, on a non-production host on 2026-10-03; **0 on dead-set.org**. What does fire in external sessions:
- `TypeError: Script https://www.dead-set.org/sw.js load failed`, iOS only (Safari, Chrome iOS, Firefox iOS), 7 of 22 post-ship and 7 of 23 pre-ship iOS sessions. Bounce with it: 3/7 pre and 4/7 post; without it: 9/15 pre and 10/14 post. Not associated with bouncing. Still worth a look on its own: the service worker is failing to register for roughly a third of iOS visitors, and desktop Chrome sees "Failed to update a ServiceWorker ... unknown error fetching the script" (owner sessions on `/admin`). I could not fetch `/sw.js` headers (network policy blocks the site), so I cannot say why.
- `cannot add presence callbacks for realtime:online_visitors after subscribe()` (a Supabase realtime presence channel being re-subscribed): mostly owner sessions, 3 external sessions (`/builder`, `/auth`), non-blocking.
- `Script error.` (cross-origin opaque), Firefox iOS and Safari, a few sessions.
No exception was a render-blocking crash in a bounced session.

**Rage and dead clicks:** not collected. `src/lib/posthog.ts` sets `autocapture: false` and `capture_dead_clicks: false`; `$autocapture`, `$rageclick` and `$dead_click` have never been seen. There is no click data on any element.

**Web vitals:** not collected. `$web_vitals` has never been seen and `sessions.$vitals_lcp` is empty for all filtered sessions (project setting `autocapture_web_vitals_opt_in` is null). No LCP/INP/CLS for any entry page.

**Session recordings:** none usable. `disable_session_recording: true` in the SDK. The project holds exactly one recording (2026-09-19, 53 seconds, before the window), so I watched nothing and describe nothing. The 5 to 10 bounced-session summaries asked for cannot be produced from this data.

**Scroll/dwell (partial):** where a trustworthy `$pageleave` exists, most bounced visitors left within about 5 seconds; scroll depth is mostly near zero on `/` but mixes in short pages (`/auth`, `/messages`), so I do not rely on it.

**Are events flowing? Yes.** Capture is not the silent env-var no-op. `www.dead-set.org` emitted 3,054 events since 09-18 and events arrive on every day from 09-19 to 10-16. About 2,250 of those belong to the internal cohort; external traffic is thin by nature (0 to 13 external persons a day; 10-12 had zero). The apex `dead-set.org` never appears as a host, so all traffic is on `www`. Volume is low but plausible for a ~40-member beta, not implausibly low for a broken init. (Related cleanup: `version_picker_viewed` fires 10 to 13 seconds after the pageview per the 10-05 report, so view-based denominators drop the fastest bouncers; use `$pageview` on `/versions/%` instead.)

## 4. Most likely causes, ranked

1. **The headline bounce figure is mismeasured, and the real figure is high (about 55%) and unchanged since the front-door change. Confidence: high on the measurement (71% vs 8% duplicate rate by first-visit status; code path found), medium on the level.** Evidence: raw event pairs, the `controllerchange` reload in `index.html`, the `skipWaiting`/`clients.claim` in `public/sw.js`, built-in bounce 27% versus corrected 53% on the same sessions. Missing to confirm: a browser trace of a first visit showing the reload (Jay or a gate with site access), and the same count after the reload is limited to updates.
2. **New visitors who land on `/` do not choose a song, and most gone within about 5 seconds. Confidence: low to medium.** Evidence: 2 of 24 non-repeat home entries chose a song; corrected bounce on first-ever sessions 59% post vs 63% pre; measurable dwell for bounced sessions has median 5s (n=9); Instagram arrivals 4 of 5 single-page (n=5, in-app browser); no `landing_song_chosen` outside a few repeat or search visitors. This says people leave at the front door; it does not say why (first-screen message, load feel, the reload flash, or simply low-intent traffic: crawlers, spam and friends tapping through a shared link). Missing to confirm: scroll or first-screen interaction events on `/`, web vitals, replay, and a bigger sample.

Not supported by the data: deploy-orphaned chunk errors (0 on production), exceptions (no uplift in bounce), a play failure (no audio errors post-ship; but unobservable), the old A/B wizard redirect (Index.tsx still contains a `landing_vs_autostart` redirect to `/builder?wizard=true` for brand-new visitors, but no external session shows it firing within seconds of landing; the wizard pageviews came well into repeat users' sessions).

## Share loop status

Almost no data. 3 external `/setlist/:id` arrivals since 10-04, all single-page. `setlist_shared` has 3 external-filtered events all-time and `version_picker_shared` 0. Link previews are still generic per the release doc's known gaps, and the Facebook crawler hits show the preview fetcher is the main thing arriving from at least one share. No conclusion possible.

## Landing -> builder status

Not assessable from bounce data. Since 10-04, builder-or-CTA events (`landing_cta_clicked`, `landing_songbook_link`, `guest_builder_started`) occurred in 1 of 33 non-repeat sessions and 4 of 10 repeat sessions. Anonymous draft mode is firing `guest_builder_started` (5 persons all-time, 3 external sessions) and `guest_song_added` once. The front door now routes new visitors to the picker rather than the builder, which the release doc lists as the guardrail to watch on 10-18.

## This week's experiment

**Status of last week's experiment:** the 2026-09-29 experiment (instrument the landing CTA and guest-builder events) shipped; `landing_cta_clicked` now reaches production (28 events all-time, 3 external) and `guest_builder_started` too. Its threshold (2 weeks or 30 real landing visitors) is borderline met (24 non-repeat home entries post-ship), but the front door it measured has since been replaced, so I am not applying it. Carry forward as "instrumented, superseded by the song-first door".

**Hypothesis:** new visitors are being double-counted and, at the moment of first impression, reloaded: a first-visit service-worker install reloads the page about 0.5 to 1s after first paint. Fixing it makes every new-visitor number trustworthy and may remove a visible flash from the first second.

**Change (one):** in the `controllerchange` handler in `index.html`, reload only when the page already had a controller (a worker update), not on first install. Handed to Jay or a build session; I do not edit app code. It touches service-worker lifecycle, so it should go through `/pre-release` and be verified on iOS Safari and Chrome.

**Measured by:** share of first-ever home-entry sessions with a same-URL pageview repeat within 2s (query in this report; today 34/48 = 71%), then corrected bounce and `landing_song_chosen` rate on first-ever sessions. No new events needed.

**Threshold:** mechanical check after 15 or more first-ever home-entry sessions: duplicate share under 15% confirms the cause and the fix; above 40% means the reload is not the only source and the hypothesis is wrong. Do not draw a conclusion about bounce or play-rate effect from this: at about 34 first-ever sessions per 12 days a detectable change needs several months of traffic. After the fix, corrected bounce for first-ever sessions becomes the baseline to read future copy and layout changes against.

## Data that would settle the open questions (all currently off or absent)

None of these is done here. Each is Jay's call, and replay and autocapture have a privacy-policy question attached (see the comment in `src/lib/posthog.ts`).
- Web vitals (project setting `autocapture_web_vitals_opt_in`) for LCP/INP/CLS by entry page.
- A first-screen interaction or scroll-milestone event on `/` and `/versions/:slug`.
- A "sound actually started" audio event, to make tap-without-sound visible.
- A sampled, short-session recording of `/` bounces, once the privacy policy covers it.
- `$pageleave` is unreliable on iOS; an explicit `visibilitychange` heartbeat would make duration measurable there.
- A bot rule for Meta link-preview fetches (data-centre cities, 39 to 41s dwell, Android 10 "K" Chrome user agent) so they stop counting as visitors.

## Caveats

- Sample sizes are 20 to 50 sessions per window and 1 to 30 in every breakdown cell; 95% intervals on the headline rates are about +/-15 points. Pre vs post differences are not significant.
- T1 and T2 exclusions are my heuristics (city list, referrer list, repeat-visitor cut) and not part of the shared filter; T0 numbers are given alongside for that reason.
- "First-ever session" means first seen in PostHog since 2026-09-18; a visitor with cleared storage or a new in-app browser context looks new.
- Duration and dwell are understated or unknown where no `$pageleave` fired, mainly iOS.
- The release doc's baseline (780 plays, 242 setlists, etc.) is Supabase data and contains no bounce metric, so no bounce baseline from 2026-10-03 exists beyond PostHog's 09-20 to 10-03 window.
- Releases inside the post window overlap: the 10-04 front door, 10-06 publish (play above the fold, share copy), 10-08 home Songbook card, 10-09 player bar message. Deploy times were not checked, so no clean before/after for any single one.
- The live site could not be reached from this sandbox, so the reload hypothesis and the sw.js failure are unobserved in a browser.
