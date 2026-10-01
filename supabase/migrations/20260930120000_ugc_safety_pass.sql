-- UGC safety pass — App Store guideline 1.2, rejected a second time 2026-09-30.
--
-- The 2026-08-07 kit (20260807053501) gave reports, blocks and an admin
-- queue. Apple's checklist asks for more than that, and this migration is the
-- database half of each missing piece:
--
--   1. a method for filtering objectionable content   -> is_objectionable() + triggers
--   2. blocking removes the blocked user's content
--      from the blocker's feed instantly              -> RESTRICTIVE SELECT policies
--   3. blocking notifies the developer                -> blocked_users -> content_reports
--   4. the developer acts on reports within 24 hours  -> every report emails the admins
--
-- The removal and ejection actions themselves live in the admin-users edge
-- function (action=moderate), because banning goes through the auth admin API.

-- ---------------------------------------------------------------------------
-- 1) Filter
-- ---------------------------------------------------------------------------
-- Mirrors OBJECTIONABLE_TERMS in src/lib/contentFilter.ts, one term per line;
-- src/lib/__tests__/contentFilterSync.test.ts fails if the two drift. To add a
-- term, change both — in a NEW migration, since this one is append-only once
-- merged.
CREATE OR REPLACE FUNCTION public.objectionable_terms()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY[
    'nigger',
    'nigga',
    'faggot',
    'fag',
    'tranny',
    'retard',
    'wetback',
    'gook',
    'raghead',
    'towelhead',
    'beaner',
    'porn',
    'porno',
    'blowjob',
    'handjob',
    'cumshot',
    'dildo',
    'pussy',
    'cunt',
    'twat',
    'whore',
    'slut',
    'fuck',
    'motherfucker',
    'bitch',
    'asshole',
    'kys',
    'kill yourself',
    'kill urself',
    'heil hitler',
    'sieg heil'
  ]::text[]
$$;

-- Same construction as the client: each letter may repeat, a space in a
-- phrase matches any run of non-letters, whole words only, a few suffixes.
-- One difference: the client also strips accents; Postgres here does not, so
-- "fück" is caught in the app and not by a direct API write.
CREATE OR REPLACE FUNCTION public.is_objectionable(p_text text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_alternatives text;
BEGIN
  IF p_text IS NULL OR p_text = '' THEN
    RETURN false;
  END IF;

  SELECT string_agg(
           array_to_string(
             ARRAY(
               SELECT regexp_replace(w.word, '([a-z])', '\1+', 'g')
               FROM unnest(string_to_array(t.term, ' ')) WITH ORDINALITY AS w(word, ord)
               ORDER BY w.ord
             ),
             '[^a-z]+'
           ),
           '|'
         )
    INTO v_alternatives
    FROM unnest(public.objectionable_terms()) AS t(term);

  RETURN translate(lower(p_text), '013457@$!', 'oieastasi')
    ~ ('(?<![a-z])(?:' || v_alternatives || ')(?:s|es|ed|er|ers|ing|in)?(?![a-z])');
END;
$$;

-- Checks the columns named in the trigger arguments. On UPDATE a column whose
-- value did not change is skipped, so text that predates the filter never
-- blocks an unrelated edit (a play-count bump, an avatar change).
CREATE OR REPLACE FUNCTION public.reject_objectionable_text()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_col text;
  v_new jsonb := to_jsonb(NEW);
  v_old jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END;
BEGIN
  FOREACH v_col IN ARRAY TG_ARGV LOOP
    IF TG_OP = 'UPDATE' AND (v_old ->> v_col) IS NOT DISTINCT FROM (v_new ->> v_col) THEN
      CONTINUE;
    END IF;
    IF public.is_objectionable(v_new ->> v_col) THEN
      RAISE EXCEPTION 'objectionable_content'
        USING ERRCODE = 'check_violation',
              DETAIL = format('%s.%s', TG_TABLE_NAME, v_col);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS filter_objectionable_text ON public.setlists;
CREATE TRIGGER filter_objectionable_text
  BEFORE INSERT OR UPDATE OF title, description ON public.setlists
  FOR EACH ROW EXECUTE FUNCTION public.reject_objectionable_text('title', 'description');

DROP TRIGGER IF EXISTS filter_objectionable_text ON public.setlist_comments;
CREATE TRIGGER filter_objectionable_text
  BEFORE INSERT OR UPDATE OF content ON public.setlist_comments
  FOR EACH ROW EXECUTE FUNCTION public.reject_objectionable_text('content');

DROP TRIGGER IF EXISTS filter_objectionable_text ON public.direct_messages;
CREATE TRIGGER filter_objectionable_text
  BEFORE INSERT OR UPDATE OF content ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION public.reject_objectionable_text('content');

DROP TRIGGER IF EXISTS filter_objectionable_text ON public.chat_messages;
CREATE TRIGGER filter_objectionable_text
  BEFORE INSERT OR UPDATE OF content ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.reject_objectionable_text('content');

-- UPDATE only. handle_new_user() inserts the profile inside the auth.users
-- insert, seeding display_name from the Google/Apple name — raising there
-- would abort the signup itself. A name the fan chooses is checked.
DROP TRIGGER IF EXISTS filter_objectionable_text ON public.profiles;
CREATE TRIGGER filter_objectionable_text
  BEFORE UPDATE OF display_name ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.reject_objectionable_text('display_name');

-- ---------------------------------------------------------------------------
-- 2) Blocking removes the blocked user's content from the blocker's view
-- ---------------------------------------------------------------------------
-- RESTRICTIVE, so it is ANDed with the existing permissive policies rather
-- than widening them. Anonymous visitors have no block list and are
-- untouched. Every feed (Browse, the landing page, a user's library, the
-- setlist page itself) reads these tables directly, so this one rule covers
-- all of them — no component has to remember to filter.
DROP POLICY IF EXISTS "Blocked creators' setlists are hidden from blockers" ON public.setlists;
CREATE POLICY "Blocked creators' setlists are hidden from blockers"
ON public.setlists AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  NOT EXISTS (
    SELECT 1 FROM public.blocked_users b
    WHERE b.blocker_id = (SELECT auth.uid()) AND b.blocked_id = setlists.creator_id
  )
);

DROP POLICY IF EXISTS "Blocked commenters are hidden from blockers" ON public.setlist_comments;
CREATE POLICY "Blocked commenters are hidden from blockers"
ON public.setlist_comments AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  NOT EXISTS (
    SELECT 1 FROM public.blocked_users b
    WHERE b.blocker_id = (SELECT auth.uid()) AND b.blocked_id = setlist_comments.user_id
  )
);

-- ---------------------------------------------------------------------------
-- 3) Blocking notifies the developer
-- ---------------------------------------------------------------------------
-- A block files a profile report on the blocked user, which lands in the
-- moderation queue and (via 4) in the admin inbox. AFTER INSERT only: the
-- client upserts, and re-blocking someone already blocked takes the UPDATE
-- path, so it does not file a duplicate.
CREATE OR REPLACE FUNCTION public.report_on_block()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.content_reports (reporter_id, content_type, content_id, reason)
  VALUES (NEW.blocker_id, 'profile', NEW.blocked_id, 'Blocked by a member. Review their recent setlists, comments and messages.');
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.report_on_block() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS report_on_block ON public.blocked_users;
CREATE TRIGGER report_on_block
  AFTER INSERT ON public.blocked_users
  FOR EACH ROW EXECUTE FUNCTION public.report_on_block();

-- ---------------------------------------------------------------------------
-- 4) Every report reaches a human the moment it is filed
-- ---------------------------------------------------------------------------
-- Before this, a report sat in content_reports until someone happened to
-- open /admin. The one report filed during the 2026-09-24 resubmission was
-- still open six days later. Same delivery path as handle_new_user_emails:
-- pg_net -> send-transactional-email, with the service key and URL from the
-- vault. A failure to send never fails the report itself.
CREATE OR REPLACE FUNCTION public.notify_moderation_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'vault'
AS $$
DECLARE
  v_service_key text;
  v_function_url text;
  v_excerpt text;
  v_admin_recipient text;
  v_admin_recipients text[] := ARRAY['eljaguaro@gmail.com'];
BEGIN
  SELECT decrypted_secret INTO v_service_key
  FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1;

  SELECT decrypted_secret INTO v_function_url
  FROM vault.decrypted_secrets WHERE name = 'send_transactional_email_url' LIMIT 1;

  IF v_service_key IS NULL OR v_function_url IS NULL THEN
    RAISE WARNING 'notify_moderation_report: missing vault secret(s); skipping';
    RETURN NEW;
  END IF;

  v_excerpt := CASE NEW.content_type
    WHEN 'setlist' THEN (SELECT title FROM public.setlists WHERE id = NEW.content_id)
    WHEN 'comment' THEN (SELECT content FROM public.setlist_comments WHERE id = NEW.content_id)
    WHEN 'message' THEN (SELECT content FROM public.direct_messages WHERE id = NEW.content_id)
    WHEN 'profile' THEN (SELECT display_name FROM public.profiles WHERE user_id = NEW.content_id)
  END;

  FOREACH v_admin_recipient IN ARRAY v_admin_recipients LOOP
    BEGIN
      PERFORM net.http_post(
        url := v_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_key
        ),
        body := jsonb_build_object(
          'templateName', 'moderation-report',
          'recipientEmail', v_admin_recipient,
          'idempotencyKey', 'moderation-report-' || NEW.id::text || '-' || v_admin_recipient,
          'templateData', jsonb_build_object(
            'contentType', NEW.content_type,
            'reason', NEW.reason,
            'excerpt', left(v_excerpt, 280),
            'reportedAt', to_char(NEW.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
          )
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_moderation_report failed for % to %: %', NEW.id, v_admin_recipient, SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_moderation_report() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS notify_moderation_report ON public.content_reports;
CREATE TRIGGER notify_moderation_report
  AFTER INSERT ON public.content_reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_moderation_report();
