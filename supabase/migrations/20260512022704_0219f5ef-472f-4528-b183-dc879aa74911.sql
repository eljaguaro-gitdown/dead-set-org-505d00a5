
CREATE OR REPLACE FUNCTION public.get_admin_traffic_stats()
RETURNS TABLE (
  total_page_views bigint,
  total_unique bigint,
  unique_24h bigint,
  unique_7d bigint,
  unique_30d bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*) FROM page_visits)::bigint AS total_page_views,
    (SELECT count(DISTINCT visitor_id) FROM page_visits)::bigint AS total_unique,
    (SELECT count(DISTINCT visitor_id) FROM page_visits WHERE created_at >= now() - interval '1 day')::bigint AS unique_24h,
    (SELECT count(DISTINCT visitor_id) FROM page_visits WHERE created_at >= now() - interval '7 days')::bigint AS unique_7d,
    (SELECT count(DISTINCT visitor_id) FROM page_visits WHERE created_at >= now() - interval '30 days')::bigint AS unique_30d;
$$;

REVOKE ALL ON FUNCTION public.get_admin_traffic_stats() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_traffic_stats() TO authenticated, service_role;
