-- Restore grateful_jaguaro@dead-set.org to the signup-alert fan-out.
--
-- APPLIED MANUALLY on 2026-11-20 via the Lovable query_database tool against
-- production. Recorded here for provenance; idempotent and safe to replay
-- (it rewrites only the recipient array, and does nothing if it is already
-- in the restored form).
--
-- WHY
-- 20260814015901 cut the handle_new_user_emails trigger to Gmail only while
-- @dead-set.org was bouncing (DKIM gap). That was never undone. Since then
-- the dead-set.org copy came only from the useAuth client backfill, which
-- fires only when SIGNED_IN lands within 60 s of account creation: Google
-- and Apple always, email sign-ups only when the fan confirms inside a
-- minute. 2026-11-20 andrees@rocketmail.com confirmed after 84 s, so the
-- alert reached eljaguaro@gmail.com and never reached dead-set.org.
--
-- Safe to restore: 8 new-signup-notification sends to dead-set.org between
-- 2026-09-21 and 2026-10-31, all 'sent', no bounces, no suppression row.
-- Idempotency keys are per address and match the client backfill's, so an
-- address cannot be alerted twice for one signup.

DO $$
DECLARE d text;
BEGIN
  SELECT pg_get_functiondef('public.handle_new_user_emails()'::regprocedure) INTO d;
  IF position($q$ARRAY['eljaguaro@gmail.com']$q$ in d) > 0 THEN
    d := replace(
      d,
      $q$ARRAY['eljaguaro@gmail.com']$q$,
      $q$ARRAY['eljaguaro@gmail.com', 'grateful_jaguaro@dead-set.org']$q$
    );
    EXECUTE d;
  END IF;
END $$;
