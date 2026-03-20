ALTER TABLE public.setlists ADD COLUMN play_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_play_count(_setlist_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  UPDATE public.setlists
  SET play_count = play_count + 1
  WHERE id = _setlist_id;
$$;