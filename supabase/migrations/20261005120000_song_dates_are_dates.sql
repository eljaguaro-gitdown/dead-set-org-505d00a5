-- ---------------------------------------------------------------------------
-- first_played and last_played are dates. Make the column say so.
--
-- They have been `text` since the catalog was imported, and every data defect
-- found on 2026-10-05 traces back to that. Text accepts anything, so the
-- column held three incompatible kinds of value at once:
--
--   '1971-02-19'  a date
--   '1985'        a year, with no month or day
--   and, until this week, a last_played EARLIER than its own first_played
--
-- A `date` column rejects the second by construction and a CHECK rejects the
-- third. Both of those were real bugs this week, not hypotheticals: nine rows
-- carry a bare year, and Reuben and Cherise ended a correction pass with its
-- last night before its first because one value was updated and its partner
-- was not. The database could have refused that and did not.
--
-- SAFE TO RUN: the application only READS these columns. Grepped across src/
-- and supabase/functions/ — seven files read them, none writes. The only
-- writers are migrations and the backfill script, both deliberate.
--
-- TYPES ARE UNAFFECTED: PostgREST serialises `date` as an ISO string, so
-- types.ts keeps `first_played: string | null` and no call site changes.
-- Lexicographic comparison on 'YYYY-MM-DD' is already date order, which is why
-- the existing readers keep working unchanged.
--
-- THE NINE BARE YEARS ARE NULLED, NOT GUESSED.
--
-- Storing '1985' as 1985-01-01 would invent a precision nobody has — the same
-- class of error as the fabricated catalog versions deleted earlier today, and
-- it would read on screen as "first played January 1st" to anyone who looked.
-- A year is not a date. The originals are recorded here so nothing is lost
-- silently:
--
--   C.C                      1985 / 1985
--   C.C. Rider               1985 / 1985
--   Gimme Some Lovin'        1985 / 1985
--   Good Time Blues          1989 / 1989
--   I Will Take You Home     1989 / 1989
--   Keep On Growing          1985 / 1985
--   Let The Good Times Roll  1988 / 1988
--   U.S                      1985 / 1985
--   US Blues                 1988 / 1988
--
-- Four of those titles are their own bug and want a separate pass: 'C.C' and
-- 'U.S' are truncations of 'C.C. Rider' and 'U.S. Blues' (an importer that
-- split on the period), and 'US Blues' duplicates 'U.S. Blues'. Nulling their
-- dates does not fix the titles and is not meant to.
-- ---------------------------------------------------------------------------

begin;

-- 1. A year cannot become a date. Clear it rather than fabricate a day.
update public.songs
   set first_played = null
 where first_played is not null
   and first_played !~ '^\d{4}-\d{2}-\d{2}$';

update public.songs
   set last_played = null
 where last_played is not null
   and last_played !~ '^\d{4}-\d{2}-\d{2}$';

-- 2. Now every surviving value parses, so the cast cannot fail.
alter table public.songs
  alter column first_played type date using first_played::date,
  alter column last_played  type date using last_played::date;

-- 3. A song cannot stop being played before it starts. Written to allow either
-- side to be null, because a song with one known night and one unknown one is
-- a real state; only the contradiction is forbidden.
alter table public.songs
  add constraint songs_first_played_before_last
  check (first_played is null or last_played is null or first_played <= last_played);

comment on column public.songs.first_played is
  'Earliest known performance. A date or null — never a bare year; see migration 20261005120000.';
comment on column public.songs.last_played is
  'Latest known performance. Constrained to be >= first_played.';

commit;
