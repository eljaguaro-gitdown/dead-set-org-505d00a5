
-- 1. Indexes to speed up the underlying page_visits aggregations
CREATE INDEX IF NOT EXISTS idx_page_visits_created_at ON public.page_visits (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_visits_visitor_created ON public.page_visits (visitor_id, created_at DESC);

-- 2. Cache table (single row, id=1)
CREATE TABLE IF NOT EXISTS public.admin_traffic_stats_cache (
  id integer PRIMARY KEY DEFAULT 1,
  total_page_views bigint NOT NULL DEFAULT 0,
  total_unique bigint NOT NULL DEFAULT 0,
  unique_24h bigint NOT NULL DEFAULT 0,
  unique_7d bigint NOT NULL DEFAULT 0,
  unique_30d bigint NOT NULL DEFAULT 0,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_traffic_stats_cache_singleton CHECK (id = 1)
);

ALTER TABLE public.admin_traffic_stats_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read traffic cache" ON public.admin_traffic_stats_cache;
CREATE POLICY "Admins can read traffic cache"
  ON public.admin_traffic_stats_cache
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Service role manages traffic cache" ON public.admin_traffic_stats_cache;
CREATE POLICY "Service role manages traffic cache"
  ON public.admin_traffic_stats_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. Refresh function: recomputes the stats and upserts the single cache row.
CREATE OR REPLACE FUNCTION public.refresh_admin_traffic_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_views bigint;
  v_total_unique bigint;
  v_unique_24h bigint;
  v_unique_7d bigint;
  v_unique_30d bigint;
BEGIN
  SELECT count(*), count(DISTINCT visitor_id)
    INTO v_total_views, v_total_unique
    FROM public.page_visits;

  SELECT count(DISTINCT visitor_id) INTO v_unique_24h
    FROM public.page_visits WHERE created_at >= now() - interval '1 day';
  SELECT count(DISTINCT visitor_id) INTO v_unique_7d
    FROM public.page_visits WHERE created_at >= now() - interval '7 days';
  SELECT count(DISTINCT visitor_id) INTO v_unique_30d
    FROM public.page_visits WHERE created_at >= now() - interval '30 days';

  INSERT INTO public.admin_traffic_stats_cache
    (id, total_page_views, total_unique, unique_24h, unique_7d, unique_30d, refreshed_at)
  VALUES
    (1, COALESCE(v_total_views,0), COALESCE(v_total_unique,0),
        COALESCE(v_unique_24h,0), COALESCE(v_unique_7d,0), COALESCE(v_unique_30d,0), now())
  ON CONFLICT (id) DO UPDATE SET
    total_page_views = EXCLUDED.total_page_views,
    total_unique     = EXCLUDED.total_unique,
    unique_24h       = EXCLUDED.unique_24h,
    unique_7d        = EXCLUDED.unique_7d,
    unique_30d       = EXCLUDED.unique_30d,
    refreshed_at     = EXCLUDED.refreshed_at;
END;
$$;

-- 4. Rewrite get_admin_traffic_stats to read from cache (with on-demand seed if empty)
CREATE OR REPLACE FUNCTION public.get_admin_traffic_stats()
RETURNS TABLE(total_page_views bigint, total_unique bigint, unique_24h bigint, unique_7d bigint, unique_30d bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_traffic_stats_cache WHERE id = 1) THEN
    -- First-ever call: seed synchronously so admins get real numbers.
    PERFORM public.refresh_admin_traffic_stats();
  END IF;

  RETURN QUERY
    SELECT c.total_page_views, c.total_unique, c.unique_24h, c.unique_7d, c.unique_30d
      FROM public.admin_traffic_stats_cache c
      WHERE c.id = 1;
END;
$$;

-- 5. Make sure pg_cron is available (pg_net already used elsewhere)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 6. Schedule jobs (idempotent: unschedule by name if present, then re-schedule)
DO $$
DECLARE
  jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'refresh-admin-traffic-stats';
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;

  PERFORM cron.schedule(
    'refresh-admin-traffic-stats',
    '*/5 * * * *',
    $cron$ SELECT public.refresh_admin_traffic_stats(); $cron$
  );

  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'precompute-daily-hero-spotlight';
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;

  PERFORM cron.schedule(
    'precompute-daily-hero-spotlight',
    '1 0 * * *',
    $cron$ SELECT public.get_hero_spotlight(); $cron$
  );
END $$;

-- 7. Seed the cache once now so admins don't pay the cost on first dashboard load.
SELECT public.refresh_admin_traffic_stats();
