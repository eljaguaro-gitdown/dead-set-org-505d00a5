
-- Remove the wide-open insert policy
DROP POLICY IF EXISTS "Anyone can insert page visits" ON public.page_visits;

-- Only the service_role (edge function) can insert now
CREATE POLICY "Service role can insert page visits"
  ON public.page_visits
  FOR INSERT
  TO service_role
  WITH CHECK (true);
