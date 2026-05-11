CREATE OR REPLACE FUNCTION public.send_featured_setlist_email_today()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault, auth
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'UTC')::date;
  v_setlist_id uuid;
  v_creator_id uuid;
  v_setlist_title text;
  v_recipient text;
  v_display_name text;
  v_service_key text;
  v_function_url text;
  v_supabase_url text;
  v_poster_url text;
BEGIN
  -- Ensure today's spotlight is computed/inserted
  PERFORM public.get_hero_spotlight();

  SELECT s.setlist_id INTO v_setlist_id
  FROM public.hero_spotlights s
  WHERE s.spotlight_date = v_today;

  IF v_setlist_id IS NULL THEN RETURN; END IF;

  SELECT sl.creator_id, sl.title INTO v_creator_id, v_setlist_title
  FROM public.setlists sl WHERE sl.id = v_setlist_id;

  SELECT u.email INTO v_recipient FROM auth.users u WHERE u.id = v_creator_id;
  SELECT p.display_name INTO v_display_name FROM public.profiles p WHERE p.user_id = v_creator_id;

  SELECT decrypted_secret INTO v_service_key
  FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1;
  SELECT decrypted_secret INTO v_function_url
  FROM vault.decrypted_secrets WHERE name = 'send_transactional_email_url' LIMIT 1;

  v_supabase_url := regexp_replace(COALESCE(v_function_url, ''), '/functions/v1/.*$', '');
  v_poster_url := v_supabase_url || '/functions/v1/og-image?id=' || v_setlist_id::text || '&format=image';

  IF v_recipient IS NULL OR v_service_key IS NULL OR v_function_url IS NULL THEN RETURN; END IF;

  PERFORM net.http_post(
    url := v_function_url,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_service_key),
    body := jsonb_build_object(
      'templateName','featured-setlist',
      'recipientEmail',v_recipient,
      'idempotencyKey','featured-setlist-'||to_char(v_today,'YYYY-MM-DD')||'-'||v_setlist_id::text,
      'templateData', jsonb_build_object(
        'displayName', COALESCE(v_display_name, split_part(v_recipient,'@',1), 'Deadhead'),
        'setlistTitle', v_setlist_title,
        'setlistId', v_setlist_id::text,
        'posterImageUrl', v_poster_url
      )
    )
  );
END;
$$;