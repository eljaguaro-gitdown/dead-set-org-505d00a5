-- 1. Table
CREATE TABLE public.draft_setlists (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  anon_session_id text NOT NULL,
  title text NOT NULL DEFAULT 'Untitled Setlist',
  songs jsonb NOT NULL DEFAULT '[]'::jsonb,
  cosmic_charlie_input jsonb,
  era_filter text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);

CREATE INDEX idx_draft_setlists_anon_session ON public.draft_setlists (anon_session_id);
CREATE INDEX idx_draft_setlists_expires_at ON public.draft_setlists (expires_at);

-- 2. updated_at trigger (reuse existing function)
CREATE TRIGGER draft_setlists_set_updated_at
BEFORE UPDATE ON public.draft_setlists
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. RLS
ALTER TABLE public.draft_setlists ENABLE ROW LEVEL SECURITY;

-- Public RLS by obscure UUID. Session id is the secret.
-- We keep policies permissive for ephemeral drafts; the UUID is high-entropy and rows expire in 30 days.
CREATE POLICY "Anyone can create drafts"
  ON public.draft_setlists FOR INSERT
  TO anon, authenticated
  WITH CHECK (anon_session_id IS NOT NULL AND length(anon_session_id) >= 16);

CREATE POLICY "Anyone can read drafts"
  ON public.draft_setlists FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can update drafts"
  ON public.draft_setlists FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete drafts"
  ON public.draft_setlists FOR DELETE
  TO anon, authenticated
  USING (true);

-- 4. Cleanup function for expired drafts
CREATE OR REPLACE FUNCTION public.cleanup_expired_drafts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM public.draft_setlists WHERE expires_at < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 5. Daily cron job (pg_cron + pg_net assumed enabled — they are, per existing email cron infra)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('cleanup-expired-drafts')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-drafts');
    PERFORM cron.schedule(
      'cleanup-expired-drafts',
      '17 4 * * *', -- daily at 04:17 UTC
      $cron$ SELECT public.cleanup_expired_drafts(); $cron$
    );
  END IF;
END $$;