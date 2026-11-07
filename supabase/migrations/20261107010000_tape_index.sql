-- tape_index: which track of which Archive item is a song on a night, known
-- BEFORE anyone taps. The playback sprint's main fix (docs/playback-sprint).
--
-- Until this, every tap on a Songbook night, a version-picker row, the
-- landing "pick a song" flow or a guide's night asked the Archive at tap
-- time: an advancedsearch query, then the full metadata of up to ten items,
-- then the title match, then the /download/ redirect. Each fetch had a 12 s
-- cap and a retry; the player's own watchdog gave up at 25 s. Only saved
-- setlist slots were precomputed (setlist_slot_playability). This table
-- generalises that to the key the product actually offers: a song on a night.
--
-- One row per (song, night, item):
--   status playable  this item carries the song; track_url is the
--                    /download/ address (the canonical identity the rest of
--                    the app keys on), servers are the item's own server
--                    roots, so the player can stream without the redirect.
--   status no_match  recordings of the night exist and none carries the song
--                    (identifier = ''), e.g. a guide naming a night the band
--                    did not play it.
--   status no_tape   the Archive lists no Grateful Dead recording of the
--                    night at all (identifier = '').
-- is_default marks the row the by-night lookup answers with (most-downloaded
-- item that carries the song). "Could not ask the Archive" is never stored —
-- a 5xx is not an answer about the music (CLAUDE.md).
--
-- WHO WRITES: only the index-tapes edge function, with the service role. The
-- anon key is public, so a client write path would let anyone plant a url the
-- player then streams; see the playback_issues hardening for that lesson.
-- WHO READS: everyone. It is a list of public Archive addresses.
--
-- This project's pg_default_acl grants ALL on new tables to anon and
-- authenticated, so the grants are stated in full rather than trusted.

create table if not exists public.tape_index (
  song_id      uuid not null references public.songs(id) on delete cascade,
  show_date    date not null,
  identifier   text not null default '',
  status       text not null check (status in ('playable', 'no_match', 'no_tape')),
  is_default   boolean not null default false,
  -- The tape an UNDATED slot plays: the player's generic search for the song
  -- (src/lib/archiveOrg.ts findArchiveRecording), resolved ahead of the tap.
  -- Saved setlist slots with no version and no night all play this, and they
  -- were a third of the bench corpus.
  is_song_default boolean not null default false,
  track_url    text,
  servers      text[] not null default '{}',
  file_name    text,
  title_on_tape text,
  duration_s   numeric,
  match_score  integer,
  verified_at  timestamptz not null default now(),
  primary key (song_id, show_date, identifier),
  constraint tape_index_playable_has_track check (
    (status = 'playable') = (track_url is not null)
  ),
  constraint tape_index_track_is_archive check (
    track_url is null
    or (length(track_url) <= 500
        and track_url ~ '^https://archive\.org/download/[A-Za-z0-9._-]+/[^?#[:space:]]+$')
  ),
  constraint tape_index_identifier_shape check (
    identifier = '' or identifier ~ '^[A-Za-z0-9._-]{1,200}$'
  ),
  constraint tape_index_answer_rows_have_no_item check (
    status = 'playable' or identifier = ''
  ),
  -- Only Archive hosts, as https://<host>.archive.org/<path>. The array is
  -- flattened with a separator no valid root can contain.
  constraint tape_index_servers_are_archive check (
    cardinality(servers) <= 8
    and (cardinality(servers) = 0
         or ('|' || array_to_string(servers, '|') || '|')
            ~ '^\|(https://[a-z0-9-]+(\.[a-z0-9-]+)*\.archive\.org/[^|?#[:space:]]*\|)+$')
  ),
  constraint tape_index_song_default_plays check (not is_song_default or status = 'playable'),
  constraint tape_index_dates check (show_date between date '1965-01-01' and date '1995-12-31')
);

-- At most one answer per night.
create unique index if not exists tape_index_one_default
  on public.tape_index (song_id, show_date) where is_default;

-- One generic answer per song.
create unique index if not exists tape_index_one_song_default
  on public.tape_index (song_id) where is_song_default;

-- The nightly refresh walks the oldest first.
create index if not exists tape_index_verified_idx on public.tape_index (verified_at);

alter table public.tape_index enable row level security;

drop policy if exists "Tape index is readable by everyone" on public.tape_index;
create policy "Tape index is readable by everyone"
  on public.tape_index for select
  to anon, authenticated
  using (true);

revoke all on public.tape_index from public, anon, authenticated;
grant select on public.tape_index to anon, authenticated;

comment on table public.tape_index is
  'Which Archive track is a song on a night, resolved ahead of the tap. Written only by the index-tapes edge function (service role). See docs/playback-sprint.';
