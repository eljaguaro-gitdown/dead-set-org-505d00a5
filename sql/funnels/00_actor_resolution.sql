-- =============================================================================
-- 00_actor_resolution.sql — canonical identity stitching for the activation funnel
-- =============================================================================
--
-- HOW TO APPLY
-- ------------
-- Nothing in sql/funnels/ has been executed against production. This file is
-- OPTIONAL: it consolidates the identity-resolution logic into four views so
-- the funnel queries can be short. The runnable query files (10_ through 90_)
-- are deliberately SELF-CONTAINED — they inline this same logic as a CTE
-- preamble and run as-is with zero setup. Apply this file only if you want the
-- views available for ad-hoc work.
--
-- To apply, either:
--   (a) paste into the Supabase SQL editor and run, or
--   (b) copy into a NEW timestamped file under supabase/migrations/ and let the
--       normal migration flow ship it. Do NOT edit an existing migration —
--       supabase/migrations/ is append-only (see CLAUDE.md).
--
-- These are all read-only views over existing tables. No table is modified.
-- Access control mirrors admin_traffic_stats_cache: admins + service_role only,
-- since these views expose auth.users email patterns and cross-user activity.
--
-- IF YOU APPLY THIS: keep the preamble in 10_/20_/30_/40_/50_/90_ in sync with
-- the view bodies below, or delete the preambles and rewrite those files
-- against the views.
--
--
-- REPORTING TIMEZONE: UTC
-- -----------------------
-- Everything here buckets on UTC. That is the existing house convention, not a
-- preference: get_admin_traffic_stats() uses bare now() - interval arithmetic,
-- src/components/FunnelWidget.tsx buckets days with setUTCHours/setUTCDate,
-- get_hero_spotlight picks one setlist "per UTC day", and every report under
-- reports/growth/ quotes UTC timestamps. Switching the SQL to America/Los_Angeles
-- would silently disagree with the admin dashboard Jay already reads. Weeks use
-- date_trunc('week', ...), which is ISO — Monday 00:00 UTC.
--
--
-- THE STITCHING PROBLEM
-- ---------------------
-- Events carry visitor_id (localStorage key `ds_visitor_id`) and/or user_id,
-- and which one is populated depends on the table:
--
--   table              | visitor only | user only | both  | notes
--   -------------------|--------------|-----------|-------|-----------------------
--   page_visits        | 5644         | 0         | 0     | never carries user_id
--   auth_events        | 303          | 0         | 130   | visitor_id always set
--   share_events       | 66           | 0         | 268   | 1 row has neither
--   play_events        | 7            | 465       | 0     | see WARNING below
--
-- WARNING (play_events): src/lib/playEventTracker.ts writes
-- `visitor_id: userId ? null : visitorId` — it NULLs the visitor_id whenever the
-- listener is signed in. So a signed-in play can only ever be stitched by
-- user_id, never by visitor. That is fine for resolution but it means play_events
-- can never be joined back to the pre-signup anonymous session.
--
-- visitor_attribution is the bridge: one row per visitor_id, with user_id and
-- signed_up_at filled in once that browser signs up.
--
-- VERIFIED PROPERTIES of visitor_attribution (checked 2026-08-15 in production):
--   * visitor_id is unique — 0 duplicate visitor_id rows. The join below cannot
--     fan out.
--   * No visitor_id maps to more than one user_id — 0 rows with
--     count(distinct user_id) > 1. So there is no shared-device ambiguity today.
--   * The map is many-to-one in the other direction: 69 signed-up visitor rows
--     collapse to 30 distinct users (avg 2.3 browsers per person, max 30).
--     Deduping on user_id is exactly what stops one person being counted as
--     several — which is the whole point of this file.
--   * visitor_id is NEVER NULL in visitor_attribution or page_visits (0 rows).
--     It CAN be null in share_events/play_events, handled below.
--
--
-- LOAD-BEARING ASSUMPTIONS
-- ------------------------
-- 1. CANONICAL ACTOR = coalesce('user:'||resolved_user_id, 'visitor:'||visitor_id).
--    An actor is one person. If we can resolve a user_id (directly on the event,
--    or via the visitor map) the person is that user; otherwise they are an
--    anonymous browser.
--
-- 2. RESOLUTION IS RETROACTIVE. Once visitor V is known to belong to user U,
--    ALL of V's history — including page views from before signup — is
--    attributed to U. This is deliberate: it is what makes "visited then signed
--    up" one actor instead of two. The cost is that anonymous-actor counts for
--    past periods shrink as people sign up later. A funnel re-run next month
--    will therefore show slightly fewer top-of-funnel anonymous actors for the
--    same historical week. This is the standard tradeoff; do not "fix" it.
--
-- 3. ONE BROWSER = ONE PERSON. Two people sharing a browser profile collapse
--    into one actor. Verified to not occur yet (see above), but it is not
--    enforceable.
--
-- 4. THE FUNNEL WINDOW STARTS 2026-04-24 (the attribution epoch). page_visits
--    starts 2026-03-26 but visitor_attribution only starts 2026-04-24, so any
--    user who signed up before that date has no linkable visit and drops out of
--    a sequential funnel by construction. Measured: of 48 real (non-QA) users,
--    28 predate the epoch; of the 20 who signed up on/after 2026-04-24, 19 have
--    an attribution row — 95% coverage in-era vs ~0% before. 99 of 224 setlists
--    were created pre-epoch. Running the funnel from before 2026-04-24 does not
--    produce a "longer" funnel, it produces a wrong one.
--
--
-- DATA-QUALITY EXCLUSIONS (see 90_data_quality_audit.sql for the evidence)
-- -----------------------------------------------------------------------
-- QA/test accounts: same precedent and same patterns as the dispatch_recipients
-- hygiene fix (supabase/migrations/20260814030000_dispatch_recipients_hygiene.sql),
-- where 3 QA addresses tripped a bounce advisory. The SAME 3 accounts are in
-- these event tables and between them created 8 setlists.
--
-- Internal accounts: eljaguaro@gmail.com is the founder. His account is 129 of
-- 224 setlists (57.6%), 463 of 472 play_events (98.1%), and 30 distinct
-- visitor_ids. On a 48-real-user dataset that is not a rounding error, it is the
-- dataset. He is excluded by default. Comment the line out to include him.
--
-- =============================================================================


-- -----------------------------------------------------------------------------
-- VIEW 1: analytics_excluded_users — accounts that must never reach a metric.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.analytics_excluded_users AS
SELECT u.id AS user_id, u.email, 'qa_test_address'::text AS reason
FROM auth.users u
WHERE
  -- RFC 2606 reserved TLDs / SLDs — nothing here is a real mailbox.
  u.email ILIKE '%.test'
  OR u.email ILIKE '%.example'
  OR u.email ILIKE '%.invalid'
  OR u.email ILIKE '%.localhost'
  OR u.email ILIKE '%@example.com'
  OR u.email ILIKE '%@example.org'
  OR u.email ILIKE '%@example.net'
  -- Dead Set QA harness patterns. Identical list to dispatch_recipients.
  OR u.email ILIKE 'qa-verify-%'
  OR u.email ILIKE 'test\_%@dead-set.org' ESCAPE '\'
  OR u.email ILIKE '%@dead-set-org-qa.test'

UNION ALL

-- Internal / founder accounts. Real humans, but their volume swamps a dataset
-- this small. Remove a line here to fold that person back into the metrics.
SELECT u.id, u.email, 'internal_founder'::text
FROM auth.users u
WHERE lower(u.email) IN ('eljaguaro@gmail.com');

REVOKE ALL ON public.analytics_excluded_users FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.analytics_excluded_users TO service_role;


-- -----------------------------------------------------------------------------
-- VIEW 2: analytics_bot_visitors — visitor_ids that are crawlers or automation.
--
-- The regex is deliberately TIGHT. A looser pattern (adding preview|monitor|
-- uptime|curl|wget|axios|python-requests|lighthouse|selenium|puppeteer|
-- playwright) was tested against all 5644 page_visits and matched ZERO
-- additional rows — every hit came from the strong tokens below. Loose tokens
-- add false-positive risk (a "Preview" in a real UA) for no recall. Keep it tight.
--
-- Measured: 216 visits / 157 visitor_ids classified as bots, ~3.8% of traffic.
-- Googlebot-smartphone is caught because its full UA ends with
-- "(compatible; Googlebot/2.1; ...)" even though it opens as an Android Nexus 5X.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.analytics_bot_visitors AS
SELECT DISTINCT p.visitor_id
FROM public.page_visits p
WHERE p.user_agent IS NULL
   OR p.user_agent = ''
   OR p.user_agent ~* '(bot|crawl|spider|slurp|headless|dataprovider|facebookexternalhit|bytespider|wcagrepair|bilateralnavigator|meta-externalagent)'
   -- Non-production origins: local dev, the Lovable preview iframe, Netlify
   -- staging. These are builders looking at their own work, not visitors.
   OR p.landing_source = 'localhost'
   OR p.landing_source ILIKE '%lovableproject.com'
   OR p.landing_source ILIKE '%netlify.app'
   OR p.referrer ILIKE '%localhost%'
   -- Vulnerability scanners probing for source files / PHP.
   OR p.page_path ILIKE '%/supabase/functions/%'
   OR p.page_path ILIKE '%.php'
   OR p.page_path ILIKE '%wp-%';

REVOKE ALL ON public.analytics_bot_visitors FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.analytics_bot_visitors TO service_role;


-- -----------------------------------------------------------------------------
-- VIEW 3: analytics_visitor_identity — the visitor_id -> user_id bridge,
-- with excluded accounts already stripped out.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.analytics_visitor_identity AS
SELECT
  va.visitor_id,
  va.user_id,
  va.signed_up_at,
  va.first_seen_at,
  va.first_source,
  va.first_referrer,
  va.first_landing_path
FROM public.visitor_attribution va
WHERE va.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.analytics_excluded_users x WHERE x.user_id = va.user_id
  );

REVOKE ALL ON public.analytics_visitor_identity FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.analytics_visitor_identity TO service_role;


-- -----------------------------------------------------------------------------
-- VIEW 4: analytics_actor_events — every funnel-relevant event, normalised to
-- one canonical actor per row. This is the reusable resolution layer.
--
-- NOTE on share_events: share_type='cta_click' is NOT a share. src/lib/
-- trackCtaClick.ts writes CTA/button clicks into share_events, and they are the
-- MAJORITY of the table (219 of 335 rows). Counting share_events without
-- filtering share_type inflates "shared" by roughly 3x. Real shares are
-- share_type IN ('setlist','app_link') — 116 rows. cta_click is preserved here
-- under its own event_name so it stays available, but it is not a share.
--
-- NOTE on wizard_events: the table exists but is EMPTY (0 rows) — the primary
-- wizard surface was never instrumented. It is unioned in below so that the
-- moment instrumentation lands, wizard steps flow through with no query changes.
-- Nothing downstream depends on it having rows. Its timestamp column is
-- created_at (unlike cosmic_charlie_history, which uses generated_at).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.analytics_actor_events AS
WITH resolved AS (
  -- page_visits: only ever carries visitor_id.
  SELECT
    'page_visit'::text AS event_name,
    p.created_at       AS occurred_at,
    p.visitor_id,
    vi.user_id         AS resolved_user_id,
    p.page_path        AS detail,
    NULL::uuid         AS setlist_id
  FROM public.page_visits p
  LEFT JOIN public.analytics_visitor_identity vi ON vi.visitor_id = p.visitor_id
  WHERE NOT EXISTS (SELECT 1 FROM public.analytics_bot_visitors b WHERE b.visitor_id = p.visitor_id)

  UNION ALL

  -- auth_events: visitor_id always present; user_id present after resolution.
  SELECT 'auth:'||a.event_name, a.created_at, a.visitor_id,
         coalesce(a.user_id, vi.user_id), a.provider, NULL::uuid
  FROM public.auth_events a
  LEFT JOIN public.analytics_visitor_identity vi ON vi.visitor_id = a.visitor_id
  WHERE NOT EXISTS (SELECT 1 FROM public.analytics_bot_visitors b WHERE b.visitor_id = a.visitor_id)

  UNION ALL

  -- share_events: real shares only (see note above).
  SELECT 'share:'||s.share_type, s.created_at, s.visitor_id,
         coalesce(s.user_id, vi.user_id), s.channel, s.setlist_id
  FROM public.share_events s
  LEFT JOIN public.analytics_visitor_identity vi ON vi.visitor_id = s.visitor_id
  WHERE s.share_type <> 'cta_click'
    -- 1 row in production has neither id — it can never be attributed to anyone.
    AND (s.user_id IS NOT NULL OR s.visitor_id IS NOT NULL)
    AND (s.visitor_id IS NULL
         OR NOT EXISTS (SELECT 1 FROM public.analytics_bot_visitors b WHERE b.visitor_id = s.visitor_id))

  UNION ALL

  -- CTA clicks, kept separately so nobody mistakes them for shares.
  SELECT 'cta_click', s.created_at, s.visitor_id,
         coalesce(s.user_id, vi.user_id), s.channel, s.setlist_id
  FROM public.share_events s
  LEFT JOIN public.analytics_visitor_identity vi ON vi.visitor_id = s.visitor_id
  WHERE s.share_type = 'cta_click'
    AND (s.user_id IS NOT NULL OR s.visitor_id IS NOT NULL)

  UNION ALL

  -- play_events: visitor_id is NULLed for signed-in listeners (see WARNING).
  SELECT 'play_start', e.created_at, e.visitor_id,
         coalesce(e.user_id, vi.user_id), e.ended_reason, e.setlist_id
  FROM public.play_events e
  LEFT JOIN public.analytics_visitor_identity vi ON vi.visitor_id = e.visitor_id
  WHERE (e.user_id IS NOT NULL OR e.visitor_id IS NOT NULL)

  UNION ALL

  -- setlists: creator_id is NOT NULL, so setlist creation is always a user
  -- action. Anonymous in-progress work lives in draft_setlists, which is keyed
  -- by anon_session_id (localStorage `ds_anon_session_id`) — a DIFFERENT key
  -- from ds_visitor_id, with no mapping between them. Anonymous drafts
  -- therefore CANNOT be stitched into this funnel, and the table is empty
  -- anyway (0 rows — drafts carry expires_at and get reaped). Anonymous
  -- build-abandonment is unmeasurable today. See 90_data_quality_audit.sql.
  SELECT 'setlist_created', s.created_at, NULL::text, s.creator_id, s.title, s.id
  FROM public.setlists s

  UNION ALL

  SELECT 'setlist_has_slots', s.created_at, NULL::text, s.creator_id, s.title, s.id
  FROM public.setlists s
  WHERE EXISTS (SELECT 1 FROM public.setlist_slots sl WHERE sl.setlist_id = s.id)

  UNION ALL

  -- Currently 0 rows. Present so instrumentation lands without a query change.
  SELECT 'wizard:'||w.event_name, w.created_at, w.visitor_id,
         coalesce(w.user_id, vi.user_id), w.mode, NULL::uuid
  FROM public.wizard_events w
  LEFT JOIN public.analytics_visitor_identity vi ON vi.visitor_id = w.visitor_id
  WHERE (w.user_id IS NOT NULL OR w.visitor_id IS NOT NULL)
)
SELECT
  -- THE CANONICAL ACTOR KEY.
  coalesce('user:' || r.resolved_user_id::text, 'visitor:' || r.visitor_id) AS actor_key,
  r.resolved_user_id,
  r.visitor_id,
  (r.resolved_user_id IS NOT NULL) AS is_identified,
  r.event_name,
  r.occurred_at,
  r.detail,
  r.setlist_id
FROM resolved r
WHERE coalesce(r.resolved_user_id::text, r.visitor_id) IS NOT NULL
  AND (r.resolved_user_id IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.analytics_excluded_users x
                      WHERE x.user_id = r.resolved_user_id));

REVOKE ALL ON public.analytics_actor_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.analytics_actor_events TO service_role;


-- -----------------------------------------------------------------------------
-- Suggested supporting indexes. page_visits already has idx_page_visits_created_at
-- and idx_page_visits_visitor_created from migration 20260512024215.
-- These are additive and safe; apply alongside the views if the queries feel slow.
-- At current volumes (5644 page_visits) they are not yet necessary.
-- -----------------------------------------------------------------------------
-- CREATE INDEX IF NOT EXISTS idx_visitor_attribution_user   ON public.visitor_attribution (user_id) WHERE user_id IS NOT NULL;
-- CREATE INDEX IF NOT EXISTS idx_share_events_type_created  ON public.share_events (share_type, created_at DESC);
-- CREATE INDEX IF NOT EXISTS idx_play_events_user_created   ON public.play_events (user_id, created_at DESC);
-- CREATE INDEX IF NOT EXISTS idx_setlists_creator_created   ON public.setlists (creator_id, created_at DESC);
-- CREATE INDEX IF NOT EXISTS idx_setlist_slots_setlist      ON public.setlist_slots (setlist_id);
