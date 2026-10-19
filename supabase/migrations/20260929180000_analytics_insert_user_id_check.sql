-- Stop anonymous analytics inserts from claiming someone else's user_id.
--
-- The "anyone can insert" policies on these tables had WITH CHECK (true), so
-- any caller holding the public key could write rows attributed to an
-- arbitrary user_id (flagged by the Lovable security scan, 2026-09-29). Rows
-- are admin-read only, so this was a data-integrity hole, not a data leak.
--
-- New rule: user_id must be NULL, or the caller's own auth.uid(). Every client
-- write path already satisfies it:
--   share_events         trackShare / trackCtaClick  — user_id from supabase.auth.getUser()
--   wizard_events        trackWizardEvent            — same
--   ab_test_assignments  getABVariant                — no user_id (conversion goes through
--                                                     the mark_ab_conversion RPC)
-- Edge functions use the service role and bypass RLS.
--
-- visitor_attribution: the anon INSERT policy is dropped outright. The only
-- writer is the track-visit edge function (service role); no client code
-- inserts, so the policy only served forged rows.
--
-- auth_events is deliberately NOT changed. trackAuthEvent (src/lib/authFunnel.ts)
-- posts with the publishable key and no user session, so the row survives the
-- OAuth redirect via fetch keepalive. auth.uid() is NULL there, and this check
-- would reject every oauth_returned / email_confirmed row that carries user_id.
-- Closing it needs the client to send the session token — a separate change.

DROP POLICY IF EXISTS "Anyone can log share events" ON public.share_events;
CREATE POLICY "Anyone can log share events"
  ON public.share_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "wizard_events_insert_anyone" ON public.wizard_events;
CREATE POLICY "wizard_events_insert_anyone"
  ON public.wizard_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "Anyone can log assignment" ON public.ab_test_assignments;
CREATE POLICY "Anyone can log assignment"
  ON public.ab_test_assignments
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "Anyone can record first-touch attribution" ON public.visitor_attribution;
