-- Remove the Lovable-launch attribution report.
--
-- 20260424204101 scheduled lovable-attribution-report-72h to email a 3-day
-- report after the 2026-04-24 Lovable launch. The window closed on 2026-04-27;
-- since then the function has returned {"skipped": true} on every daily run
-- without reading data or sending mail. The function source is deleted in the
-- same change. page_visits / visitor_attribution stay — track-visit still
-- writes them, and the admin dashboard (admin-users, FunnelWidget) reads them.
DO $$
BEGIN
  PERFORM cron.unschedule('lovable-attribution-report-72h')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'lovable-attribution-report-72h');
END $$;
