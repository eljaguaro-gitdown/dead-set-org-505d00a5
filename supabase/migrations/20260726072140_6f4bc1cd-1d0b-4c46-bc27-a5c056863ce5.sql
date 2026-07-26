
CREATE TABLE IF NOT EXISTS public.setlist_intros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setlist_id uuid NOT NULL REFERENCES public.setlists(id) ON DELETE CASCADE,
  intro_source_hash text NOT NULL,
  lines jsonb NOT NULL,
  script_json jsonb NOT NULL,
  total_duration_ms int NOT NULL,
  voice_provider text NOT NULL DEFAULT 'openai',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (setlist_id, intro_source_hash)
);

GRANT SELECT ON public.setlist_intros TO anon, authenticated;
GRANT ALL ON public.setlist_intros TO service_role;

CREATE INDEX IF NOT EXISTS idx_setlist_intros_setlist_id
  ON public.setlist_intros(setlist_id);

ALTER TABLE public.setlist_intros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read setlist intros"
  ON public.setlist_intros
  FOR SELECT
  TO anon, authenticated
  USING (true);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dj_intro_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS song_overlay_enabled boolean NOT NULL DEFAULT true;
