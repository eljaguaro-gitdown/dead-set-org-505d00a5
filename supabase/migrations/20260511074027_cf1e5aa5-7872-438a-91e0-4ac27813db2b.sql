-- Update get_hero_spotlight to send an email to the setlist creator when a
-- new daily spotlight row is first inserted. Same vault-secret + net.http_post
-- pattern as handle_new_user_emails. Idempotency key includes the spotlight
-- date and setlist id so repeated calls on the same day never double-send.
CREATE OR REPLACE FUNCTION public.get_hero_spotlight()
 RETURNS TABLE(setlist_id uuid, spotlight_date date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'vault', 'auth'
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
  v_supabase_url text;
  v_poster_url text;
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

  -- Insert today's spotlight; track whether WE were the inserter so the
  -- notification only fires once per (date, setlist).
  WITH ins AS (
    INSERT INTO public.hero_spotlights AS hs (spotlight_date, setlist_id)
    VALUES (v_today, v_setlist_id)
    ON CONFLICT (spotlight_date) DO NOTHING
    RETURNING setlist_id
  )
  SELECT EXISTS (SELECT 1 FROM ins) INTO v_inserted;

  -- Re-read in case a concurrent caller won the race.
  SELECT s.setlist_id INTO v_setlist_id
  FROM public.hero_spotlights s
  WHERE s.spotlight_date = v_today;

  -- Fire the notification only if WE inserted the spotlight row.
  IF v_inserted THEN
    BEGIN
      SELECT sl.creator_id, sl.title
        INTO v_creator_id, v_setlist_title
      FROM public.setlists sl
      WHERE sl.id = v_setlist_id;

      SELECT u.email
        INTO v_recipient
      FROM auth.users u
      WHERE u.id = v_creator_id;

      SELECT p.display_name
        INTO v_display_name
      FROM public.profiles p
      WHERE p.user_id = v_creator_id;

      SELECT decrypted_secret INTO v_service_key
      FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1;

      SELECT decrypted_secret INTO v_function_url
      FROM vault.decrypted_secrets WHERE name = 'send_transactional_email_url' LIMIT 1;

      -- Derive the Supabase project URL from the function URL so the og-image
      -- poster link works without a separate vault entry.
      v_supabase_url := regexp_replace(COALESCE(v_function_url, ''), '/functions/v1/.*$', '');
      v_poster_url := v_supabase_url || '/functions/v1/og-image?id=' || v_setlist_id::text || '&format=image';

      IF v_recipient IS NULL OR length(v_recipient) = 0
         OR v_service_key IS NULL OR v_function_url IS NULL THEN
        RAISE WARNING 'get_hero_spotlight: missing recipient/secret(s); skipping email';
      ELSE
        PERFORM net.http_post(
          url := v_function_url,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key
          ),
          body := jsonb_build_object(
            'templateName', 'featured-setlist',
            'recipientEmail', v_recipient,
            'idempotencyKey', 'featured-setlist-' || to_char(v_today, 'YYYY-MM-DD') || '-' || v_setlist_id::text,
            'templateData', jsonb_build_object(
              'displayName', COALESCE(v_display_name, split_part(v_recipient, '@', 1), 'Deadhead'),
              'setlistTitle', v_setlist_title,
              'setlistId', v_setlist_id::text,
              'posterImageUrl', v_poster_url
            )
          )
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'get_hero_spotlight notification failed: %', SQLERRM;
    END;
  END IF;

  RETURN QUERY SELECT v_setlist_id, v_today;
END;
$function$;