CREATE OR REPLACE FUNCTION public.get_hero_spotlight()
 RETURNS TABLE(setlist_id uuid, spotlight_date date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  v_today date := (now() AT TIME ZONE 'UTC')::date;
  v_setlist_id uuid;
  v_inserted boolean := false;
  v_creator_id uuid;
  v_setlist_title text;
  v_recipient text;
  v_display_name text;
  v_service_key text;
  v_function_url text;
  v_backend_url text;
  v_poster_url text;
BEGIN
  SELECT s.setlist_id INTO v_setlist_id
  FROM public.hero_spotlights s
  JOIN public.setlists sl ON sl.id = s.setlist_id
  WHERE s.spotlight_date = v_today
    AND sl.is_public = true
    AND sl.playable_slot_count >= 3;

  IF v_setlist_id IS NOT NULL THEN
    RETURN QUERY SELECT v_setlist_id, v_today;
    RETURN;
  END IF;

  DELETE FROM public.hero_spotlights s
  USING public.setlists sl
  WHERE s.spotlight_date = v_today
    AND sl.id = s.setlist_id
    AND (sl.is_public IS DISTINCT FROM true OR sl.playable_slot_count < 3);

  WITH creator_activity AS (
    SELECT
      sl.creator_id,
      SUM(COALESCE(sl.play_count, 0) + COALESCE(sl.upvote_count, 0)) AS activity_score,
      COUNT(*) AS public_setlist_count,
      MIN(sl.created_at) AS first_setlist_at
    FROM public.setlists sl
    WHERE sl.is_public = true AND sl.playable_slot_count >= 3
    GROUP BY sl.creator_id
  ),
  ranked_creators AS (
    SELECT creator_id,
      ROW_NUMBER() OVER (ORDER BY activity_score DESC, public_setlist_count DESC, first_setlist_at ASC) AS creator_rank
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
  ),
  eligible AS (
    SELECT sl.id,
           rc.creator_rank,
           clf.creator_last_featured,
           slf.last_featured,
           sl.created_at,
           CASE
             WHEN slf.last_featured IS NULL OR slf.last_featured < v_today - INTERVAL '7 days'
             THEN 0 ELSE 1
           END AS featured_recently
    FROM public.setlists sl
    JOIN ranked_creators rc ON rc.creator_id = sl.creator_id
    LEFT JOIN creator_last_feature clf ON clf.creator_id = sl.creator_id
    LEFT JOIN setlist_last_feature slf ON slf.sl_id = sl.id
    WHERE sl.is_public = true AND sl.playable_slot_count >= 3
  )
  SELECT id INTO v_setlist_id
  FROM eligible
  ORDER BY
    featured_recently ASC,
    creator_last_featured ASC NULLS FIRST,
    creator_rank ASC,
    last_featured ASC NULLS FIRST,
    created_at ASC,
    id ASC
  LIMIT 1;

  IF v_setlist_id IS NULL THEN
    RETURN;
  END IF;

  WITH ins AS (
    INSERT INTO public.hero_spotlights AS hs (spotlight_date, setlist_id)
    VALUES (v_today, v_setlist_id)
    ON CONFLICT (spotlight_date) DO NOTHING
    RETURNING setlist_id
  )
  SELECT EXISTS (SELECT 1 FROM ins) INTO v_inserted;

  SELECT s.setlist_id INTO v_setlist_id
  FROM public.hero_spotlights s WHERE s.spotlight_date = v_today;

  IF v_inserted THEN
    BEGIN
      SELECT sl.creator_id, sl.title INTO v_creator_id, v_setlist_title
      FROM public.setlists sl WHERE sl.id = v_setlist_id;
      SELECT u.email INTO v_recipient FROM auth.users u WHERE u.id = v_creator_id;
      SELECT p.display_name INTO v_display_name FROM public.profiles p WHERE p.user_id = v_creator_id;
      SELECT decrypted_secret INTO v_service_key
      FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1;
      SELECT decrypted_secret INTO v_function_url
      FROM vault.decrypted_secrets WHERE name = 'send_transactional_email_url' LIMIT 1;
      v_backend_url := regexp_replace(COALESCE(v_function_url, ''), '/functions/v1/.*$', '');
      v_poster_url := v_backend_url || '/functions/v1/og-image?id=' || v_setlist_id::text || '&format=image';

      IF v_recipient IS NOT NULL AND length(v_recipient) > 0
         AND v_service_key IS NOT NULL AND v_function_url IS NOT NULL THEN
        PERFORM net.http_post(
          url := v_function_url,
          headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_service_key),
          body := jsonb_build_object(
            'templateName','featured-setlist',
            'recipientEmail', v_recipient,
            'idempotencyKey','featured-setlist-'||to_char(v_today,'YYYY-MM-DD')||'-'||v_setlist_id::text,
            'templateData', jsonb_build_object(
              'displayName', COALESCE(v_display_name, split_part(v_recipient,'@',1), 'Deadhead'),
              'setlistTitle', v_setlist_title,
              'setlistId', v_setlist_id::text,
              'posterImageUrl', v_poster_url
            )
          )
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'get_hero_spotlight email dispatch failed: %', SQLERRM;
    END;
  END IF;

  RETURN QUERY SELECT v_setlist_id, v_today;
END;
$function$;