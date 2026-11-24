-- The tape desk's lookout (docs/tape-desk.md, docs/tape-desk/DECISIONS.md).
--
-- When a fan's report that the song is not on the tape lands in
-- playback_issues, the desk should start on it at once, not at the next
-- hourly pass. This migration adds:
--
--   1. tape_desk_lookout: an AFTER trigger on playback_issues that posts the
--      row's id to the tape-desk edge function, which sends a GitHub
--      repository_dispatch and so starts the Tape desk workflow on that one
--      ticket. It fires for the kinds the desk fixes (not_on_tape, no_tape)
--      on a new report, on a report that reopens a fixed row, and when the
--      owner's Mark fixed / Verified / No tape exists changes the status
--      (the desk then closes its GitHub issue). Same delivery as the email
--      triggers: pg_net with the vault's service key as the bearer, which
--      the function proves with Supabase. A failed post never fails the
--      report that caused it, and the hourly sweep finds anything missed.
--
--   2. tape_desk_dispatches: what was sent, when, and what GitHub said, so
--      the sweep can tell a dispatched ticket from a missed one. Service role
--      writes; admins read. It names no fan.
--
--   3. Pin provenance on tape_index (pinned_by, pin_issue, pin_note). A pin
--      is the one data fix the desk makes itself: the night's default row,
--      written by tape-desk with the indexer's own row builder. The hourly
--      refresh skips a pinned night (tape_index_candidates below, and
--      index-tapes' store()), so it cannot undo a fix a fan was promised.
--      Unpinning clears the columns and keeps the row.
--
-- Nothing here changes a playback_issues status, and nothing emails a fan.
--
-- Append-only and replay-safe: columns and tables are added if absent, the
-- functions are replaced, and the trigger is dropped and re-created by name.
-- No row is updated or deleted. Grants are stated in full, because this
-- project's default privileges give anon and authenticated everything on new
-- tables and functions (CLAUDE.md).

-- ---------------------------------------------------------------------------
-- 3. Pin provenance on tape_index
-- ---------------------------------------------------------------------------
alter table public.tape_index add column if not exists pinned_by text;
alter table public.tape_index add column if not exists pin_issue integer;
alter table public.tape_index add column if not exists pin_note text;

alter table public.tape_index drop constraint if exists tape_index_pin_shape;
-- Every term is spelled out with IS NOT NULL: a CHECK passes when its
-- expression is NULL, so `pin_issue > 0` alone let a pin with no ticket in
-- (caught by supabase/tests/tape_desk.pglite.mjs).
alter table public.tape_index add constraint tape_index_pin_shape check (
  (pinned_by is null and pin_issue is null)
  or (pinned_by is not null and pinned_by = 'tape_desk'
      and pin_issue is not null and pin_issue > 0
      and status = 'playable' and is_default)
);
alter table public.tape_index drop constraint if exists tape_index_pin_note_len;
alter table public.tape_index add constraint tape_index_pin_note_len check (pin_note is null or char_length(pin_note) <= 500);

comment on column public.tape_index.pinned_by is
  'tape_desk when the Tape desk pinned this row as the night''s answer for a fan''s report; the hourly refresh then leaves the night alone.';
comment on column public.tape_index.pin_issue is
  'The GitHub issue number of the Tape desk ticket that pinned this row.';

-- The refresh walks every key the product can offer, except a pinned night.
-- Otherwise identical to 20261107020000's definition.
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
       and not exists (
         select 1 from public.tape_index p
          where p.song_id = r.song_id and p.show_date = r.show_date and p.pinned_by is not null
       )
  ),
  need as (
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

-- ---------------------------------------------------------------------------
-- 2. The dispatch log
-- ---------------------------------------------------------------------------
create table if not exists public.tape_desk_dispatches (
  id            bigint generated always as identity primary key,
  issue_id      uuid not null references public.playback_issues(id) on delete cascade,
  reason        text not null check (reason in ('reported', 'reopened', 'owner_closed', 'sweep', 'synthetic')),
  dispatched_at timestamptz not null default now(),
  -- 204 is GitHub's "accepted". Null: nothing was sent (out of scope, no token, or the request failed).
  github_status integer,
  note          text check (note is null or char_length(note) <= 200)
);
create index if not exists tape_desk_dispatches_issue_idx on public.tape_desk_dispatches (issue_id, dispatched_at desc);

alter table public.tape_desk_dispatches enable row level security;
revoke all on public.tape_desk_dispatches from public, anon, authenticated;
grant select on public.tape_desk_dispatches to authenticated;
drop policy if exists "Admins read tape desk dispatches" on public.tape_desk_dispatches;
create policy "Admins read tape desk dispatches" on public.tape_desk_dispatches
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

comment on table public.tape_desk_dispatches is
  'Each time the lookout asked GitHub to start the Tape desk on a report. Written by the tape-desk edge function (service role).';

-- ---------------------------------------------------------------------------
-- 1. The lookout trigger
-- ---------------------------------------------------------------------------
create or replace function public.tape_desk_lookout()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault'
as $$
declare
  v_reason text;
  v_service_key text;
  v_function_url text;
begin
  if new.kind not in ('not_on_tape', 'no_tape') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_reason := 'reported';
  elsif old.status = 'fixed' and new.status = 'open' then
    -- report_playback_issue() reopens a fixed row when it is reported again.
    v_reason := 'reopened';
  elsif new.status in ('fixed', 'verified', 'wont_fix') and old.status is distinct from new.status then
    -- The owner's buttons. The desk finishes its ticket; it never presses them.
    v_reason := 'owner_closed';
  else
    return new;
  end if;

  -- Same ceiling as the owner alert: a catalog-wide outage is a full queue
  -- for the sweep, not hundreds of workflow runs.
  if (select count(*) from public.tape_desk_dispatches where dispatched_at > now() - interval '1 hour') >= 30 then
    return new;
  end if;

  select decrypted_secret into v_service_key from vault.decrypted_secrets where name = 'email_queue_service_role_key' limit 1;
  select decrypted_secret into v_function_url from vault.decrypted_secrets where name = 'send_transactional_email_url' limit 1;
  if v_service_key is null or v_function_url is null then
    raise warning 'tape_desk_lookout: missing vault secret(s); the hourly sweep will pick % up', new.id;
    return new;
  end if;

  begin
    perform net.http_post(
      url := replace(v_function_url, 'send-transactional-email', 'tape-desk'),
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_service_key),
      body := jsonb_build_object('action', 'dispatch', 'issue_id', new.id, 'reason', v_reason)
    );
  exception when others then
    raise warning 'tape_desk_lookout failed for %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

revoke execute on function public.tape_desk_lookout() from public, anon, authenticated;

drop trigger if exists tape_desk_lookout on public.playback_issues;
create trigger tape_desk_lookout
  after insert or update of status on public.playback_issues
  for each row execute function public.tape_desk_lookout();
