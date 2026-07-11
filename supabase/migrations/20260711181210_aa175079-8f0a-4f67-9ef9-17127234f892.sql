-- Restrict column-level SELECT on profiles so the dispatch_unsubscribe_token
-- (a bearer credential) and dispatch_opt_in flag are no longer readable by
-- anon/authenticated clients through PostgREST. Edge functions using the
-- service role are unaffected.
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, user_id, display_name, avatar_url, created_at, home_state)
  ON public.profiles TO anon, authenticated;
-- Preserve existing write privileges (RLS policies already scope to owner).
GRANT INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;