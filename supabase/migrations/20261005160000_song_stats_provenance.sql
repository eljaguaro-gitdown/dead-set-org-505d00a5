-- ---------------------------------------------------------------------------
-- Record where a song's play statistics came from.
--
-- scripts/backfill-song-stats.mjs fills times_played / first_played /
-- last_played from setlist.fm, whose free API key is licensed for
-- NON-COMMERCIAL use only. If that licence ever stops fitting Dead Set, every
-- row it touched has to come out — and without a per-row marker there is no
-- way to tell those rows from the ones derived from Archive tape evidence on
-- 2026-10-05, or from the original import.
--
-- The script's own header has promised this since it was written ("every row
-- this touches records setlist.fm as its source so the claim and its
-- provenance travel together"). It did not: SOURCE_NAME was declared and
-- printed to the terminal, and the PATCH body carried only the three date
-- fields. This column is what makes that sentence true.
--
-- NULL means "not from setlist.fm" — the original import, or the tape-derived
-- corrections. It deliberately does not try to retro-label those; a column
-- that guesses its own history is worse than one that admits a gap.
--
-- Removal, if it is ever needed, is then one statement:
--   update public.songs
--      set times_played = null, first_played = null, last_played = null,
--          stats_source = null
--    where stats_source = 'setlist.fm';
-- ---------------------------------------------------------------------------

begin;

alter table public.songs add column if not exists stats_source text;

alter table public.songs
  add constraint songs_stats_source_known
  check (stats_source is null or stats_source in ('setlist.fm', 'archive.org'));

comment on column public.songs.stats_source is
  'Provenance of times_played / first_played / last_played. NULL = original import or hand correction. Required so non-commercially-licensed data can be identified and removed.';

commit;
