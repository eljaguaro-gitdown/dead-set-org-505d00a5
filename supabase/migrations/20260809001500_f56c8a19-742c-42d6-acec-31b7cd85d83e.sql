-- play_events had only an admin SELECT policy. INSERTs from the app use
-- .select("id") (RETURNING), which is filtered by SELECT policies — for every
-- non-admin caller PostgREST's object-mode response then errored and ROLLED
-- BACK the insert, silently disabling play tracking for everyone but admins.
-- Let listeners read their own rows: signed-in users by user_id, anonymous
-- listeners by the x-visitor-id request header matching the row's visitor_id
-- (the same ownership check the UPDATE policy already uses).
CREATE POLICY "Listeners can read own play events"
ON public.play_events
FOR SELECT
USING (
  ((auth.uid() IS NOT NULL) AND (user_id = auth.uid()))
  OR (
    (auth.uid() IS NULL) AND (user_id IS NULL) AND (visitor_id IS NOT NULL)
    AND (visitor_id = ((current_setting('request.headers'::text, true))::json ->> 'x-visitor-id'::text))
  )
);
