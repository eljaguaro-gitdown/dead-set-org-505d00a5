DROP VIEW IF EXISTS public.cosmic_charlie_song_frequency;
CREATE VIEW public.cosmic_charlie_song_frequency
WITH (security_invoker = on)
AS
SELECT song_title,
       COUNT(*)::int AS appearances,
       COUNT(DISTINCT COALESCE(user_id::text, visitor_id))::int AS distinct_audiences,
       MAX(generated_at) AS last_generated_at
FROM public.cosmic_charlie_history
WHERE generated_at > now() - interval '7 days'
GROUP BY song_title
ORDER BY appearances DESC;