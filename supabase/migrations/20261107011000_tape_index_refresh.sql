-- What the tape index should hold, and the job that keeps it full.
--
-- tape_index_candidates(limit): every (song, night[, stored item]) the
-- product can offer a fan, missing from the index or not verified in 7 days,
-- oldest need first. "Can offer" is: each song's first and last night (the
-- version picker's milestones, the Songbook and its spotlight), every catalog
-- version (notable_versions), every dated setlist slot (catalog-linked or a
-- guide's own archive blob), every tape that has played (verified_tapes) and
-- every playback report. A night the picker finds live on the Archive and
-- nobody has saved is not here: the client asks index-tapes for it on a miss.
-- A row with show_date NULL asks for the song's undated answer.
--
-- Service role only: it reads private setlists' slots.

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
    select k.*,
           (select max(t.verified_at) from public.tape_index t
             where t.song_id = k.song_id and t.show_date = k.show_date
               and (k.stored_identifier is null or t.is_default or t.identifier = k.stored_identifier)) as seen
      from keys k
  )
  -- And every song's undated answer (show_date null = "the song's best tape").
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

-- Hourly, at :23, forty nights at a time: fills the index within a day of a
-- deploy and then re-verifies a week's worth of nights a day. It reaches the
-- function with the same vault-held key the email queue uses, proven by a
-- hash in a header of our own (bearers do not arrive as sent — CLAUDE.md,
-- internalSend.ts), and only if pg_cron and pg_net are present.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_extension where extname = 'pg_net') then
    perform cron.unschedule('tape-index-refresh')
      where exists (select 1 from cron.job where jobname = 'tape-index-refresh');
    perform cron.schedule(
      'tape-index-refresh',
      '23 * * * *',
      $cron$
        select net.http_post(
          url := replace(
            (select decrypted_secret from vault.decrypted_secrets where name = 'send_transactional_email_url'),
            'send-transactional-email', 'index-tapes'),
          headers := jsonb_build_object(
            'content-type', 'application/json',
            'x-dead-set-internal', encode(extensions.digest(
              'index-tapes:' || (select decrypted_secret from vault.decrypted_secrets where name = 'email_queue_service_role_key'),
              'sha256'), 'hex')),
          body := '{"mode":"refresh","limit":40}'::jsonb,
          timeout_milliseconds := 150000
        );
      $cron$
    );
  end if;
end $$;
