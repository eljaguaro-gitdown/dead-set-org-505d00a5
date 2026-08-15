-- =============================================================================
-- 40_playback_engagement.sql — play starts, completion rate, per-setlist detail
-- =============================================================================
--
-- HOW TO RUN
-- ----------
-- Paste into the Supabase SQL editor and run. Three independent SELECTs; run
-- them together or one at a time. Creates nothing, modifies nothing.
--
-- Reporting timezone: UTC.
--
--
-- READ THIS FIRST — playback is 98% one account
-- ---------------------------------------------
-- Measured 2026-08-15: 463 of 472 play_events belong to the founder's account
-- (eljaguaro@gmail.com). The remaining 9 are 2 events from one other account
-- and 7 from three anonymous browsers. Unlike the other files here, these
-- queries do NOT exclude the founder by default — excluding him would leave
-- nothing to report. Instead every query carries a `segment` column splitting
-- 'internal' from 'community' so the two never get averaged together.
--
-- Consequence: the completion and error rates below are overwhelmingly a
-- measurement of the founder's own listening on his own devices. They are a
-- valid read on whether the PLAYER WORKS. They are not a read on user
-- engagement. Do not put them in a growth report as engagement metrics.
--
--
-- TWO INSTRUMENTATION BUGS THAT CHANGE THE MATH — verified, not theoretical
-- ------------------------------------------------------------------------
-- 1. `ended_reason = 'finished'` DOES NOT MEAN THE TRACK FINISHED.
--    58 rows have ended_reason='finished' AND completed=false, and they averaged
--    56.9 seconds played against a 433-second track — 14.9% of the way through.
--    Meanwhile the 14 rows with completed=true AND ended_reason='finished'
--    average 99.8% played, which is what a real completion looks like.
--    => `completed` is the trustworthy flag. `ended_reason='finished'` is not.
--       Any query defining completion as ended_reason='finished' overstates
--       completions by ~4x. This is the single most important thing in this file.
--
-- 2. `duration_played_ms` CAN EXCEED THE TRACK LENGTH.
--    6 rows have completed=true with ended_reason='skipped' and an average
--    duration_played_ms of 6,315 seconds against a 610-second track — 4.9x the
--    track. The player is accumulating elapsed time across track changes or
--    while a tab sits open, rather than resetting per track. Those rows are
--    filtered out below via the `impossible_duration` guard (played > 1.5x
--    track length) so they cannot inflate listening-time totals.
--
-- Also note: 103 rows sit at ended_reason='in_progress' with no end recorded —
-- sessions that were never terminated (tab closed, process killed). They count
-- as STARTS but are excluded from the completion-rate DENOMINATOR, because a
-- session that never reported an ending cannot be said to have not completed.
-- Including them would understate completion rate by ~28%.
--
-- 21.2% of all play attempts end in ended_reason='error' (100 of 472). That is
-- a product signal worth escalating regardless of whose account it came from.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- QUERY A: overall playback health, split internal vs community
-- -----------------------------------------------------------------------------
WITH internal_users AS (
  SELECT u.id AS user_id FROM auth.users u
  WHERE u.email ILIKE '%.test' OR u.email ILIKE '%@example.com'
     OR u.email ILIKE 'qa-verify-%' OR u.email ILIKE 'test\_%@dead-set.org' ESCAPE '\'
     OR u.email ILIKE '%@dead-set-org-qa.test'
     OR lower(u.email) IN ('eljaguaro@gmail.com')
),
pe AS (
  SELECT
    e.*,
    CASE WHEN e.user_id IN (SELECT user_id FROM internal_users)
         THEN 'internal' ELSE 'community' END AS segment,
    -- guard against the accumulating-timer bug described above
    (e.track_duration_ms > 0 AND e.duration_played_ms > e.track_duration_ms * 1.5)
      AS impossible_duration
  FROM public.play_events e
)
SELECT
  segment,
  count(*)                                                        AS play_starts,
  count(DISTINCT coalesce(user_id::text, visitor_id))              AS listeners,
  count(DISTINCT setlist_id)                                       AS setlists_played,
  count(*) FILTER (WHERE ended_reason = 'in_progress')             AS never_terminated,
  count(*) FILTER (WHERE ended_reason <> 'in_progress')            AS terminal_events,
  count(*) FILTER (WHERE impossible_duration)                      AS impossible_duration_rows,
  -- completion uses `completed`, NOT ended_reason='finished' (see bug 1)
  count(*) FILTER (WHERE completed AND NOT impossible_duration)    AS completions,
  round(100.0 * count(*) FILTER (WHERE completed AND NOT impossible_duration)
              / nullif(count(*) FILTER (WHERE ended_reason <> 'in_progress'
                                          AND NOT impossible_duration), 0), 2)
                                                                   AS pct_completion_of_terminal,
  count(*) FILTER (WHERE ended_reason = 'error')                   AS errors,
  round(100.0 * count(*) FILTER (WHERE ended_reason = 'error')
              / nullif(count(*), 0), 2)                            AS pct_error,
  count(*) FILTER (WHERE ended_reason = 'skipped')                 AS skips,
  round(avg(duration_played_ms) FILTER (WHERE NOT impossible_duration) / 1000.0, 1)
                                                                   AS avg_seconds_played,
  round(avg(duration_played_ms::numeric / nullif(track_duration_ms, 0))
        FILTER (WHERE NOT impossible_duration AND track_duration_ms > 0) * 100, 1)
                                                                   AS avg_pct_of_track,
  min(created_at) AS first_play,
  max(created_at) AS last_play
FROM pe
GROUP BY segment
ORDER BY play_starts DESC;


-- -----------------------------------------------------------------------------
-- QUERY B: per-setlist playback. Which reconstructions actually get listened to,
-- and which ones are failing to load.
-- -----------------------------------------------------------------------------
WITH internal_users AS (
  SELECT u.id AS user_id FROM auth.users u
  WHERE u.email ILIKE 'qa-verify-%' OR u.email ILIKE '%@example.com'
     OR u.email ILIKE '%@dead-set-org-qa.test' OR u.email ILIKE 'test\_%@dead-set.org' ESCAPE '\'
     OR lower(u.email) IN ('eljaguaro@gmail.com')
),
pe AS (
  SELECT e.*,
    (e.track_duration_ms > 0 AND e.duration_played_ms > e.track_duration_ms * 1.5) AS impossible_duration
  FROM public.play_events e
  WHERE e.setlist_id IS NOT NULL
)
SELECT
  s.id AS setlist_id,
  s.title,
  s.is_public,
  s.playable_slot_count,
  count(*)                                                       AS play_starts,
  count(DISTINCT coalesce(pe.user_id::text, pe.visitor_id))       AS listeners,
  count(DISTINCT pe.user_id) FILTER (
    WHERE pe.user_id NOT IN (SELECT user_id FROM internal_users)) AS community_listeners,
  count(*) FILTER (WHERE pe.completed AND NOT pe.impossible_duration) AS completions,
  count(*) FILTER (WHERE pe.ended_reason = 'error')               AS errors,
  round(100.0 * count(*) FILTER (WHERE pe.ended_reason = 'error')
              / nullif(count(*), 0), 1)                           AS pct_error,
  round(sum(pe.duration_played_ms) FILTER (WHERE NOT pe.impossible_duration) / 60000.0, 1)
                                                                  AS minutes_played,
  max(pe.created_at)                                              AS last_played_at
FROM pe
JOIN public.setlists s ON s.id = pe.setlist_id
GROUP BY s.id, s.title, s.is_public, s.playable_slot_count
HAVING count(*) >= 2
ORDER BY play_starts DESC
LIMIT 40;


-- -----------------------------------------------------------------------------
-- QUERY C: which songs fail to play. Straight product-bug triage — a high error
-- count against one archive_url usually means a dead or moved Archive.org item.
-- -----------------------------------------------------------------------------
SELECT
  coalesce(song_title, '(unknown)')                    AS song_title,
  show_date,
  venue,
  count(*)                                             AS attempts,
  count(*) FILTER (WHERE ended_reason = 'error')       AS errors,
  round(100.0 * count(*) FILTER (WHERE ended_reason = 'error')
              / nullif(count(*), 0), 1)                AS pct_error,
  count(DISTINCT archive_url)                          AS distinct_urls,
  max(created_at)                                      AS last_attempt
FROM public.play_events
GROUP BY 1, 2, 3
HAVING count(*) FILTER (WHERE ended_reason = 'error') > 0
ORDER BY errors DESC, attempts DESC
LIMIT 30;
