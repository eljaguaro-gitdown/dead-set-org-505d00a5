CREATE TABLE public.hero_spotlights (
  spotlight_date date PRIMARY KEY,
  setlist_id uuid NOT NULL REFERENCES public.setlists(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_hero_spotlights_setlist ON public.hero_spotlights(setlist_id);

ALTER TABLE public.hero_spotlights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Spotlights readable by everyone"
  ON public.hero_spotlights FOR SELECT
  USING (true);

CREATE POLICY "Service role manages spotlights"
  ON public.hero_spotlights FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.get_hero_spotlight()
RETURNS TABLE(setlist_id uuid, spotlight_date date)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'UTC')::date;
  v_setlist_id uuid;
BEGIN
  -- Already picked for today?
  SELECT s.setlist_id INTO v_setlist_id
  FROM public.hero_spotlights s
  WHERE s.spotlight_date = v_today;

  IF v_setlist_id IS NOT NULL THEN
    RETURN QUERY SELECT v_setlist_id, v_today;
    RETURN;
  END IF;

  -- Pick a public setlist that has at least one slot, prioritizing ones
  -- that have never been spotlighted (or were spotlighted longest ago).
  -- Random tiebreak so siblings rotate fairly.
  SELECT sl.id INTO v_setlist_id
  FROM public.setlists sl
  LEFT JOIN LATERAL (
    SELECT MAX(spotlight_date) AS last_featured
    FROM public.hero_spotlights hs
    WHERE hs.setlist_id = sl.id
  ) last ON true
  WHERE sl.is_public = true
    AND EXISTS (SELECT 1 FROM public.setlist_slots ss WHERE ss.setlist_id = sl.id)
  ORDER BY last.last_featured ASC NULLS FIRST, random()
  LIMIT 1;

  IF v_setlist_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.hero_spotlights (spotlight_date, setlist_id)
  VALUES (v_today, v_setlist_id)
  ON CONFLICT (spotlight_date) DO NOTHING;

  -- Re-read in case of race
  SELECT s.setlist_id INTO v_setlist_id
  FROM public.hero_spotlights s
  WHERE s.spotlight_date = v_today;

  RETURN QUERY SELECT v_setlist_id, v_today;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_hero_spotlight() TO anon, authenticated;