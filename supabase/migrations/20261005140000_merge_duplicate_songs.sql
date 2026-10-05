-- ---------------------------------------------------------------------------
-- Six duplicate song rows merged, two truncation artifacts deleted.
--
-- The catalog carried the same song twice under near-identical titles, and
-- two rows that are not songs at all. Found while converting the date columns:
-- the nine rows holding a bare year were disproportionately junk, which is
-- usually a sign that one bad import produced both symptoms.
--
-- 'C.C' and 'U.S' are an importer splitting on the period — the tails of
-- 'C.C. Rider' and 'U.S. Blues'. Neither is referenced by anything.
--
-- WHY MERGE RATHER THAN DELETE
--
-- Every loser below is referenced by setlist_slots, so deleting it outright
-- would orphan somebody's setlist. Worse, three of the five foreign keys to
-- songs are ON DELETE CASCADE (favorite_songs, notable_versions,
-- songbook_entries), so a plain delete would silently take a reader's
-- favourites and a song's catalog versions with it. Every reference is
-- repointed first and the delete only ever runs against a row nothing points
-- at. Verified before writing this: all eight candidates have 0 favorites,
-- 0 features, 0 songbook entries and 0 notable_versions, so setlist_slots is
-- the only table that needs repointing — but the merge is written to be
-- correct regardless, not to depend on that snapshot staying true.
--
-- WHICH ROW WINS
--
-- The one carrying the play history, in every case. The losers are near-empty
-- rows that accumulated a stray slot or two.
--
--   Black Throated Wind      ->  Black-Throated Wind              (0 vs 83 plays)
--   Broke-Down Palace        ->  Brokedown Palace                 (0 vs 227)
--   Good Morning Little
--     Schoolgirl             ->  Good Morning Little School Girl  (0 vs 56)
--   Supplication (dup)       ->  Supplication                     (0 vs 127)
--   US Blues                 ->  U.S. Blues                       (1 vs 323)
--   Baby Blue                ->  Its All Over Now Baby Blue       (46 vs 133)
--
-- The last is on Jay's word: "Its all over now baby blue and baby blue are the
-- same." They are the Dylan song under its full title and its shorthand. Note
-- that 'Its All Over Now' is a SEPARATE row and stays — that is the Bobby
-- Womack song the Stones took to number one, a different piece of music that
-- merely shares a prefix. The prefix heuristic that found these flagged it,
-- and flagging is not deciding.
--
-- For that pair the surviving row takes the UNION of the two date ranges,
-- because both rows describe the same performances and each saw part of them.
-- times_played takes the larger rather than the sum: the same nights counted
-- twice are not twice as many nights.
--
-- Kept deliberately, though the same heuristic flagged them: 'Playing in the
-- Band' / 'Playing in the Band Reprise', 'Scarlet Begonias' / 'Scarlet
-- Begonias > Fire on the Mountain', 'Truckin'' / 'Truckin > Smokestack
-- Lightning'. A reprise and a medley are their own entries.
-- ---------------------------------------------------------------------------

begin;

create temp table song_merges(loser uuid, winner uuid) on commit drop;
insert into song_merges values
  ('2c2f183a-fe76-4ac0-b55b-1c0a7de3e20c', '7c601769-bbba-45d6-93b7-8d192b6f8c8a'), -- Black Throated Wind
  ('a89dc2f6-588c-4fe9-a0b1-db5fddcf3057', '3e7200c7-4825-4e9f-87ff-07d62d00e86a'), -- Broke-Down Palace
  ('987011de-a28f-4a4d-bdb3-f9ae3525f9c3', 'ca15aa42-cf1e-42de-a52b-bceeb9f76fc4'), -- …Schoolgirl
  ('2bfc723b-8ef4-4d87-8919-313f479efc18', '8d67d6bf-0a6b-4a44-846f-317d61b7a026'), -- Supplication
  ('06800414-aeac-422e-acf5-d63100fc2a72', '1e67efec-63af-4b22-9ac7-4e46120ff4ab'), -- US Blues
  ('4b743e9a-1b79-49be-9503-fde3246c7ecc', '64bcc77d-3fc3-431b-8fde-352ad4c8901e'); -- Baby Blue

-- Widen the survivor to cover what the loser knew, before the loser goes.
update public.songs w
   set first_played = least(w.first_played, l.first_played),
       last_played  = greatest(w.last_played, l.last_played),
       times_played = greatest(coalesce(w.times_played, 0), coalesce(l.times_played, 0))
  from song_merges m join public.songs l on l.id = m.loser
 where w.id = m.winner;

-- Repoint every reference. Written for all five foreign keys even where the
-- current data has none, so this stays correct if a row gains one later.
update public.setlist_slots   s set song_id = m.winner from song_merges m where s.song_id = m.loser;
update public.notable_versions v set song_id = m.winner from song_merges m where v.song_id = m.loser;
update public.song_features    f set song_id = m.winner from song_merges m where f.song_id = m.loser;
update public.songbook_entries e set song_id = m.winner from song_merges m where e.song_id = m.loser;

-- favorite_songs carries a (user_id, song_id) uniqueness expectation: a reader
-- who favourited both rows must end with one favourite, not a conflict.
delete from public.favorite_songs f
 using song_merges m
 where f.song_id = m.loser
   and exists (select 1 from public.favorite_songs k
                where k.user_id = f.user_id and k.song_id = m.winner);
update public.favorite_songs f set song_id = m.winner from song_merges m where f.song_id = m.loser;

delete from public.songs using song_merges m where songs.id = m.loser;

-- Not songs: the tails of 'C.C. Rider' and 'U.S. Blues' left by an importer
-- that split on the period. Nothing references either.
delete from public.songs where id in (
  '6b23b19e-bcb6-4d2b-96b1-4787f6d3d737',  -- 'C.C'
  '09cf8ead-a8bd-43c7-8b18-eb6d376bd4cc'   -- 'U.S'
);

commit;
