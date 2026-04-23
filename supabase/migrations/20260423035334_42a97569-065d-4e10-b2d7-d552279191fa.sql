CREATE TABLE public.favorite_songs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, song_id)
);

ALTER TABLE public.favorite_songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own favorite songs"
ON public.favorite_songs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can add own favorite songs"
ON public.favorite_songs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorite songs"
ON public.favorite_songs
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE TABLE public.favorite_song_setlists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  setlist_id UUID NOT NULL UNIQUE REFERENCES public.setlists(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.favorite_song_setlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own favorite song setlist link"
ON public.favorite_song_setlists
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can add own favorite song setlist link"
ON public.favorite_song_setlists
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorite song setlist link"
ON public.favorite_song_setlists
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.ensure_favorite_song_setlist(_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_setlist_id UUID;
BEGIN
  SELECT setlist_id INTO v_setlist_id
  FROM public.favorite_song_setlists
  WHERE user_id = _user_id;

  IF v_setlist_id IS NOT NULL THEN
    RETURN v_setlist_id;
  END IF;

  INSERT INTO public.setlists (
    creator_id,
    title,
    is_public,
    is_collaborative,
    share_token
  )
  VALUES (
    _user_id,
    'Favorite Songs',
    false,
    false,
    gen_random_uuid()::text
  )
  RETURNING id INTO v_setlist_id;

  INSERT INTO public.favorite_song_setlists (user_id, setlist_id)
  VALUES (_user_id, v_setlist_id)
  ON CONFLICT (user_id) DO UPDATE
  SET setlist_id = EXCLUDED.setlist_id;

  RETURN v_setlist_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_favorite_song_setlist()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_setlist_id UUID;
  v_position INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_setlist_id := public.ensure_favorite_song_setlist(NEW.user_id);

    IF NOT EXISTS (
      SELECT 1
      FROM public.setlist_slots
      WHERE setlist_id = v_setlist_id
        AND song_id = NEW.song_id
    ) THEN
      SELECT COALESCE(MAX(position), -1) + 1
      INTO v_position
      FROM public.setlist_slots
      WHERE setlist_id = v_setlist_id
        AND set_number = 1;

      INSERT INTO public.setlist_slots (
        setlist_id,
        song_id,
        set_number,
        position,
        added_by_user_id,
        notes,
        segue_to_next
      )
      VALUES (
        v_setlist_id,
        NEW.song_id,
        1,
        v_position,
        NEW.user_id,
        'Auto-added from favorite songs',
        false
      );
    END IF;

    RETURN NEW;
  END IF;

  SELECT setlist_id INTO v_setlist_id
  FROM public.favorite_song_setlists
  WHERE user_id = OLD.user_id;

  IF v_setlist_id IS NOT NULL THEN
    DELETE FROM public.setlist_slots
    WHERE setlist_id = v_setlist_id
      AND song_id = OLD.song_id;

    WITH ordered AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY position, id) - 1 AS next_position
      FROM public.setlist_slots
      WHERE setlist_id = v_setlist_id
        AND set_number = 1
    )
    UPDATE public.setlist_slots AS slots
    SET position = ordered.next_position
    FROM ordered
    WHERE slots.id = ordered.id;
  END IF;

  RETURN OLD;
END;
$$;

CREATE TRIGGER sync_favorite_song_setlist_after_insert
AFTER INSERT ON public.favorite_songs
FOR EACH ROW
EXECUTE FUNCTION public.sync_favorite_song_setlist();

CREATE TRIGGER sync_favorite_song_setlist_after_delete
AFTER DELETE ON public.favorite_songs
FOR EACH ROW
EXECUTE FUNCTION public.sync_favorite_song_setlist();