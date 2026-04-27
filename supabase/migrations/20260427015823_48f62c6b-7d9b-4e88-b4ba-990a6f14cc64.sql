CREATE OR REPLACE FUNCTION public.handle_new_user_emails()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'vault'
AS $function$
DECLARE
  v_display_name text;
  v_provider text;
  v_recipient text;
  v_service_key text;
  v_function_url text;
  v_auth_header jsonb;
  v_admin_recipient text;
  v_admin_recipients text[] := ARRAY['grateful_jaguaro@dead-set.org', 'eljaguaro@gmail.com'];
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

  -- Admin notification (one per recipient, idempotency keyed per address)
  FOREACH v_admin_recipient IN ARRAY v_admin_recipients LOOP
    BEGIN
      PERFORM net.http_post(
        url := v_function_url,
        headers := v_auth_header,
        body := jsonb_build_object(
          'templateName', 'new-signup-notification',
          'recipientEmail', v_admin_recipient,
          'idempotencyKey', 'new-signup-notify-' || NEW.id::text || '-' || v_admin_recipient,
          'templateData', jsonb_build_object(
            'userEmail', v_recipient,
            'displayName', v_display_name,
            'provider', v_provider,
            'signupTime', to_char(NEW.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
          )
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'handle_new_user_emails admin http_post failed for % to %: %', NEW.id, v_admin_recipient, SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$function$;