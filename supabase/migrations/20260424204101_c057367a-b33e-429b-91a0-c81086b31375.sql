-- 1. Extend page_visits with attribution fields
ALTER TABLE public.page_visits
  ADD COLUMN IF NOT EXISTS referrer text,
  ADD COLUMN IF NOT EXISTS landing_source text;

CREATE INDEX IF NOT EXISTS idx_page_visits_landing_source
  ON public.page_visits (landing_source, created_at DESC)
  WHERE landing_source IS NOT NULL;

-- 2. First-touch attribution table (one row per visitor)
CREATE TABLE IF NOT EXISTS public.visitor_attribution (
  visitor_id text PRIMARY KEY,
  first_referrer text,
  first_source text,
  first_landing_path text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  signed_up_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_visitor_attribution_source
  ON public.visitor_attribution (first_source, first_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_attribution_user
  ON public.visitor_attribution (user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.visitor_attribution ENABLE ROW LEVEL SECURITY;

-- Anonymous visitors can insert their own first-touch (visitor_id is client-generated UUID)
CREATE POLICY "Anyone can record first-touch attribution"
  ON public.visitor_attribution
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Admins read everything
CREATE POLICY "Admins can read attribution"
  ON public.visitor_attribution
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Service role can update (used when linking signups)
CREATE POLICY "Service role updates"
  ON public.visitor_attribution
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. Schedule the Lovable attribution report every 24h for 3 days
-- Uses existing pg_cron / pg_net pattern
DO $$
DECLARE
  fn_url text := 'https://dplrumaqrdnzwzqmatqr.supabase.co/functions/v1/lovable-attribution-report';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwbHJ1bWFxcmRuend6cW1hdHFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NzM1MTUsImV4cCI6MjA4OTQ0OTUxNX0.0SkPztsLU_j2mVb7O0BF3P3Fi-Nj2Xx6ZFDkYYvbsz4';
BEGIN
  -- Unschedule if already exists
  PERFORM cron.unschedule('lovable-attribution-report-72h')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'lovable-attribution-report-72h');

  PERFORM cron.schedule(
    'lovable-attribution-report-72h',
    '0 14 * * *',  -- daily at 14:00 UTC
    format($cron$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer %s'),
        body := jsonb_build_object('triggered_at', now())
      ) AS request_id;
    $cron$, fn_url, anon_key)
  );
END $$;