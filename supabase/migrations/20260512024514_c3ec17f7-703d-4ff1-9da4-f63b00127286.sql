
-- The service_role bypasses RLS by design; the explicit "USING (true)" policy
-- was redundant and tripped the permissive-policy linter. Drop it.
DROP POLICY IF EXISTS "Service role manages traffic cache" ON public.admin_traffic_stats_cache;

-- Keep admin SELECT policy as-is. Explicitly deny all other writes from API roles.
-- (No INSERT/UPDATE/DELETE policies => denied for anon and authenticated.)
REVOKE ALL ON TABLE public.admin_traffic_stats_cache FROM anon, authenticated;
GRANT SELECT ON TABLE public.admin_traffic_stats_cache TO authenticated;
