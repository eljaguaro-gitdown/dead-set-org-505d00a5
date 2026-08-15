-- =============================================================================
-- 30_share_loop.sql — share -> subsequent visit -> signup attribution
-- =============================================================================
--
-- HOW TO RUN
-- ----------
-- Paste into the Supabase SQL editor and run. Pure SELECT, creates nothing.
-- Returns two result sets (per-channel summary, then the raw referred-visitor
-- detail); run them separately or comment one out.
--
-- Reporting timezone: UTC.
--
--
-- WHAT THIS ANSWERS
-- -----------------
-- "When someone shares a setlist, does anyone actually arrive — and do they
-- stay?" This is the closest thing Dead Set has to a viral coefficient.
--
--
-- HOW ATTRIBUTION WORKS HERE — and why it is weaker than it looks
-- ---------------------------------------------------------------
-- There is NO share token in the inbound URL and no share_id on page_visits.
-- The only join available is topological:
--
--   share_events.setlist_id  ->  page_visits.page_path = '/setlist/' || setlist_id
--
-- i.e. "somebody shared setlist S at time T; here are visitors who landed on
-- S's page after T". That is a CORRELATION, not a tracked click. Specifically:
--
--   * A visitor who found the setlist through Browse rather than the share link
--     is indistinguishable from a referred visitor and will be counted.
--   * A share whose recipient never clicked is invisible, correctly.
--   * Attribution is capped at 30 days after the share (the `attribution_window`
--     param) to stop a single share claiming credit for a year of organic
--     traffic. Shorten it to tighten precision.
--   * The sharer's own follow-up visits are excluded by actor key.
--   * Multiple shares of the same setlist all get credit for the same visitor;
--     the per-channel numbers therefore do not sum to the deduped total. The
--     summary reports distinct visitors per channel for that reason.
--
-- Treat the output as an UPPER BOUND on share-driven acquisition. If this ever
-- needs to be exact, the fix is upstream: append a share id to the shared URL
-- (e.g. ?s=<share_event_id>) and capture it into page_visits.landing_source.
-- Until then the ceiling is what we can measure.
--
-- Note that share_type='cta_click' is excluded throughout — those are button
-- clicks written into share_events by src/lib/trackCtaClick.ts, not shares.
-- Only share_type='setlist' carries a setlist_id worth joining on; 'app_link'
-- shares point at the app generally and have no landing page to attribute.
--
--
-- EXPECT A NEARLY EMPTY RESULT — that is the finding, not a bug
-- ------------------------------------------------------------
-- Measured 2026-08-15: of 116 real (non-cta_click) share events, 100 belong to
-- the founder's account — 86%. Excluding him, as this query does by default,
-- leaves exactly THREE setlist shares ever made by community members
-- (doyouwilco@, seth@bardooakland, katharinebainbridge@) plus a handful of
-- app_link shares.
--
-- So the default output is one row: copy_link, 5 referred visitors, 0 signups.
-- There is no organic share loop yet to measure. For the ceiling — what the
-- mechanism produces when it IS exercised — comment out the founder line in
-- excluded_users and re-run; that yields 61 referred visitors across copy_link
-- (33), sms (15) and native_share (13), converting 1 signup (copy_link, 3.0%).
-- Read those as "the share plumbing works and does bring people to the page",
-- not as evidence of virality.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- QUERY A: per-channel share loop summary
-- -----------------------------------------------------------------------------
WITH params AS (
  SELECT interval '30 days' AS attribution_window
),
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
),
vmap AS (
  SELECT va.visitor_id, va.user_id FROM public.visitor_attribution va
  WHERE va.user_id IS NOT NULL AND va.user_id NOT IN (SELECT user_id FROM excluded_users)
),
shares AS (
  SELECT
    e.id AS share_id,
    e.setlist_id,
    e.channel,
    e.created_at AS shared_at,
    coalesce('user:' || coalesce(e.user_id, m.user_id)::text,
             'visitor:' || e.visitor_id) AS sharer_key
  FROM public.share_events e
  LEFT JOIN vmap m ON m.visitor_id = e.visitor_id
  WHERE e.share_type = 'setlist'
    AND e.setlist_id IS NOT NULL
    AND (e.user_id IS NULL OR e.user_id NOT IN (SELECT user_id FROM excluded_users))
),
-- One row per (channel, referred visitor): their first landing after any share
-- of that setlist on that channel.
referred AS (
  SELECT
    s.channel,
    s.setlist_id,
    p.visitor_id,
    min(p.created_at) AS landed_at
  FROM shares s
  JOIN public.page_visits p
    ON p.page_path = '/setlist/' || s.setlist_id::text
   AND p.created_at >  s.shared_at
   AND p.created_at <= s.shared_at + (SELECT attribution_window FROM params)
  WHERE p.visitor_id NOT IN (SELECT visitor_id FROM bot_visitors)
    -- do not credit the sharer for visiting their own page
    AND ('visitor:' || p.visitor_id) <> s.sharer_key
    AND coalesce('user:' || (SELECT m2.user_id FROM vmap m2 WHERE m2.visitor_id = p.visitor_id)::text, '') <> s.sharer_key
  GROUP BY 1, 2, 3
)
SELECT
  r.channel,
  count(DISTINCT r.setlist_id)                     AS setlists_shared,
  count(DISTINCT r.visitor_id)                     AS referred_visitors,
  count(DISTINCT r.visitor_id) FILTER (
    WHERE va.signed_up_at IS NOT NULL AND va.signed_up_at >= r.landed_at
  )                                                AS signed_up_after_landing,
  round(100.0 * count(DISTINCT r.visitor_id) FILTER (
    WHERE va.signed_up_at IS NOT NULL AND va.signed_up_at >= r.landed_at
  ) / nullif(count(DISTINCT r.visitor_id), 0), 2)  AS pct_referred_to_signup,
  -- did the referred visitor go on to build something of their own?
  count(DISTINCT r.visitor_id) FILTER (
    WHERE EXISTS (SELECT 1 FROM public.setlists sx
                  WHERE sx.creator_id = va.user_id AND sx.created_at >= r.landed_at)
  )                                                AS became_creator
FROM referred r
LEFT JOIN public.visitor_attribution va ON va.visitor_id = r.visitor_id
GROUP BY r.channel
ORDER BY referred_visitors DESC;


-- -----------------------------------------------------------------------------
-- QUERY B: raw detail — every referred visitor, what they did next.
-- Useful for eyeballing whether the topological join is producing sane pairs.
-- Uncomment to run.
-- -----------------------------------------------------------------------------
-- WITH excluded_users AS (
--   SELECT u.id AS user_id FROM auth.users u
--   WHERE u.email ILIKE '%.test' OR u.email ILIKE '%@example.com'
--      OR u.email ILIKE 'qa-verify-%' OR u.email ILIKE '%@dead-set-org-qa.test'
--      OR lower(u.email) IN ('eljaguaro@gmail.com')
-- ),
-- shares AS (
--   SELECT e.setlist_id, e.channel, e.created_at AS shared_at
--   FROM public.share_events e
--   WHERE e.share_type = 'setlist' AND e.setlist_id IS NOT NULL
-- )
-- SELECT s.channel, s.setlist_id, sl.title, s.shared_at,
--        p.visitor_id, min(p.created_at) AS landed_at,
--        va.signed_up_at, va.first_source
-- FROM shares s
-- JOIN public.page_visits p
--   ON p.page_path = '/setlist/' || s.setlist_id::text
--  AND p.created_at > s.shared_at
--  AND p.created_at <= s.shared_at + interval '30 days'
-- LEFT JOIN public.visitor_attribution va ON va.visitor_id = p.visitor_id
-- LEFT JOIN public.setlists sl ON sl.id = s.setlist_id
-- GROUP BY 1,2,3,4,5,7,8
-- ORDER BY s.shared_at DESC;
