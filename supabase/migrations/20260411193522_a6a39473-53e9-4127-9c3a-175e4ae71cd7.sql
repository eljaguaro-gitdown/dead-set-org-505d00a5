INSERT INTO notable_versions (song_id, show_date, venue, city, archive_org_url, rating, description)
VALUES (
  '3ee42f5a-50d5-4127-977c-f5045e946657',
  '1967-05-05',
  'Fillmore Auditorium',
  'San Francisco, CA',
  'https://archive.org/details/gd1967-05-05.126250.sbd.wolfe-smith.flac16',
  5,
  'A psychedelic-era gem from the Fillmore — the Golden Road in its natural habitat, raw and electric.'
);

UPDATE setlist_slots
SET notable_version_id = (
  SELECT id FROM notable_versions
  WHERE song_id = '3ee42f5a-50d5-4127-977c-f5045e946657'
    AND show_date = '1967-05-05'
    AND venue = 'Fillmore Auditorium'
  LIMIT 1
)
WHERE id = '1f803e73-4813-4c36-8413-18eef7e0146f';