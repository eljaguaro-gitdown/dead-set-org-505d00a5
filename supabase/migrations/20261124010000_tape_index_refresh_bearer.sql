-- tape-index-refresh: send a credential index-tapes can actually check (#155).
--
-- The job added in 20261107011000 proves itself with x-dead-set-internal, a
-- hash of the vault secret email_queue_service_role_key. index-tapes compares
-- it with a hash of its OWN key, SUPABASE_SERVICE_ROLE_KEY, and the two are
-- different service-role keys (the split _shared/requireAdmin.ts records as
-- #102). Every refresh since the function deployed was refused 401, and the
-- index stopped at the sprint's seed of 2026-11-07: 700 rows then, 6 since,
-- all written by fans' taps.
--
-- The job now also sends the vault key as the bearer, which index-tapes
-- proves with Supabase (refreshAuth.ts), the check the database's email
-- triggers already pass. The header stays, so the job keeps working against
-- an index-tapes that predates the fix until the new one is deployed.
--
-- Replay-safe: it only reschedules the job by name, and only if pg_cron and
-- pg_net are present. No table is touched.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_extension where extname = 'pg_net') then
    perform cron.unschedule('tape-index-refresh')
      where exists (select 1 from cron.job where jobname = 'tape-index-refresh');
    perform cron.schedule(
      'tape-index-refresh',
      '23 * * * *',
      $cron$
        select net.http_post(
          url := replace(
            (select decrypted_secret from vault.decrypted_secrets where name = 'send_transactional_email_url'),
            'send-transactional-email', 'index-tapes'),
          headers := jsonb_build_object(
            'content-type', 'application/json',
            'authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'email_queue_service_role_key'),
            'x-dead-set-internal', encode(extensions.digest(
              'index-tapes:' || (select decrypted_secret from vault.decrypted_secrets where name = 'email_queue_service_role_key'),
              'sha256'), 'hex')),
          body := '{"mode":"refresh","limit":40}'::jsonb,
          timeout_milliseconds := 150000
        );
      $cron$
    );
  end if;
end $$;
