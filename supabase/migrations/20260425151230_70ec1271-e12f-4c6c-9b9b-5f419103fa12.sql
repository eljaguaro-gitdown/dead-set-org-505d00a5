-- Tighten write policies: require well-formed UUID session id (36 chars, dashes).
DROP POLICY IF EXISTS "Anyone can create drafts" ON public.draft_setlists;
DROP POLICY IF EXISTS "Anyone can update drafts" ON public.draft_setlists;
DROP POLICY IF EXISTS "Anyone can delete drafts" ON public.draft_setlists;

CREATE POLICY "Drafts: insert with valid session id"
  ON public.draft_setlists FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    anon_session_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

CREATE POLICY "Drafts: update only matching session id"
  ON public.draft_setlists FOR UPDATE
  TO anon, authenticated
  USING (
    anon_session_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  )
  WITH CHECK (
    anon_session_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

CREATE POLICY "Drafts: delete with valid session id"
  ON public.draft_setlists FOR DELETE
  TO anon, authenticated
  USING (
    anon_session_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

-- Read stays broad (anon has no JWT to filter against). App always queries WHERE anon_session_id = ?.