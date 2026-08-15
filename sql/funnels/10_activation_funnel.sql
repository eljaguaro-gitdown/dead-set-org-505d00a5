-- =============================================================================
-- 10_activation_funnel.sql — the activation funnel, one row per step
--   visit -> signup -> setlist created -> slots added -> shared -> played
-- =============================================================================
--
-- HOW TO RUN
-- ----------
-- Paste into the Supabase SQL editor (or any read-only psql session) and run.
-- This is a pure SELECT: it creates nothing and modifies nothing. There is no
-- setup step — the identity-resolution preamble is inlined below so the file
-- works standalone. If you have applied 00_actor_resolution.sql, the preamble
-- is redundant but harmless; keep the two in sync if you edit either.
--
-- To change the reporting window, edit the `params` CTE at the top. To fold the
-- founder's account back in, comment out the marked line in `excluded_users`.
--
-- Reporting timezone: UTC (see the long note in 00_actor_resolution.sql).
--
--
-- COHORT DEFINITION — read this before quoting a number
-- ----------------------------------------------------
-- The denominator is NEW actors: people whose FIRST-EVER page_visit falls inside
-- the window. Returning already-signed-up users are excluded from the
-- denominator, because a person who signed up in May is not "converting" when
-- they visit again in August — leaving them in would silently depress every
-- conversion rate as the user base grows.
--
-- Steps are STRICTLY SEQUENTIAL and time-ordered: an actor counts at step N only
-- if they reached every prior step AND the step-N event happened at or after
-- their first visit. The `reached_unordered` column shows how many actors did
-- the step at all, ignoring sequence — a large gap between `count` and
-- `reached_unordered` at a step means people are arriving at that behaviour by
-- some path other than the one modelled here, which is worth investigating
-- rather than papering over.
--
-- Window default is 2026-04-24, the visitor_attribution epoch. Starting earlier
-- does not lengthen the funnel, it corrupts it — 28 of 48 real users predate
-- attribution and have no linkable first visit. See assumption 4 in
-- 00_actor_resolution.sql.
--
--
-- STEP SEMANTICS
-- --------------
--   1 visited          first-ever page_visit in window, bots/internal excluded
--   2 signed_up        auth.users row exists for the actor (auth.users.created_at
--                      is the authority, not visitor_attribution.signed_up_at,
--                      which only covers browsers that happened to be attributed)
--   3 created_setlist  >=1 row in setlists with creator_id = actor
--   4 added_slots      >=1 of those setlists has >=1 setlist_slots row
--   5 shared           >=1 share_events row with share_type <> 'cta_click'
--                      (cta_click is a button click, not a share — it is 219 of
--                      335 rows and would inflate this step ~3x)
--   6 played           >=1 play_events row
--
-- CAVEAT ON STEP 4: at ACTOR level this converts at 100%, which looks like a
-- broken step but is true — every creator who made a setlist made at least one
-- with songs in it. The abandonment is at SETLIST level: 48 of 224 setlists
-- (21%) have zero slots. If you want the number that actually moves, use the
-- setlist-level metric in 50_creator_retention.sql, not this step.
--
-- CAVEAT ON STEP 6: playback is not yet a real user behaviour. 463 of 472
-- play_events (98.1%) belong to the founder's account, which this query
-- excludes. What remains is a handful of events from 3 anonymous browsers and
-- one other account. Treat step 6 as instrumentation-confirmed but
-- statistically empty until real listening volume appears.
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

-- ---- cohort: first-EVER visit, then restricted to the window ----------------
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
  SELECT f.actor_key, f.entered_at
  FROM first_visit f CROSS JOIN params pa
  WHERE f.entered_at >= pa.since AND f.entered_at < pa.until
),

-- ---- step timestamps, one row per actor -------------------------------------
t_signup AS (
  SELECT 'user:' || u.id::text AS actor_key, u.created_at AS at
  FROM auth.users u
  WHERE u.id NOT IN (SELECT user_id FROM excluded_users)
),
t_created AS (
  SELECT 'user:' || s.creator_id::text AS actor_key, min(s.created_at) AS at
  FROM public.setlists s
  WHERE s.creator_id NOT IN (SELECT user_id FROM excluded_users)
  GROUP BY 1
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
                  'visitor:' || e.visitor_id) AS actor_key,
         min(e.created_at) AS at
  FROM public.share_events e
  LEFT JOIN vmap m ON m.visitor_id = e.visitor_id
  WHERE e.share_type <> 'cta_click'
    AND (e.user_id IS NOT NULL OR e.visitor_id IS NOT NULL)
    AND (e.user_id IS NULL OR e.user_id NOT IN (SELECT user_id FROM excluded_users))
  GROUP BY 1
),
t_played AS (
  SELECT coalesce('user:' || coalesce(e.user_id, m.user_id)::text,
                  'visitor:' || e.visitor_id) AS actor_key,
         min(e.created_at) AS at
  FROM public.play_events e
  LEFT JOIN vmap m ON m.visitor_id = e.visitor_id
  WHERE (e.user_id IS NOT NULL OR e.visitor_id IS NOT NULL)
    AND (e.user_id IS NULL OR e.user_id NOT IN (SELECT user_id FROM excluded_users))
  GROUP BY 1
),

-- ---- assemble ---------------------------------------------------------------
journey AS (
  SELECT
    c.actor_key,
    c.entered_at,
    sg.at AS at_signup,
    cr.at AS at_created,
    sl.at AS at_slots,
    sh.at AS at_shared,
    pl.at AS at_played
  FROM cohort c
  LEFT JOIN t_signup  sg ON sg.actor_key = c.actor_key AND sg.at >= c.entered_at
  LEFT JOIN t_created cr ON cr.actor_key = c.actor_key AND cr.at >= c.entered_at
  LEFT JOIN t_slots   sl ON sl.actor_key = c.actor_key AND sl.at >= c.entered_at
  LEFT JOIN t_shared  sh ON sh.actor_key = c.actor_key AND sh.at >= c.entered_at
  LEFT JOIN t_played  pl ON pl.actor_key = c.actor_key AND pl.at >= c.entered_at
),
agg AS (
  SELECT
    count(*)::bigint AS s1,
    count(*) FILTER (WHERE at_signup IS NOT NULL)::bigint AS s2,
    count(*) FILTER (WHERE at_signup IS NOT NULL AND at_created IS NOT NULL)::bigint AS s3,
    count(*) FILTER (WHERE at_signup IS NOT NULL AND at_created IS NOT NULL
                       AND at_slots IS NOT NULL)::bigint AS s4,
    count(*) FILTER (WHERE at_signup IS NOT NULL AND at_created IS NOT NULL
                       AND at_slots IS NOT NULL AND at_shared IS NOT NULL)::bigint AS s5,
    count(*) FILTER (WHERE at_signup IS NOT NULL AND at_created IS NOT NULL
                       AND at_slots IS NOT NULL AND at_shared IS NOT NULL
                       AND at_played IS NOT NULL)::bigint AS s6,
    -- unordered: did the actor ever do this, regardless of sequence
    count(*) FILTER (WHERE at_signup  IS NOT NULL)::bigint AS u2,
    count(*) FILTER (WHERE at_created IS NOT NULL)::bigint AS u3,
    count(*) FILTER (WHERE at_slots   IS NOT NULL)::bigint AS u4,
    count(*) FILTER (WHERE at_shared  IS NOT NULL)::bigint AS u5,
    count(*) FILTER (WHERE at_played  IS NOT NULL)::bigint AS u6
  FROM journey
),
steps AS (
  SELECT 1 AS step_no, 'visited'         AS step_name, s1 AS actors, s1 AS prev, s1 AS top, s1 AS reached_unordered FROM agg
  UNION ALL SELECT 2, 'signed_up',        s2, s1, s1, u2 FROM agg
  UNION ALL SELECT 3, 'created_setlist',  s3, s2, s1, u3 FROM agg
  UNION ALL SELECT 4, 'added_slots',      s4, s3, s1, u4 FROM agg
  UNION ALL SELECT 5, 'shared',           s5, s4, s1, u5 FROM agg
  UNION ALL SELECT 6, 'played',           s6, s5, s1, u6 FROM agg
)
SELECT
  step_no,
  step_name,
  actors,
  reached_unordered,
  round(100.0 * actors / nullif(prev, 0), 2) AS pct_of_previous,
  round(100.0 * actors / nullif(top, 0), 2)  AS pct_of_top,
  prev - actors                              AS dropped_from_previous
FROM steps
ORDER BY step_no;
