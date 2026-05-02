-- Cosmic Charlie history: per-user / per-visitor song generation log
CREATE TABLE public.cosmic_charlie_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL,
  visitor_id text NULL,
  song_id uuid NULL,
  song_title text NOT NULL,
  era_id uuid NULL,
  vibe_signature text NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cch_user_recent ON public.cosmic_charlie_history (user_id, generated_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX idx_cch_visitor_recent ON public.cosmic_charlie_history (visitor_id, generated_at DESC) WHERE visitor_id IS NOT NULL;
CREATE INDEX idx_cch_generated_at ON public.cosmic_charlie_history (generated_at DESC);

ALTER TABLE public.cosmic_charlie_history ENABLE ROW LEVEL SECURITY;

-- Service role manages everything (the edge function writes via service role)
CREATE POLICY "Service role manages history"
  ON public.cosmic_charlie_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admins can read for diagnostics
CREATE POLICY "Admins can read history"
  ON public.cosmic_charlie_history
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can read their own history
CREATE POLICY "Users can read own history"
  ON public.cosmic_charlie_history
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admin-friendly view: top songs in last 7d
CREATE OR REPLACE VIEW public.cosmic_charlie_song_frequency AS
SELECT song_title,
       COUNT(*)::int AS appearances,
       COUNT(DISTINCT COALESCE(user_id::text, visitor_id))::int AS distinct_audiences,
       MAX(generated_at) AS last_generated_at
FROM public.cosmic_charlie_history
WHERE generated_at > now() - interval '7 days'
GROUP BY song_title
ORDER BY appearances DESC;
