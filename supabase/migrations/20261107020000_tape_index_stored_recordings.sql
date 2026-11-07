-- tape_index: remember a NAMED recording that does not carry the song, and
-- let the hourly refresh find named recordings at all.
--
-- Found by TapeBench (2026-11-07). A setlist slot that names its own
-- recording asks the index for THAT identifier. Two faults kept those rows
-- from ever existing:
--
--  1. tape_index_candidates counted a night as seen when it had a DEFAULT
--     row (`... or t.is_default or ...`). So once a night was indexed, no
--     recording a slot named on that night was ever queued, and those taps
--     read the item's metadata live: 4-6 s on Fast-4G before the first audio
--     request, against ~0.4 s for an index hit.
--  2. When the named recording does not carry the song, the indexer stored
--     nothing for it (only playable rows may carry an identifier), so even
--     with (1) fixed it would be queued again every hour, forever.
--
-- A "not on this recording" row is a non-default no_match row under the
-- recording's own identifier. It never becomes a night's answer (is_default
-- stays false, which the existing one-default index already enforces), and
-- the client reads it only to skip a live read it knows will fail.
--
-- Append-only: the old constraint is dropped and re-added wider; no rows
-- change.

alter table public.tape_index drop constraint if exists tape_index_answer_rows_have_no_item;
alter table public.tape_index add constraint tape_index_answer_rows_have_no_item check (
  status = 'playable'
  or identifier = ''
  or (status = 'no_match' and not is_default and not is_song_default and track_url is null)
);

create or replace function public.tape_index_candidates(p_limit integer default 40)
returns table (song_id uuid, song_title text, show_date date, stored_identifier text)
language sql
stable
security definer
set search_path = public
as $$
  with raw as (
    select s.id as song_id, s.first_played::date as show_date, null::text as url from public.songs s where s.first_played is not null
    union all select s.id, s.last_played::date, null from public.songs s where s.last_played is not null
    union all select nv.song_id, nv.show_date::date, nv.archive_org_url from public.notable_versions nv where nv.show_date is not null
    union all
      select ss.song_id,
             coalesce(nv.show_date::date, (substring(ss.notes from '"show_date":"([0-9]{4}-[0-9]{2}-[0-9]{2})'))::date),
             coalesce(nv.archive_org_url, substring(ss.notes from '"archive_org_url":"([^"]+)"'))
        from public.setlist_slots ss
        left join public.notable_versions nv on nv.id = ss.notable_version_id
    union all select v.song_id, v.show_date, v.archive_url from public.verified_tapes v where v.show_date is not null
    union all select i.song_id, i.show_date, i.archive_url from public.playback_issues i where i.song_id is not null and i.show_date is not null
  ),
  keys as (
    select distinct r.song_id, r.show_date,
           substring(r.url from 'archive\.org/details/([A-Za-z0-9._-]+)') as stored_identifier
      from raw r
     where r.song_id is not null
       and r.show_date between date '1965-01-01' and date '1995-12-31'
  ),
  need as (
    -- A night with no named recording is seen through its default row; a
    -- named recording only through its OWN row (playable or no_match).
    select k.*,
           (select max(t.verified_at) from public.tape_index t
             where t.song_id = k.song_id and t.show_date = k.show_date
               and case when k.stored_identifier is null then t.is_default
                        else t.identifier = k.stored_identifier end) as seen
      from keys k
  )
  , songs_need as (
    select s.id as song_id, null::date as show_date, null::text as stored_identifier,
           (select max(t.verified_at) from public.tape_index t where t.song_id = s.id and t.is_song_default) as seen
      from public.songs s
  )
  select x.song_id, s.title, x.show_date, x.stored_identifier
    from (select * from need union all select * from songs_need) x
    join public.songs s on s.id = x.song_id
   where x.seen is null or x.seen < now() - interval '7 days'
   order by x.seen nulls first, x.show_date nulls last
   limit greatest(1, least(coalesce(p_limit, 40), 500))
$$;

revoke all on function public.tape_index_candidates(integer) from public, anon, authenticated;
grant execute on function public.tape_index_candidates(integer) to service_role;
