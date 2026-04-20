
-- 1) Drain the broken test messages currently looping in the queue
DELETE FROM pgmq.q_transactional_emails WHERE msg_id IN (123, 124);

-- 2) Store the send-transactional-email function URL in vault (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'send_transactional_email_url') THEN
    PERFORM vault.create_secret(
      'https://dplrumaqrdnzwzqmatqr.supabase.co/functions/v1/send-transactional-email',
      'send_transactional_email_url'
    );
  END IF;
END$$;

-- 3) Rewrite the trigger function to invoke send-transactional-email via pg_net
CREATE OR REPLACE FUNCTION public.handle_new_user_emails()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_display_name text;
  v_provider text;
  v_recipient text;
  v_service_key text;
  v_function_url text;
  v_auth_header jsonb;
BEGIN
  v_display_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1),
    'Deadhead'
  );
  v_provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');
  v_recipient := NEW.email;

  SELECT decrypted_secret INTO v_service_key
  FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1;

  SELECT decrypted_secret INTO v_function_url
  FROM vault.decrypted_secrets WHERE name = 'send_transactional_email_url' LIMIT 1;

  IF v_service_key IS NULL OR v_function_url IS NULL THEN
    RAISE WARNING 'handle_new_user_emails: missing vault secret(s); skipping';
    RETURN NEW;
  END IF;

  v_auth_header := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || v_service_key
  );

  -- Welcome email
  IF v_recipient IS NOT NULL AND length(v_recipient) > 0 THEN
    BEGIN
      PERFORM net.http_post(
        url := v_function_url,
        headers := v_auth_header,
        body := jsonb_build_object(
          'templateName', 'welcome-email',
          'recipientEmail', v_recipient,
          'idempotencyKey', 'welcome-' || NEW.id::text,
          'templateData', jsonb_build_object('displayName', v_display_name)
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'handle_new_user_emails welcome http_post failed for %: %', NEW.id, SQLERRM;
    END;
  END IF;

  -- Admin notification
  BEGIN
    PERFORM net.http_post(
      url := v_function_url,
      headers := v_auth_header,
      body := jsonb_build_object(
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
    RAISE WARNING 'handle_new_user_emails admin http_post failed for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;
