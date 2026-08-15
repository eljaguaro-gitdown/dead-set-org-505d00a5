-- =============================================================================
-- 90_data_quality_audit.sql — the evidence behind every exclusion, plus standing
-- contamination monitors
-- =============================================================================
--
-- HOW TO RUN
-- ----------
-- Paste into the Supabase SQL editor and run. All SELECTs; creates nothing.
-- Run this BEFORE trusting a funnel number, and again whenever a number moves
-- surprisingly — most surprises in this dataset have turned out to be
-- contamination, not behaviour.
--
-- Reporting timezone: UTC.
--
--
-- WHY THIS FILE EXISTS
-- --------------------
-- There is precedent. Dispatch 003 (2026-08-13) went to 59 recipients, 3 of them
-- QA test addresses, which pushed the bounce rate to 5.08% and tripped the ESP's
-- 5% advisory. The fix was migration 20260814030000_dispatch_recipients_hygiene.sql,
-- filtering qa-verify-%, %@example.com, %.test and friends out of
-- dispatch_recipients. The SAME contamination class is present in the event
-- tables, so the funnel queries reuse the SAME patterns. Query A confirms it.
--
-- Findings as of 2026-08-15 are recorded inline with each query so drift is
-- visible: if a re-run disagrees with the recorded number, something changed.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- QUERY A: QA/test and internal accounts, and how much of the dataset they own.
--
-- Recorded 2026-08-15: 3 QA accounts (the exact 3 from the dispatch incident),
-- between them 8 setlists, 0 plays, 0 shares. Plus the founder's account:
-- 129 setlists (57.6% of all), 463 play_events (98.1%), 100 real shares (86%),
-- 30 distinct visitor_ids.
-- Account arithmetic: 51 auth.users total -> 48 after removing the 3 QA
-- accounts -> 47 community users after also removing the founder.
-- -----------------------------------------------------------------------------
SELECT
  u.email,
  CASE
    WHEN u.email ILIKE '%.test' OR u.email ILIKE '%.example' OR u.email ILIKE '%.invalid'
      OR u.email ILIKE '%@example.com' OR u.email ILIKE '%@example.org' OR u.email ILIKE '%@example.net'
      OR u.email ILIKE 'qa-verify-%' OR u.email ILIKE 'test\_%@dead-set.org' ESCAPE '\'
      OR u.email ILIKE '%@dead-set-org-qa.test'                      THEN 'qa_test_address'
    WHEN lower(u.email) IN ('eljaguaro@gmail.com')                   THEN 'internal_founder'
    ELSE 'real_user'
  END                                                                 AS classification,
  u.created_at,
  u.email_confirmed_at IS NOT NULL                                    AS confirmed,
  (SELECT count(*) FROM public.visitor_attribution va WHERE va.user_id = u.id)  AS visitor_ids,
  (SELECT count(*) FROM public.setlists s        WHERE s.creator_id = u.id)     AS setlists,
  (SELECT count(*) FROM public.play_events pe    WHERE pe.user_id = u.id)       AS plays,
  (SELECT count(*) FROM public.share_events se
     WHERE se.user_id = u.id AND se.share_type <> 'cta_click')                  AS real_shares
FROM auth.users u
WHERE u.email ILIKE '%.test' OR u.email ILIKE '%.example' OR u.email ILIKE '%.invalid'
   OR u.email ILIKE '%@example.com' OR u.email ILIKE '%@example.org' OR u.email ILIKE '%@example.net'
   OR u.email ILIKE 'qa-verify-%' OR u.email ILIKE 'test\_%@dead-set.org' ESCAPE '\'
   OR u.email ILIKE '%@dead-set-org-qa.test'
   OR lower(u.email) IN ('eljaguaro@gmail.com')
ORDER BY setlists DESC;


-- -----------------------------------------------------------------------------
-- QUERY B: bot / non-production traffic in page_visits.
--
-- Recorded 2026-08-15, as classified by this query (percentages of all visits):
--   human             4994 visits / 1750 visitor_ids   88.39%
--   lovable_preview    341 visits /   43 visitor_ids    6.04%
--   headless_browser   122 visits /   76 visitor_ids    2.16%   CI + Playwright
--   declared_crawler    96 visits /   82 visitor_ids    1.70%
--   local_dev           90 visits /    4 visitor_ids    1.59%
--   netlify_staging      4 visits /    2 visitor_ids    0.07%
--   scanner_path         3 visits /    2 visitor_ids    0.05%
-- => 11.6% of raw page_visits is not a real visitor. The single biggest chunk
--    is NOT crawlers, it is the Lovable preview iframe — builders watching
--    their own app. That is why bot_visitors filters on origin as well as UA.
--
-- Named crawlers seen: bingbot, Googlebot (desktop + the Nexus-5X smartphone
-- UA, which only reveals itself past 110 chars), Baiduspider,
-- meta-externalagent, HubSpot, Dataprovider.com, WCAGRepairBot.
--
-- The regex is deliberately tight. A looser one adding preview|monitor|uptime|
-- curl|wget|axios|python-requests|lighthouse|selenium|puppeteer|playwright was
-- tested against all 5644 rows and matched ZERO extra visits — every hit already
-- came from a strong token. Loose tokens buy no recall and risk false positives.
-- -----------------------------------------------------------------------------
SELECT
  CASE
    WHEN user_agent IS NULL OR user_agent = ''                       THEN 'missing_user_agent'
    WHEN user_agent ~* 'headless'                                    THEN 'headless_browser'
    WHEN user_agent ~* '(bot|crawl|spider|slurp|bytespider|facebookexternalhit|meta-externalagent|dataprovider|wcagrepair|bilateralnavigator)'
                                                                     THEN 'declared_crawler'
    WHEN landing_source = 'localhost' OR referrer ILIKE '%localhost%' THEN 'local_dev'
    WHEN landing_source ILIKE '%lovableproject.com'                  THEN 'lovable_preview'
    WHEN landing_source ILIKE '%netlify.app'                         THEN 'netlify_staging'
    WHEN page_path ILIKE '%/supabase/functions/%' OR page_path ILIKE '%.php'
      OR page_path ILIKE '%wp-%'                                     THEN 'scanner_path'
    ELSE 'human'
  END                                            AS traffic_class,
  count(*)                                       AS visits,
  count(DISTINCT visitor_id)                     AS visitor_ids,
  round(100.0 * count(*) / sum(count(*)) OVER (), 2) AS pct_of_visits,
  min(created_at)                                AS first_seen,
  max(created_at)                                AS last_seen
FROM public.page_visits
GROUP BY 1
ORDER BY visits DESC;


-- -----------------------------------------------------------------------------
-- QUERY C: identity-stitching health. Run this to confirm the resolution layer's
-- assumptions still hold before trusting a funnel.
--
-- Recorded 2026-08-15: ~860 attribution rows, 0 duplicate visitor_ids, 0
-- visitors mapping to more than one user, 0 null visitor_ids. 69 signed-up
-- visitor rows collapse to 30 distinct users (2.3 browsers per person on
-- average, 30 for the founder). Attribution covers ~860 of ~1911 page_visits
-- visitor_ids — that gap is chronological, not broken: visitor_attribution
-- starts 2026-04-24 and page_visits starts 2026-03-26. (Row counts drift
-- upward between runs; the zero-checks are the part that must not move.)
--
-- The last two rows are founder-EXCLUDED, so they read 47 community users of
-- whom 27 predate the attribution epoch. Counting the founder in, that is
-- 48 and 28 — which is the framing used in 00_actor_resolution.sql.
-- 1 unattributable share_event row (neither user_id nor visitor_id) is known
-- and permanently unassignable; it is dropped by every query here.
--
-- ANY NON-ZERO in the first three "must be zero" rows breaks the funnel joins
-- (fan-out or ambiguous identity) and must be investigated before reporting.
-- -----------------------------------------------------------------------------
SELECT 'MUST BE ZERO: duplicate visitor_id rows in visitor_attribution' AS check_name,
       (SELECT count(*) FROM (SELECT visitor_id FROM public.visitor_attribution
                              GROUP BY 1 HAVING count(*) > 1) d)::text   AS value
UNION ALL
SELECT 'MUST BE ZERO: visitor_ids mapping to >1 user_id',
       (SELECT count(*) FROM (SELECT visitor_id FROM public.visitor_attribution
                              WHERE user_id IS NOT NULL
                              GROUP BY 1 HAVING count(DISTINCT user_id) > 1) d)::text
UNION ALL
SELECT 'MUST BE ZERO: null visitor_id in page_visits',
       (SELECT count(*) FROM public.page_visits WHERE visitor_id IS NULL)::text
UNION ALL
SELECT 'unattributable share_events (no user_id AND no visitor_id)',
       (SELECT count(*) FROM public.share_events WHERE user_id IS NULL AND visitor_id IS NULL)::text
UNION ALL
SELECT 'distinct visitor_ids in page_visits',
       (SELECT count(DISTINCT visitor_id) FROM public.page_visits)::text
UNION ALL
SELECT '  ...of which have an attribution row',
       (SELECT count(*) FROM public.visitor_attribution)::text
UNION ALL
SELECT 'signed-up visitor rows',
       (SELECT count(*) FROM public.visitor_attribution WHERE user_id IS NOT NULL)::text
UNION ALL
SELECT '  ...collapsing to distinct users (the dedupe payoff)',
       (SELECT count(DISTINCT user_id) FROM public.visitor_attribution WHERE user_id IS NOT NULL)::text
UNION ALL
SELECT 'max visitor_ids held by one user',
       (SELECT max(c) FROM (SELECT count(*) c FROM public.visitor_attribution
                            WHERE user_id IS NOT NULL GROUP BY user_id) d)::text
UNION ALL
SELECT 'play_events with user_id but NULL visitor_id (expected: nearly all)',
       (SELECT count(*) FROM public.play_events WHERE user_id IS NOT NULL AND visitor_id IS NULL)::text
UNION ALL
SELECT 'real users (auth.users minus QA and internal)',
       (SELECT count(*) FROM auth.users u
        WHERE NOT (u.email ILIKE 'qa-verify-%' OR u.email ILIKE '%@example.com'
                OR u.email ILIKE '%@dead-set-org-qa.test'
                OR u.email ILIKE 'test\_%@dead-set.org' ESCAPE '\'
                OR lower(u.email) IN ('eljaguaro@gmail.com')))::text
UNION ALL
SELECT '  ...who signed up before the attribution epoch (unlinkable to a visit)',
       (SELECT count(*) FROM auth.users u
        WHERE u.created_at < '2026-04-24'
          AND NOT (u.email ILIKE 'qa-verify-%' OR u.email ILIKE '%@example.com'
                OR u.email ILIKE '%@dead-set-org-qa.test'
                OR u.email ILIKE 'test\_%@dead-set.org' ESCAPE '\'
                OR lower(u.email) IN ('eljaguaro@gmail.com')))::text;


-- -----------------------------------------------------------------------------
-- QUERY D: event-table coverage and freshness. A table that stopped receiving
-- rows is the failure mode that produced this whole workstream — PostHog was
-- installed and never loaded in production, and nobody noticed for months.
--
-- Recorded 2026-08-15. Watch especially:
--   * ab_test_assignments last wrote 2026-07-14 — STALE for a month. Any A/B
--     readout is reporting on a test that is no longer assigning.
--   * wizard_events has 0 rows — the primary wizard surface was never
--     instrumented. Nothing in sql/funnels/ depends on it having data; the
--     resolution view in 00_ unions it in so steps appear automatically once
--     instrumentation ships.
--   * cosmic_charlie_history timestamps on generated_at, NOT created_at, unlike
--     every other table here. Querying created_at on it errors out.
--   * draft_setlists is EMPTY (0 rows) — rows carry expires_at and are reaped,
--     so anonymous in-progress work leaves no durable trace. Combined with the
--     fact that drafts are keyed by anon_session_id (localStorage
--     `ds_anon_session_id`) rather than ds_visitor_id, there is no way to
--     measure anonymous build-abandonment at all today. See "could not build"
--     in the handover notes.
--   * profiles (51 rows) lags auth.users — last profile row 2026-08-07 while
--     signups continue. Use auth.users as the signup authority, not profiles.
-- -----------------------------------------------------------------------------
SELECT 'page_visits' AS table_name, count(*) AS rows, min(created_at) AS first_row, max(created_at) AS last_row,
       (now() - max(created_at))::interval AS staleness FROM public.page_visits
UNION ALL SELECT 'visitor_attribution', count(*), min(first_seen_at), max(first_seen_at), (now() - max(first_seen_at)) FROM public.visitor_attribution
UNION ALL SELECT 'auth_events',    count(*), min(created_at), max(created_at), (now() - max(created_at)) FROM public.auth_events
UNION ALL SELECT 'share_events',   count(*), min(created_at), max(created_at), (now() - max(created_at)) FROM public.share_events
UNION ALL SELECT 'play_events',    count(*), min(created_at), max(created_at), (now() - max(created_at)) FROM public.play_events
UNION ALL SELECT 'setlists',       count(*), min(created_at), max(created_at), (now() - max(created_at)) FROM public.setlists
UNION ALL SELECT 'ab_test_assignments', count(*), min(created_at), max(created_at), (now() - max(created_at)) FROM public.ab_test_assignments
UNION ALL SELECT 'profiles',       count(*), min(created_at), max(created_at), (now() - max(created_at)) FROM public.profiles
UNION ALL SELECT 'draft_setlists', count(*), min(created_at), max(created_at), (now() - max(created_at)) FROM public.draft_setlists
UNION ALL SELECT 'wizard_events',  count(*), min(created_at), max(created_at), (now() - max(created_at)) FROM public.wizard_events
-- NOTE the column name: generated_at, not created_at.
UNION ALL SELECT 'cosmic_charlie_history', count(*), min(generated_at), max(generated_at), (now() - max(generated_at)) FROM public.cosmic_charlie_history
ORDER BY table_name;


-- -----------------------------------------------------------------------------
-- QUERY E: share_events is TWO tables wearing one trenchcoat.
--
-- src/lib/trackCtaClick.ts writes CTA/button clicks into share_events with
-- share_type='cta_click'. Recorded 2026-08-15: 219 of 335 rows (65%) are
-- cta_click, not shares. Counting share_events without filtering share_type
-- inflates any "shared" metric by roughly 3x. Every query in sql/funnels/
-- filters share_type <> 'cta_click'.
-- -----------------------------------------------------------------------------
SELECT
  share_type,
  CASE WHEN share_type = 'cta_click' THEN 'NOT A SHARE - button click telemetry'
       ELSE 'real share' END              AS interpretation,
  count(*)                                AS events,
  count(DISTINCT channel)                 AS channels,
  count(DISTINCT setlist_id)              AS setlists,
  count(DISTINCT coalesce(user_id::text, visitor_id)) AS actors,
  min(created_at)                         AS first_seen,
  max(created_at)                         AS last_seen
FROM public.share_events
GROUP BY share_type
ORDER BY events DESC;


-- -----------------------------------------------------------------------------
-- QUERY F: playback instrumentation defects. See the long note in
-- 40_playback_engagement.sql — these two bugs change how completion must be
-- computed, so this query keeps them visible.
--
-- Recorded 2026-08-15:
--   ended_reason='finished' AND completed=false -> 58 rows averaging 14.9% of
--     the track played. "finished" does not mean finished.
--   completed=true AND duration_played_ms > 1.5x track -> 6 rows averaging 4.9x
--     the track length. The player accumulates elapsed time across tracks.
-- -----------------------------------------------------------------------------
SELECT
  ended_reason,
  completed,
  count(*)                                                        AS events,
  round(avg(duration_played_ms) / 1000.0, 1)                      AS avg_seconds_played,
  round(avg(track_duration_ms) / 1000.0, 1)                       AS avg_track_seconds,
  round(avg(duration_played_ms::numeric / nullif(track_duration_ms, 0)), 3) AS avg_ratio_played,
  count(*) FILTER (WHERE track_duration_ms IS NULL OR track_duration_ms = 0)  AS missing_track_duration,
  count(*) FILTER (WHERE track_duration_ms > 0
                     AND duration_played_ms > track_duration_ms * 1.5)        AS impossible_duration,
  CASE
    WHEN ended_reason = 'finished' AND NOT completed THEN 'BUG: labelled finished, barely played'
    WHEN completed AND ended_reason = 'skipped'      THEN 'BUG: completed+skipped, timer overran'
    WHEN ended_reason = 'in_progress'                THEN 'never terminated - exclude from completion denominator'
    ELSE 'ok'
  END                                                             AS flag
FROM public.play_events
GROUP BY ended_reason, completed
ORDER BY events DESC;


-- -----------------------------------------------------------------------------
-- QUERY G: setlists.playable_slot_count looks stale.
--
-- Several setlists with playable_slot_count = 0 have double-digit play_events
-- against them, which should be impossible if the counter were current. The
-- precompute-slot-playability function populates it; this query shows how far
-- the cached counter has drifted from setlist_slot_playability. Not currently
-- used by any funnel query — flagged so nobody builds a metric on the counter
-- without checking it first.
-- -----------------------------------------------------------------------------
SELECT
  s.id                                     AS setlist_id,
  s.title,
  s.playable_slot_count                    AS cached_count,
  (SELECT count(*) FROM public.setlist_slots sl WHERE sl.setlist_id = s.id) AS actual_slots,
  (SELECT count(*) FROM public.play_events pe WHERE pe.setlist_id = s.id)   AS play_events,
  s.updated_at
FROM public.setlists s
WHERE s.playable_slot_count = 0
  AND (SELECT count(*) FROM public.play_events pe WHERE pe.setlist_id = s.id) > 0
ORDER BY play_events DESC
LIMIT 20;
