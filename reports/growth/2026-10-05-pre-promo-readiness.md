# Pre-promo instrumentation check — 2026-10-05 (cutoff 2026-10-05 00:06:08 UTC)

Not a weekly review. Four questions, answered from PostHog project 617063 with the shared external filter
(host in dead-set.org/www, NOT IN COHORT 579554, NOT $virt_is_bot).

## 1. Are the events arriving? YES. Not the silent no-op.
Production host www.dead-set.org has emitted version_picker_viewed (3), version_picker_played_debut (9),
version_picker_guide_saved (1), songbook_entry_contributed (1) since 2026-10-04. So both VITE_PUBLIC_POSTHOG_*
vars are set in the published build. EVERY prod-host picker event belongs to one person (97de5146...), who is in
the Internal / Test users cohort (Jay). Externally: 0 picker events, 0 /versions/ pageviews, 0 landing_song_chosen.
That is "no external visitor has reached it yet", not "capture is broken".
- version_picker_shared: prod 0. Only seen on dead-set-bench.netlify.app (a test harness using the real token). Never verified on prod.
- version_picker_instagram: has never fired anywhere (not in the taxonomy). Never verified.
- songbook_community_opened: caller exists (Songbook.tsx:254), zero events ever.
- dead-set-bench.netlify.app emitted 21 viewed + 1 shared (2 persons). Host filter excludes it; the cohort filter alone does not.

## 2. Baseline (external, cutoff 2026-10-05 00:06:08 UTC)
Daily external visitors (uniq person_id), any page / landing: 9-27 1/1, 9-28 1/1, 9-29 1/1, 9-30 2/1, 10-01 3/3, 10-02 1/1, 10-03 1/1, 10-04 2/2.
Since the front door shipped (10-04): picker viewed 0, played_debut 0, guide_saved 0, shared 0, builder_started 0, setlist_created 0.
Last 8 days: 0 external persons ever on /versions/*. Of the 10-04 two: one is the instagram.com mobile visitor
(20:12, bounced on /), one is a desktop visitor (19:29) with two pageviews in ~1s: probable crawler/prefetch, not bot-flagged.
Prior IG sessions (all single-pageview bounces on /): 10-01 02:04 (ref=instagram-bio&utm_source=instagram&utm_medium=social&utm_content=link_in_bio),
10-03 16:33 (l.instagram.com, no utm), 10-04 20:12 (instagram.com, no utm).
Cohort separation: sessions.$entry_current_url keeps the full query string (verified on the 10-01 session, so ref= is recoverable);
sessions.$entry_utm_source / $entry_referring_domain / $channel_type also work. ref= is NOT an event property; extract it with
extractURLParameter(s.$entry_current_url,'ref'). Use started >= cutoff to exclude the pre-promo IG sessions above.

## 3. Is viewed -> played_debut computable? Yes as a native funnel (verified), but the ratio is biased.
query-funnel ran with song_id/song_title present and a song_title breakdown. Defects in the measurement:
- viewed fires at VersionPicker.tsx:380, AFTER the versions fetch, the Charlie fallback and the song_features fetch: 10-13s after the pageview in all 3 observed sessions.
  A visitor who leaves in under ~10s never fires viewed. The denominator drops the fastest bouncers.
- played_debut is not gated on viewed: it fired 10s BEFORE viewed in the 18:18 session. An ordered funnel drops that play.
- played_debut fires only on the hero's debut-tape branch (L474). Hero fallback to topVersion (L446/L479), playMilestone, playVersion and playAll fire nothing.
  Any listener who plays a non-debut night, or hits a song with no debut tape, counts as did-not-play.
- audio_play_started is the broader play signal but carries song_title/show_date, no song_id and no origin.
Fix on the read side: denominator = $pageview where $pathname LIKE '/versions/%' (fires immediately; history_change capture verified), numerator =
uniq persons with played_debut OR audio_play_started on that path. Use uniq(person_id); one session pressed Play 9 times.

## 4. Other risks
- Promo URL is https://dead-set.org/?ref=...&utm_source=instagram (apex, lands on /). Funnel is /, landing_song_chosen, /versions/slug, viewed, played. All 3 prior IG visitors bounced on /.
  Whether apex dead-set.org redirects to www keeping the query string could not be checked from this sandbox (dead-set.org blocked).
- UtmCapture fires dispatch_link_landed for ANY utm_* link, so IG visits fire an event named for email dispatch (utm_source=instagram on it; usable as a landing marker, but do not count it as email).
- UtmCapture uses ph.register (persistent), so utm_source=instagram sticks to later events from that browser, including later organic visits. Attribute by session ($entry_utm_source), not by event property.
- In-app browser: IG webview is a separate storage context from Safari; a visitor who later reopens in Safari is a new person.
- $pageview on SPA route change works (/versions/friend-of-the-devil and /versions/althea logged immediately on lazy-route navigation).
- Referral spam: none seen from finday.com / recipebridge.com in this window.
