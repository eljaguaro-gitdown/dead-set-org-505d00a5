-- =============================================================================
-- 20_activation_funnel_weekly.sql — the same funnel, bucketed by weekly cohort
-- =============================================================================
--
-- HOW TO RUN
-- ----------
-- Paste into the Supabase SQL editor and run. Pure SELECT, no setup, creates
-- nothing. Same inlined resolution preamble as 10_activation_funnel.sql — keep
-- them in sync if you edit either.
--
-- Reporting timezone: UTC. Weeks are date_trunc('week', ...), i.e. ISO weeks
-- starting Monday 00:00 UTC. Matches src/components/FunnelWidget.tsx, which
-- buckets with setUTCHours/setUTCDate.
--
--
-- WHAT THIS ANSWERS
-- -----------------
-- "Is activation getting better or worse?" Each row is a COHORT, not a period:
-- actors are bucketed by the week of their FIRST-EVER visit, and their later
-- steps count toward that founding week no matter when they happened. So a
-- visitor who first landed in week X and signed up three weeks later still
-- lands in week X's signup count.
--
-- This is what makes weeks comparable to each other — but it means the most
-- recent 1-2 weeks are ALWAYS understated, because those cohorts have not had
-- time to convert yet. Do not read a drop in the last row as a regression.
-- The `cohort_age_days` column is there to make that maturity explicit.
--
-- Volume warning: weekly cohorts here run 10-230 visitors and convert in the
-- low single digits. Week-over-week movement of 1-2 signups is noise. Read the
-- trend across a month, not the delta between two adjacent weeks.
-- =============================================================================

WITH params AS (
  SELECT
    timestamptz '2026-04-24 00:00:00+00' AS since,   -- attribution epoch
    now()                                AS until
),

-- ---- resolution preamble (mirrors 00_actor_resolution.sql) -------------------
excluded_users AS (
  SELECT u.id AS user_id FROM auth.users u
  WHERE u.email ILIKE '%.test' OR u.email ILIKE '%.example' OR u.email ILIKE '%.invalid'
     OR u.email ILIKE '%.localhost'
     OR u.email ILIKE '%@example.com' OR u.email ILIKE '%@example.org' OR u.email ILIKE '%@example.net'
     OR u.email ILIKE 'qa-verify-%' OR u.email ILIKE 'test\_%@dead-set.org' ESCAPE '\'
     OR u.email ILIKE '%@dead-set-org-qa.test'
     OR lower(u.email) IN ('eljaguaro@gmail.com')   -- founder; comment out to include
),
bot_visitors AS (
  SELECT DISTINCT p.visitor_id FROM public.page_visits p
  WHERE p.user_agent IS NULL OR p.user_agent = ''
     OR p.user_agent ~* '(bot|crawl|spider|slurp|headless|dataprovider|facebookexternalhit|bytespider|wcagrepair|bilateralnavigator|meta-externalagent)'
     OR p.landing_source = 'localhost'
     OR p.landing_source ILIKE '%lovableproject.com'
     OR p.landing_source ILIKE '%netlify.app'
     OR p.referrer ILIKE '%localhost%'
     OR p.page_path ILIKE '%/supabase/functions/%'
     OR p.page_path ILIKE '%.php'
     OR p.page_path ILIKE '%wp-%'
),
vmap AS (
  SELECT va.visitor_id, va.user_id
  FROM public.visitor_attribution va
  WHERE va.user_id IS NOT NULL
    AND va.user_id NOT IN (SELECT user_id FROM excluded_users)
),
first_visit AS (
  SELECT
    coalesce('user:' || m.user_id::text, 'visitor:' || p.visitor_id) AS actor_key,
    min(p.created_at) AS entered_at
  FROM public.page_visits p
  LEFT JOIN vmap m ON m.visitor_id = p.visitor_id
  WHERE p.visitor_id NOT IN (SELECT visitor_id FROM bot_visitors)
  GROUP BY 1
),
cohort AS (
  SELECT f.actor_key, f.entered_at, date_trunc('week', f.entered_at)::date AS cohort_week
  FROM first_visit f CROSS JOIN params pa
  WHERE f.entered_at >= pa.since AND f.entered_at < pa.until
),
t_signup AS (
  SELECT 'user:' || u.id::text AS actor_key, u.created_at AS at
  FROM auth.users u WHERE u.id NOT IN (SELECT user_id FROM excluded_users)
),
t_created AS (
  SELECT 'user:' || s.creator_id::text AS actor_key, min(s.created_at) AS at
  FROM public.setlists s
  WHERE s.creator_id NOT IN (SELECT user_id FROM excluded_users) GROUP BY 1
),
t_slots AS (
  SELECT 'user:' || s.creator_id::text AS actor_key, min(s.created_at) AS at
  FROM public.setlists s
  WHERE s.creator_id NOT IN (SELECT user_id FROM excluded_users)
    AND EXISTS (SELECT 1 FROM public.setlist_slots sl WHERE sl.setlist_id = s.id)
  GROUP BY 1
),
t_shared AS (
  SELECT coalesce('user:' || coalesce(e.user_id, m.user_id)::text,
                  'visitor:' || e.visitor_id) AS actor_key, min(e.created_at) AS at
  FROM public.share_events e LEFT JOIN vmap m ON m.visitor_id = e.visitor_id
  WHERE e.share_type <> 'cta_click'
    AND (e.user_id IS NOT NULL OR e.visitor_id IS NOT NULL)
    AND (e.user_id IS NULL OR e.user_id NOT IN (SELECT user_id FROM excluded_users))
  GROUP BY 1
),
t_played AS (
  SELECT coalesce('user:' || coalesce(e.user_id, m.user_id)::text,
                  'visitor:' || e.visitor_id) AS actor_key, min(e.created_at) AS at
  FROM public.play_events e LEFT JOIN vmap m ON m.visitor_id = e.visitor_id
  WHERE (e.user_id IS NOT NULL OR e.visitor_id IS NOT NULL)
    AND (e.user_id IS NULL OR e.user_id NOT IN (SELECT user_id FROM excluded_users))
  GROUP BY 1
),
journey AS (
  SELECT c.cohort_week, c.actor_key, c.entered_at,
         sg.at AS at_signup, cr.at AS at_created, sl.at AS at_slots,
         sh.at AS at_shared, pl.at AS at_played
  FROM cohort c
  LEFT JOIN t_signup  sg ON sg.actor_key = c.actor_key AND sg.at >= c.entered_at
  LEFT JOIN t_created cr ON cr.actor_key = c.actor_key AND cr.at >= c.entered_at
  LEFT JOIN t_slots   sl ON sl.actor_key = c.actor_key AND sl.at >= c.entered_at
  LEFT JOIN t_shared  sh ON sh.actor_key = c.actor_key AND sh.at >= c.entered_at
  LEFT JOIN t_played  pl ON pl.actor_key = c.actor_key AND pl.at >= c.entered_at
)
SELECT
  cohort_week,
  (extract(epoch FROM (now() - cohort_week))/86400)::int AS cohort_age_days,
  count(*)::bigint AS visited,
  count(*) FILTER (WHERE at_signup IS NOT NULL)::bigint AS signed_up,
  count(*) FILTER (WHERE at_signup IS NOT NULL AND at_created IS NOT NULL)::bigint AS created_setlist,
  count(*) FILTER (WHERE at_signup IS NOT NULL AND at_created IS NOT NULL
                     AND at_slots IS NOT NULL)::bigint AS added_slots,
  count(*) FILTER (WHERE at_signup IS NOT NULL AND at_created IS NOT NULL
                     AND at_slots IS NOT NULL AND at_shared IS NOT NULL)::bigint AS shared,
  count(*) FILTER (WHERE at_signup IS NOT NULL AND at_created IS NOT NULL
                     AND at_slots IS NOT NULL AND at_shared IS NOT NULL
                     AND at_played IS NOT NULL)::bigint AS played,
  round(100.0 * count(*) FILTER (WHERE at_signup IS NOT NULL)
              / nullif(count(*), 0), 2) AS pct_visit_to_signup,
  round(100.0 * count(*) FILTER (WHERE at_signup IS NOT NULL AND at_created IS NOT NULL)
              / nullif(count(*) FILTER (WHERE at_signup IS NOT NULL), 0), 2) AS pct_signup_to_setlist,
  -- Flag cohorts too young to have converted. Median lag from first visit to
  -- signup in this dataset is under a day, but the tail runs weeks.
  (now() - cohort_week < interval '14 days') AS immature_cohort
FROM journey
GROUP BY cohort_week
ORDER BY cohort_week;
