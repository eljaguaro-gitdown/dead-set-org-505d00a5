-- =============================================================================
-- 50_creator_retention.sql — do creators come back and build again?
-- =============================================================================
--
-- HOW TO RUN
-- ----------
-- Paste into the Supabase SQL editor and run. Three independent SELECTs.
-- Creates nothing, modifies nothing. Reporting timezone: UTC.
--
--
-- WHAT THIS ANSWERS
-- -----------------
-- A. Is building a setlist a one-off or a habit? (repeat-creation rates, and
--    specifically repeat creation on a LATER DAY, which is the only version
--    that means anything — two setlists in one sitting is one session, not
--    retention.)
-- B. Setlist-level completion: how many reconstructions get abandoned empty.
-- C. Monthly creator cohorts: of the people who first built in month M, how
--    many were still building 30 / 60 / 90 days later.
--
--
-- WHY QUERY B EXISTS — the funnel's step 4 hides this
-- ---------------------------------------------------
-- In 10_activation_funnel.sql, "added_slots" converts at 100% and looks like a
-- dead step. At ACTOR level that is genuinely true: every creator who made a
-- setlist made at least one with songs in it. But at SETLIST level, 48 of 224
-- setlists (21%) have ZERO slots — someone hit create and walked away. That
-- abandonment is invisible in an actor-keyed funnel, so it gets its own query
-- here. If you want a number that can actually improve, this is the one.
--
--
-- THE FOUNDER PROBLEM
-- -------------------
-- eljaguaro@gmail.com created 129 of 224 setlists (57.6%). Including him,
-- "average setlists per creator" is 5.3, which describes nobody. All three
-- queries below carry a `segment` column instead of silently dropping him, so
-- the community figure and the internal figure are both visible and never
-- averaged. QA/test accounts (3 accounts, 8 setlists) are excluded outright.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- QUERY A: repeat-creation summary
-- -----------------------------------------------------------------------------
WITH qa_users AS (
  SELECT u.id AS user_id FROM auth.users u
  WHERE u.email ILIKE '%.test' OR u.email ILIKE '%.example' OR u.email ILIKE '%.invalid'
     OR u.email ILIKE '%@example.com' OR u.email ILIKE '%@example.org' OR u.email ILIKE '%@example.net'
     OR u.email ILIKE 'qa-verify-%' OR u.email ILIKE 'test\_%@dead-set.org' ESCAPE '\'
     OR u.email ILIKE '%@dead-set-org-qa.test'
),
internal_users AS (
  SELECT u.id AS user_id FROM auth.users u WHERE lower(u.email) IN ('eljaguaro@gmail.com')
),
creators AS (
  SELECT
    s.creator_id,
    CASE WHEN s.creator_id IN (SELECT user_id FROM internal_users)
         THEN 'internal' ELSE 'community' END       AS segment,
    count(*)                                        AS setlists,
    count(*) FILTER (WHERE EXISTS (
      SELECT 1 FROM public.setlist_slots sl WHERE sl.setlist_id = s.id
    ))                                              AS setlists_with_songs,
    count(DISTINCT date_trunc('day', s.created_at)) AS active_days,
    min(s.created_at)                               AS first_setlist_at,
    max(s.created_at)                               AS last_setlist_at
  FROM public.setlists s
  WHERE s.creator_id NOT IN (SELECT user_id FROM qa_users)
  GROUP BY s.creator_id, 2
)
SELECT
  segment,
  count(*)                                                          AS creators,
  count(*) FILTER (WHERE setlists >= 2)                             AS made_2_plus,
  round(100.0 * count(*) FILTER (WHERE setlists >= 2)
              / nullif(count(*), 0), 1)                             AS pct_made_2_plus,
  -- the honest retention number: came back on a different day
  count(*) FILTER (WHERE active_days >= 2)                          AS returned_another_day,
  round(100.0 * count(*) FILTER (WHERE active_days >= 2)
              / nullif(count(*), 0), 1)                             AS pct_returned_another_day,
  count(*) FILTER (WHERE last_setlist_at > first_setlist_at + interval '7 days')
                                                                    AS still_building_after_7d,
  count(*) FILTER (WHERE last_setlist_at >= now() - interval '30 days')
                                                                    AS active_last_30d,
  round(avg(setlists), 1)                                           AS avg_setlists,
  -- median is the number to quote when one account skews the mean
  percentile_cont(0.5) WITHIN GROUP (ORDER BY setlists)             AS median_setlists,
  max(setlists)                                                     AS max_setlists,
  round(100.0 * sum(setlists_with_songs) / nullif(sum(setlists), 0), 1)
                                                                    AS pct_setlists_with_songs
FROM creators
GROUP BY segment
ORDER BY creators DESC;


-- -----------------------------------------------------------------------------
-- QUERY B: setlist-level completion — the abandonment the funnel hides
-- -----------------------------------------------------------------------------
WITH qa_users AS (
  SELECT u.id AS user_id FROM auth.users u
  WHERE u.email ILIKE 'qa-verify-%' OR u.email ILIKE '%@example.com'
     OR u.email ILIKE '%@dead-set-org-qa.test' OR u.email ILIKE 'test\_%@dead-set.org' ESCAPE '\'
),
internal_users AS (
  SELECT u.id AS user_id FROM auth.users u WHERE lower(u.email) IN ('eljaguaro@gmail.com')
),
s AS (
  SELECT
    sl.id,
    sl.created_at,
    CASE WHEN sl.creator_id IN (SELECT user_id FROM internal_users)
         THEN 'internal' ELSE 'community' END AS segment,
    (SELECT count(*) FROM public.setlist_slots x WHERE x.setlist_id = sl.id) AS n_slots,
    sl.is_public
  FROM public.setlists sl
  WHERE sl.creator_id NOT IN (SELECT user_id FROM qa_users)
)
SELECT
  segment,
  count(*)                                                    AS setlists,
  count(*) FILTER (WHERE n_slots = 0)                         AS empty_setlists,
  round(100.0 * count(*) FILTER (WHERE n_slots = 0)
              / nullif(count(*), 0), 1)                       AS pct_empty,
  count(*) FILTER (WHERE n_slots BETWEEN 1 AND 2)             AS barely_started_1_2,
  -- a "real" reconstruction is a night with an arc, not three songs
  count(*) FILTER (WHERE n_slots >= 8)                        AS substantial_8_plus,
  round(100.0 * count(*) FILTER (WHERE n_slots >= 8)
              / nullif(count(*), 0), 1)                       AS pct_substantial,
  count(*) FILTER (WHERE is_public)                           AS public_setlists,
  round(avg(n_slots), 1)                                      AS avg_slots,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY n_slots)        AS median_slots
FROM s
GROUP BY segment
ORDER BY setlists DESC;


-- -----------------------------------------------------------------------------
-- QUERY C: monthly creator cohorts — retention curve.
-- Community segment only; the internal account would dominate every cell.
-- Small-sample warning: most cells here are single digits. This query is built
-- so the shape is right once volume arrives; do not over-read it today.
-- -----------------------------------------------------------------------------
WITH qa_users AS (
  SELECT u.id AS user_id FROM auth.users u
  WHERE u.email ILIKE 'qa-verify-%' OR u.email ILIKE '%@example.com'
     OR u.email ILIKE '%@dead-set-org-qa.test' OR u.email ILIKE 'test\_%@dead-set.org' ESCAPE '\'
     OR lower(u.email) IN ('eljaguaro@gmail.com')
),
first_build AS (
  SELECT s.creator_id, min(s.created_at) AS first_at
  FROM public.setlists s
  WHERE s.creator_id NOT IN (SELECT user_id FROM qa_users)
  GROUP BY s.creator_id
)
SELECT
  date_trunc('month', f.first_at)::date                       AS cohort_month,
  count(*)                                                    AS new_creators,
  count(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM public.setlists s2
    WHERE s2.creator_id = f.creator_id
      AND s2.created_at >  f.first_at + interval '1 day'
      AND s2.created_at <= f.first_at + interval '30 days'))   AS built_again_within_30d,
  count(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM public.setlists s2
    WHERE s2.creator_id = f.creator_id
      AND s2.created_at >  f.first_at + interval '30 days'
      AND s2.created_at <= f.first_at + interval '90 days'))   AS built_again_31_to_90d,
  count(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM public.setlists s2
    WHERE s2.creator_id = f.creator_id
      AND s2.created_at > f.first_at + interval '90 days'))     AS built_again_after_90d,
  round(100.0 * count(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM public.setlists s2
    WHERE s2.creator_id = f.creator_id
      AND s2.created_at >  f.first_at + interval '1 day'
      AND s2.created_at <= f.first_at + interval '30 days'))
    / nullif(count(*), 0), 1)                                  AS pct_retained_30d,
  -- cohorts younger than 30 days cannot have a full 30-day window yet
  (now() < min(f.first_at) + interval '30 days')               AS cohort_immature
FROM first_build f
GROUP BY cohort_month
ORDER BY cohort_month;
