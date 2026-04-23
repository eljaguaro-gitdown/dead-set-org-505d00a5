ALTER TABLE public.favorite_songs
  DROP CONSTRAINT IF EXISTS favorite_songs_user_id_song_id_key;

ALTER TABLE public.favorite_songs
  ADD COLUMN IF NOT EXISTS notable_version_id UUID REFERENCES public.notable_versions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS version_show_date TEXT,
  ADD COLUMN IF NOT EXISTS version_venue TEXT,
  ADD COLUMN IF NOT EXISTS version_archive_org_url TEXT,
  ADD COLUMN IF NOT EXISTS version_rating INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS favorite_songs_unique_base_song_idx
ON public.favorite_songs (user_id, song_id)
WHERE notable_version_id IS NULL
  AND version_show_date IS NULL
  AND version_venue IS NULL
  AND version_archive_org_url IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS favorite_songs_unique_notable_version_idx
ON public.favorite_songs (user_id, song_id, notable_version_id)
WHERE notable_version_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS favorite_songs_unique_archive_version_idx
ON public.favorite_songs (
  user_id,
  song_id,
  COALESCE(version_show_date, ''),
  COALESCE(version_venue, ''),
  COALESCE(version_archive_org_url, '')
)
WHERE notable_version_id IS NULL
  AND (
    version_show_date IS NOT NULL
    OR version_venue IS NOT NULL
    OR version_archive_org_url IS NOT NULL
  );

ALTER TABLE public.setlist_slots
  ADD COLUMN IF NOT EXISTS favorite_song_id UUID UNIQUE;

CREATE OR REPLACE FUNCTION public.sync_favorite_song_setlist()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_setlist_id UUID;
  v_position INTEGER;
  v_notes TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_setlist_id := public.ensure_favorite_song_setlist(NEW.user_id);

    IF EXISTS (
      SELECT 1
      FROM public.setlist_slots
      WHERE favorite_song_id = NEW.id
    ) THEN
      RETURN NEW;
    END IF;

    SELECT COALESCE(MAX(position), -1) + 1
    INTO v_position
    FROM public.setlist_slots
    WHERE setlist_id = v_setlist_id
      AND set_number = 1;

    v_notes := 'Auto-added from favorite songs';

    IF NEW.notable_version_id IS NULL
      AND (
        NEW.version_show_date IS NOT NULL
        OR NEW.version_venue IS NOT NULL
        OR NEW.version_archive_org_url IS NOT NULL
      ) THEN
      v_notes := json_build_object(
        '__archive', true,
        'show_date', NEW.version_show_date,
        'venue', NEW.version_venue,
        'archive_org_url', NEW.version_archive_org_url,
        'rating', NEW.version_rating
      )::text || E'\nAuto-added from favorite songs';
    END IF;

    INSERT INTO public.setlist_slots (
      setlist_id,
      song_id,
      notable_version_id,
      set_number,
      position,
      added_by_user_id,
      notes,
      segue_to_next,
      favorite_song_id
    )
    VALUES (
      v_setlist_id,
      NEW.song_id,
      NEW.notable_version_id,
      1,
      v_position,
      NEW.user_id,
      v_notes,
      false,
      NEW.id
    );

    RETURN NEW;
  END IF;

  SELECT setlist_id INTO v_setlist_id
  FROM public.favorite_song_setlists
  WHERE user_id = OLD.user_id;

  IF v_setlist_id IS NOT NULL THEN
    DELETE FROM public.setlist_slots
    WHERE favorite_song_id = OLD.id;

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