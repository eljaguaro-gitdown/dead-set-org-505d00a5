
-- 1) Remove admin from suppressed list
DELETE FROM public.suppressed_emails
WHERE email = 'grateful_jaguaro@dead-set.org';

-- 2) Server-side signup email trigger
-- Enqueues welcome email + admin notification directly into the transactional_emails pgmq queue.
-- This bypasses the unreliable client-side dispatch and works for every provider.

CREATE OR REPLACE FUNCTION public.handle_new_user_emails()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_display_name text;
  v_provider text;
  v_recipient text;
BEGIN
  v_display_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1),
    'Deadhead'
  );

  v_provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');
  v_recipient := NEW.email;

  -- Welcome email to the new user (only if they have an email)
  IF v_recipient IS NOT NULL AND length(v_recipient) > 0 THEN
    BEGIN
      PERFORM public.enqueue_email(
        'transactional_emails',
        jsonb_build_object(
          'templateName', 'welcome-email',
          'recipientEmail', v_recipient,
          'idempotencyKey', 'welcome-' || NEW.id::text,
          'templateData', jsonb_build_object(
            'displayName', v_display_name
          )
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'handle_new_user_emails welcome enqueue failed for %: %', NEW.id, SQLERRM;
    END;
  END IF;

  -- Admin notification
  BEGIN
    PERFORM public.enqueue_email(
      'transactional_emails',
      jsonb_build_object(
        'templateName', 'new-signup-notification',
        'recipientEmail', 'grateful_jaguaro@dead-set.org',
        'idempotencyKey', 'new-signup-notify-' || NEW.id::text,
        'templateData', jsonb_build_object(
          'userEmail', v_recipient,
          'displayName', v_display_name,
          'provider', v_provider,
          'signupTime', to_char(NEW.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
        )
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user_emails admin enqueue failed for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_emails ON auth.users;
CREATE TRIGGER on_auth_user_created_emails
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_emails();
