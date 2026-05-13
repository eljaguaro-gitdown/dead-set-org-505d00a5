-- 1. Playability table
CREATE TABLE IF NOT EXISTS public.setlist_slot_playability (
  slot_id uuid PRIMARY KEY REFERENCES public.setlist_slots(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('playable','unresolved','error')),
  direct_track_url text,
  match_score integer,
  checked_at timestamptz NOT NULL DEFAULT now(),
  error_message text
);

CREATE INDEX IF NOT EXISTS idx_slot_playability_checked
  ON public.setlist_slot_playability (checked_at);
CREATE INDEX IF NOT EXISTS idx_slot_playability_status
  ON public.setlist_slot_playability (status);

ALTER TABLE public.setlist_slot_playability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Playability readable with public setlists"
  ON public.setlist_slot_playability FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.setlist_slots ss
      WHERE ss.id = setlist_slot_playability.slot_id
        AND (
          public.is_setlist_public(ss.setlist_id)
          OR public.is_setlist_owner(auth.uid(), ss.setlist_id)
          OR public.is_setlist_collaborator(auth.uid(), ss.setlist_id)
        )
    )
  );

CREATE POLICY "Service role manages playability"
  ON public.setlist_slot_playability FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- 2. Cached count on setlists
ALTER TABLE public.setlists
  ADD COLUMN IF NOT EXISTS playable_slot_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_setlists_playable_count
  ON public.setlists (playable_slot_count);

-- 3. Recompute trigger
CREATE OR REPLACE FUNCTION public.recompute_setlist_playable_count(_setlist_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.setlists
  SET playable_slot_count = (
    SELECT count(*)
    FROM public.setlist_slots ss
    JOIN public.setlist_slot_playability sp ON sp.slot_id = ss.id
    WHERE ss.setlist_id = _setlist_id
      AND sp.status = 'playable'
  )
  WHERE id = _setlist_id;
$$;

CREATE OR REPLACE FUNCTION public.trg_playability_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_setlist_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT setlist_id INTO v_setlist_id FROM public.setlist_slots WHERE id = OLD.slot_id;
  ELSE
    SELECT setlist_id INTO v_setlist_id FROM public.setlist_slots WHERE id = NEW.slot_id;
  END IF;
  IF v_setlist_id IS NOT NULL THEN
    PERFORM public.recompute_setlist_playable_count(v_setlist_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS playability_changed ON public.setlist_slot_playability;
CREATE TRIGGER playability_changed
  AFTER INSERT OR UPDATE OR DELETE ON public.setlist_slot_playability
  FOR EACH ROW EXECUTE FUNCTION public.trg_playability_changed();

-- When a slot is removed, recompute its setlist (the playability row cascades away first)
CREATE OR REPLACE FUNCTION public.trg_slot_deleted_recount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.recompute_setlist_playable_count(OLD.setlist_id);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS slot_deleted_recount ON public.setlist_slots;
CREATE TRIGGER slot_deleted_recount
  AFTER DELETE ON public.setlist_slots
  FOR EACH ROW EXECUTE FUNCTION public.trg_slot_deleted_recount();

-- 4. Hero spotlight uses the precomputed count
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
  )
  SELECT sl.id INTO v_setlist_id
  FROM public.setlists sl
  JOIN ranked_creators rc ON rc.creator_id = sl.creator_id
  LEFT JOIN creator_last_feature clf ON clf.creator_id = sl.creator_id
  LEFT JOIN setlist_last_feature slf ON slf.sl_id = sl.id
  WHERE sl.is_public = true AND sl.playable_slot_count >= 3
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
      v_supabase_url := regexp_replace(COALESCE(v_function_url, ''), '/functions/v1/.*$', '');
      v_poster_url := v_supabase_url || '/functions/v1/og-image?id=' || v_setlist_id::text || '&format=image';

      IF v_recipient IS NOT NULL AND length(v_recipient) > 0
         AND v_service_key IS NOT NULL AND v_function_url IS NOT NULL THEN
        PERFORM net.http_post(
          url := v_function_url,
          headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_service_key),
          body := jsonb_build_object(
            'template','featured-setlist','to',v_recipient,
            'props', jsonb_build_object(
              'displayName', COALESCE(v_display_name,'Deadhead'),
              'setlistTitle', v_setlist_title,
              'setlistId', v_setlist_id::text,
              'posterUrl', v_poster_url
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

-- 5. Selector for the precompute job: slots needing (re)check
CREATE OR REPLACE FUNCTION public.next_slots_to_check(_limit integer DEFAULT 50, _stale_days integer DEFAULT 7)
RETURNS TABLE(slot_id uuid, archive_org_url text, song_title text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT ss.id, nv.archive_org_url, sg.title
  FROM public.setlist_slots ss
  JOIN public.setlists sl ON sl.id = ss.setlist_id
  JOIN public.notable_versions nv ON nv.id = ss.notable_version_id
  JOIN public.songs sg ON sg.id = ss.song_id
  LEFT JOIN public.setlist_slot_playability sp ON sp.slot_id = ss.id
  WHERE nv.archive_org_url IS NOT NULL
    AND sl.is_public = true
    AND (sp.checked_at IS NULL OR sp.checked_at < now() - (_stale_days || ' days')::interval)
  ORDER BY sp.checked_at ASC NULLS FIRST, ss.id
  LIMIT _limit;
$$;

REVOKE EXECUTE ON FUNCTION public.next_slots_to_check(integer, integer) FROM PUBLIC, anon, authenticated;