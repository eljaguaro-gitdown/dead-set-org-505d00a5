SELECT cron.schedule(
  'weekly-insights-report',
  '0 18 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://dplrumaqrdnzwzqmatqr.supabase.co/functions/v1/weekly-insights-report',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwbHJ1bWFxcmRuend6cW1hdHFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NzM1MTUsImV4cCI6MjA4OTQ0OTUxNX0.0SkPztsLU_j2mVb7O0BF3P3Fi-Nj2Xx6ZFDkYYvbsz4"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);