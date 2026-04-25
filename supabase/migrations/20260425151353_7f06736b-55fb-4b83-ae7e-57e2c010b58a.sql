-- Harden draft_setlists RLS: replace USING (true) with header-matched session id checks.
-- The client passes the anonymous session id via the `x-anon-session-id` request header.

DROP POLICY IF EXISTS "Anyone can read drafts" ON public.draft_setlists;
DROP POLICY IF EXISTS "Drafts: update only matching session id" ON public.draft_setlists;
DROP POLICY IF EXISTS "Drafts: delete with valid session id" ON public.draft_setlists;

-- SELECT: only rows whose session id matches the request header (or owner is authenticated and matches via header)
CREATE POLICY "Drafts: read only matching session id"
  ON public.draft_setlists FOR SELECT
  TO anon, authenticated
  USING (
    anon_session_id = ((current_setting('request.headers'::text, true))::json ->> 'x-anon-session-id')
    AND anon_session_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

-- UPDATE: same constraint
CREATE POLICY "Drafts: update only matching session id"
  ON public.draft_setlists FOR UPDATE
  TO anon, authenticated
  USING (
    anon_session_id = ((current_setting('request.headers'::text, true))::json ->> 'x-anon-session-id')
    AND anon_session_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  )
  WITH CHECK (
    anon_session_id = ((current_setting('request.headers'::text, true))::json ->> 'x-anon-session-id')
    AND anon_session_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

-- DELETE: same constraint
CREATE POLICY "Drafts: delete only matching session id"
  ON public.draft_setlists FOR DELETE
  TO anon, authenticated
  USING (
    anon_session_id = ((current_setting('request.headers'::text, true))::json ->> 'x-anon-session-id')
    AND anon_session_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

-- INSERT policy already requires a well-formed UUID; keep as-is.