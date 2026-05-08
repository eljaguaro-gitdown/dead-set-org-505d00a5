INSERT INTO public.songs (title, tags, is_jam_vehicle, typical_set_position, times_played) VALUES
  ('Attics of My Life', ARRAY['ballad'], false, 'late', 44),
  ('Cassidy', ARRAY['rocker'], true, 'mid', 348),
  ('Iko Iko', ARRAY['rocker'], false, 'mid', 179),
  ('Candyman', ARRAY['ballad'], false, 'early', 273),
  ('Dear Mr. Fantasy', ARRAY['rocker','jam'], true, 'late', 90),
  ('Mountains of the Moon', ARRAY['ballad'], false, 'mid', 26),
  ('Operator', ARRAY['ballad'], false, 'early', 13);

DELETE FROM public.songs s
WHERE s.title IN ('Brokedown Palace', 'Rubin and Cherise', 'New Minglewood Blues')
  AND NOT EXISTS (SELECT 1 FROM public.setlist_slots WHERE song_id = s.id)
  AND NOT EXISTS (SELECT 1 FROM public.notable_versions WHERE song_id = s.id)
  AND NOT EXISTS (SELECT 1 FROM public.favorite_songs WHERE song_id = s.id);

DELETE FROM public.songs
WHERE id IN (
  SELECT id FROM (
    SELECT s.id,
           ROW_NUMBER() OVER (PARTITION BY s.title ORDER BY s.times_played DESC NULLS LAST, s.id) AS rn,
           (SELECT count(*) FROM public.setlist_slots WHERE song_id = s.id)
           + (SELECT count(*) FROM public.notable_versions WHERE song_id = s.id)
           + (SELECT count(*) FROM public.favorite_songs WHERE song_id = s.id) AS refs
    FROM public.songs s
    WHERE s.title = 'Supplication'
  ) t WHERE rn > 1 AND refs = 0
);