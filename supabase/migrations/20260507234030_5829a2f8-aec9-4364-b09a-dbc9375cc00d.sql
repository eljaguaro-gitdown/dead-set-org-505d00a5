CREATE OR REPLACE FUNCTION public.get_hero_spotlight()
 RETURNS TABLE(setlist_id uuid, spotlight_date date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_today date := (now() AT TIME ZONE 'UTC')::date;
  v_setlist_id uuid;
BEGIN
  SELECT s.setlist_id INTO v_setlist_id
  FROM public.hero_spotlights s
  WHERE s.spotlight_date = v_today;

  IF v_setlist_id IS NOT NULL THEN
    RETURN QUERY SELECT v_setlist_id, v_today;
    RETURN;
  END IF;

  WITH creator_activity AS (
    SELECT
      sl.creator_id,
      SUM(COALESCE(sl.play_count, 0) + COALESCE(sl.upvote_count, 0)) AS activity_score,
      COUNT(*) AS public_setlist_count,
      MIN(sl.created_at) AS first_setlist_at
    FROM public.setlists sl
    WHERE sl.is_public = true
      AND EXISTS (SELECT 1 FROM public.setlist_slots ss WHERE ss.setlist_id = sl.id)
    GROUP BY sl.creator_id
  ),
  ranked_creators AS (
    SELECT
      creator_id,
      ROW_NUMBER() OVER (
        ORDER BY activity_score DESC, public_setlist_count DESC, first_setlist_at ASC
      ) AS creator_rank
    FROM creator_activity
  ),
  creator_last_feature AS (
    SELECT sl.creator_id, MAX(hs.spotlight_date) AS creator_last_featured
    FROM public.hero_spotlights hs
    JOIN public.setlists sl ON sl.id = hs.setlist_id
    GROUP BY sl.creator_id
  ),
  setlist_last_feature AS (
    SELECT hs.setlist_id AS sl_id, MAX(hs.spotlight_date) AS last_featured
    FROM public.hero_spotlights hs
    GROUP BY hs.setlist_id
  )
  SELECT sl.id INTO v_setlist_id
  FROM public.setlists sl
  JOIN ranked_creators rc ON rc.creator_id = sl.creator_id
  LEFT JOIN creator_last_feature clf ON clf.creator_id = sl.creator_id
  LEFT JOIN setlist_last_feature slf ON slf.sl_id = sl.id
  WHERE sl.is_public = true
    AND EXISTS (SELECT 1 FROM public.setlist_slots ss WHERE ss.setlist_id = sl.id)
  ORDER BY
    clf.creator_last_featured ASC NULLS FIRST,
    rc.creator_rank ASC,
    slf.last_featured ASC NULLS FIRST,
    sl.created_at ASC,
    sl.id ASC
  LIMIT 1;

  IF v_setlist_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.hero_spotlights (spotlight_date, setlist_id)
  VALUES (v_today, v_setlist_id)
  ON CONFLICT (spotlight_date) DO NOTHING;

  SELECT s.setlist_id INTO v_setlist_id
  FROM public.hero_spotlights s
  WHERE s.spotlight_date = v_today;

  RETURN QUERY SELECT v_setlist_id, v_today;
END;
$function$;