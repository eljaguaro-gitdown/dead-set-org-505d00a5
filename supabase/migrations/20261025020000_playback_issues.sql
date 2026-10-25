-- ============================================================================
-- playback_issues — "oops, that one won't play", noted and followed up.
--
-- When a fan taps a song and it will not play for a reason a fix can address
-- (the song is not on the tape, no tape turned up, the tape will not spin),
-- the app apologises, offers a tape we KNOW plays, and files the problem here.
-- A signed-in fan is told when it is fixed AND verified, and is credited on
-- Build Notes only if they said yes.
--
-- Network failures ("couldn't reach the Archive", stalls, the 25s watchdog)
-- are not filed: a retry fixes those, so a promise to "let you know when it is
-- fixed" would be hollow.
--
-- verified_tapes — tracks that have actually played (20s+ of real audio) for
-- someone. It is the only source the app may call "a tape we know plays".
--
-- Trust model: the anon key is public, so nothing here is written directly.
-- Every write goes through a SECURITY DEFINER function that validates its
-- input. Nothing a client sends is shown to another person: the public
-- outputs (suggestions, Build Notes credits) take song titles from `songs`
-- and names from `profiles`, never from the report itself.
-- ============================================================================

create table if not exists public.playback_issues (
  id                uuid primary key default gen_random_uuid(),
  kind              text not null check (kind in ('not_on_tape', 'no_tape', 'wont_play', 'none_in_setlist')),
  song_id           uuid references public.songs(id) on delete set null,
  -- As the client named it. Admin-only: never rendered to anyone else.
  song_title        text not null check (char_length(song_title) between 1 and 200),
  show_date         date,
  archive_url       text,
  track_url         text,
  setlist_id        uuid,
  dedupe_key        text not null,
  status            text not null default 'open' check (status in ('open', 'fixed', 'verified', 'wont_fix')),
  report_count      integer not null default 1,
  first_reported_at timestamptz not null default now(),
  last_reported_at  timestamptz not null default now(),
  last_build_sha    text,
  fixed_at          timestamptz,
  fix_note          text check (fix_note is null or char_length(fix_note) <= 1000),
  verified_at       timestamptz,
  -- 'playback': a real play of the night after it was marked fixed.
  -- 'admin': someone checked it by hand.
  verified_via      text check (verified_via in ('playback', 'admin')),
  closed_at         timestamptz
);

comment on table public.playback_issues is
  'One row per tape problem a fan hit (deduplicated). Written only by report_playback_issue(); read by admins.';

-- One live issue per problem. A verified or won''t-fix issue no longer blocks
-- a new report of the same thing: if it breaks again, that is a new issue.
create unique index if not exists playback_issues_live_dedupe
  on public.playback_issues (dedupe_key) where status in ('open', 'fixed');
create index if not exists playback_issues_status_idx
  on public.playback_issues (status, last_reported_at desc);

create table if not exists public.playback_issue_reporters (
  issue_id    uuid not null references public.playback_issues(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  wants_notice boolean not null default true,
  -- Opt-in. Unchecked unless the fan ticks "credit me".
  credit_ok   boolean not null default false,
  reported_at timestamptz not null default now(),
  notified_at timestamptz,
  seen_at     timestamptz,
  primary key (issue_id, user_id)
);

create table if not exists public.verified_tapes (
  track_url   text primary key check (track_url ~ '^https://archive\.org/download/[A-Za-z0-9._-]+/[^?#[:space:]]+$' and char_length(track_url) <= 500),
  song_id     uuid not null references public.songs(id) on delete cascade,
  show_date   date,
  archive_url text,
  ok_count    integer not null default 1,
  first_ok_at timestamptz not null default now(),
  last_ok_at  timestamptz not null default now()
);

create index if not exists verified_tapes_song_idx on public.verified_tapes (song_id, last_ok_at desc);
create index if not exists verified_tapes_recent_idx on public.verified_tapes (last_ok_at desc);

alter table public.playback_issues enable row level security;
alter table public.playback_issue_reporters enable row level security;
alter table public.verified_tapes enable row level security;

revoke all on public.playback_issues, public.playback_issue_reporters, public.verified_tapes from anon, authenticated;

-- Admins may read the queue directly; everyone else goes through the
-- functions below, which return only what each caller may see.
grant select on public.playback_issues, public.playback_issue_reporters to authenticated;

drop policy if exists "Admins read playback issues" on public.playback_issues;
create policy "Admins read playback issues" on public.playback_issues
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Reporters read their own follows" on public.playback_issue_reporters;
create policy "Reporters read their own follows" on public.playback_issue_reporters
  for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- Validation helpers
-- ---------------------------------------------------------------------------
create or replace function public.playback_archive_url_ok(p_url text)
returns boolean language sql immutable as $$
  select p_url is not null
     and char_length(p_url) <= 500
     and p_url ~ '^https://archive\.org/(details|download)/[A-Za-z0-9._-]+(/[^?#[:space:]]*)?$'
$$;

create or replace function public.playback_track_url_ok(p_url text)
returns boolean language sql immutable as $$
  select p_url is not null
     and char_length(p_url) <= 500
     and p_url ~ '^https://archive\.org/download/[A-Za-z0-9._-]+/[^?#[:space:]]+$'
$$;

-- ---------------------------------------------------------------------------
-- report_playback_issue — file (or add to) an issue. Returns its id.
-- ---------------------------------------------------------------------------
create or replace function public.report_playback_issue(
  p_kind        text,
  p_song_id     uuid,
  p_song_title  text,
  p_show_date   date,
  p_archive_url text,
  p_track_url   text,
  p_setlist_id  uuid,
  p_build_sha   text,
  p_notify      boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title   text := left(btrim(coalesce(p_song_title, '')), 200);
  v_song_id uuid;
  v_key     text;
  v_id      uuid;
  v_sha     text := case when p_build_sha ~ '^([0-9a-f]{7,40}|unknown)$' then p_build_sha end;
begin
  if p_kind not in ('not_on_tape', 'no_tape', 'wont_play', 'none_in_setlist') then
    raise exception 'unknown kind' using errcode = '22023';
  end if;
  if v_title = '' then
    raise exception 'song title required' using errcode = '22023';
  end if;

  -- A flood guard, not a quota: the app files one row per real failure and
  -- dedupes repeats, so this only ever bites a script.
  if (select count(*) from public.playback_issues where first_reported_at > now() - interval '1 hour') >= 200 then
    return null;
  end if;

  select id into v_song_id from public.songs where id = p_song_id;

  v_key := p_kind || '|' || coalesce(v_song_id::text, lower(v_title)) || '|'
        || coalesce(p_show_date::text, '') || '|' || coalesce(p_setlist_id::text, '');

  insert into public.playback_issues as pi
    (kind, song_id, song_title, show_date, archive_url, track_url, setlist_id, dedupe_key, last_build_sha)
  values (
    p_kind, v_song_id, v_title, p_show_date,
    case when public.playback_archive_url_ok(p_archive_url) then p_archive_url end,
    case when public.playback_track_url_ok(p_track_url) then p_track_url end,
    p_setlist_id, v_key, v_sha
  )
  on conflict (dedupe_key) where status in ('open', 'fixed')
  do update set
    report_count     = pi.report_count + 1,
    last_reported_at = now(),
    last_build_sha   = coalesce(excluded.last_build_sha, pi.last_build_sha),
    archive_url      = coalesce(excluded.archive_url, pi.archive_url),
    track_url        = coalesce(excluded.track_url, pi.track_url),
    -- Reported again after it was marked fixed: it is not fixed.
    status           = 'open',
    fixed_at         = null
  returning id into v_id;

  if auth.uid() is not null and coalesce(p_notify, true) then
    insert into public.playback_issue_reporters (issue_id, user_id)
    values (v_id, auth.uid())
    on conflict (issue_id, user_id) do update set wants_notice = true;
  end if;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- A signed-in fan's side of an issue
-- ---------------------------------------------------------------------------

-- "Sign in and we'll let you know": attach a report filed before sign-in.
create or replace function public.follow_playback_issue(p_issue_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return false; end if;
  if not exists (select 1 from public.playback_issues where id = p_issue_id and status in ('open', 'fixed')) then
    return false;
  end if;
  insert into public.playback_issue_reporters (issue_id, user_id)
  values (p_issue_id, auth.uid())
  on conflict (issue_id, user_id) do update set wants_notice = true;
  return true;
end;
$$;

create or replace function public.set_playback_credit(p_issue_id uuid, p_credit boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return false; end if;
  update public.playback_issue_reporters
     set credit_ok = coalesce(p_credit, false)
   where issue_id = p_issue_id and user_id = auth.uid();
  return found;
end;
$$;

-- Fixes this fan asked to hear about and has not seen yet.
create or replace function public.my_fixed_tapes()
returns table (issue_id uuid, song_id uuid, song_title text, show_date date, verified_at timestamptz, credit_ok boolean)
language sql
stable
security definer
set search_path = public
as $$
  -- credit_ok is reported as "their name is actually on Build Notes", which
  -- needs a display name as well as the yes: community_fixes() lists names.
  select i.id, i.song_id, coalesce(s.title, i.song_title), i.show_date, i.verified_at,
         (r.credit_ok and p.display_name is not null and i.song_id is not null)
    from public.playback_issue_reporters r
    join public.playback_issues i on i.id = r.issue_id
    left join public.songs s on s.id = i.song_id
    left join public.profiles p on p.user_id = r.user_id
   where r.user_id = auth.uid()
     and r.wants_notice
     and r.seen_at is null
     and i.status = 'verified'
   order by i.verified_at desc
   limit 5
$$;

create or replace function public.mark_fixed_tape_seen(p_issue_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.playback_issue_reporters
     set seen_at = now()
   where issue_id = p_issue_id and user_id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- Tapes we know play
-- ---------------------------------------------------------------------------

-- Called by the player once 20s of real audio has come out of a track.
-- A play of a night whose issue was marked fixed is what verifies the fix.
create or replace function public.record_tape_ok(
  p_song_id     uuid,
  p_show_date   date,
  p_archive_url text,
  p_track_url   text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.playback_track_url_ok(p_track_url) then return; end if;
  if not exists (select 1 from public.songs where id = p_song_id) then return; end if;

  insert into public.verified_tapes as v (track_url, song_id, show_date, archive_url)
  values (
    p_track_url, p_song_id, p_show_date,
    case when public.playback_archive_url_ok(p_archive_url) then p_archive_url end
  )
  on conflict (track_url) do update set
    ok_count   = v.ok_count + 1,
    last_ok_at = now();

  update public.playback_issues
     set status = 'verified', verified_at = now(), verified_via = 'playback'
   where status = 'fixed'
     and kind <> 'none_in_setlist'
     and song_id = p_song_id
     and (show_date is null or show_date = p_show_date);
end;
$$;

-- One tape to offer instead: the same song on another night if one is known
-- to play, otherwise one of the most recently heard tapes of anything else.
create or replace function public.suggest_known_good_tape(
  p_song_id        uuid,
  p_exclude_date   date,
  p_exclude_track  text
)
returns table (song_id uuid, song_title text, show_date date, archive_url text, track_url text)
language sql
stable
security definer
set search_path = public
as $$
  with recent as (
    select v.*
      from public.verified_tapes v
     where v.last_ok_at > now() - interval '30 days'
       and v.track_url is distinct from p_exclude_track
       and not (v.song_id = p_song_id and v.show_date is not distinct from p_exclude_date)
       and not exists (
         select 1 from public.playback_issues i
          where i.status in ('open', 'fixed')
            and i.song_id = v.song_id
            and i.show_date is not distinct from v.show_date
       )
     order by v.last_ok_at desc
     limit 50
  )
  select r.song_id, s.title, r.show_date, r.archive_url, r.track_url
    from recent r
    join public.songs s on s.id = r.song_id
   order by (r.song_id = p_song_id) desc, random()
   limit 1
$$;

-- ---------------------------------------------------------------------------
-- Build Notes: fixes the community flagged, with the names of those who
-- said yes to credit. Titles from `songs`, names from `profiles` — both
-- already pass the house-rules filter.
-- ---------------------------------------------------------------------------
create or replace function public.community_fixes(p_limit integer default 20)
returns table (issue_id uuid, song_title text, show_date date, verified_at timestamptz, credited text[])
language sql
stable
security definer
set search_path = public
as $$
  select i.id, s.title, i.show_date, i.verified_at,
         array_agg(p.display_name order by r.reported_at) filter (where p.display_name is not null)
    from public.playback_issues i
    join public.songs s on s.id = i.song_id
    join public.playback_issue_reporters r on r.issue_id = i.id and r.credit_ok
    join public.profiles p on p.user_id = r.user_id
   where i.status = 'verified'
   group by i.id, s.title, i.show_date, i.verified_at
  having count(p.display_name) > 0
   order by i.verified_at desc
   limit least(greatest(coalesce(p_limit, 20), 1), 50)
$$;

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------
create or replace function public.admin_playback_issues(p_include_closed boolean default false)
returns table (
  id uuid, kind text, status text, song_id uuid, song_title text, show_date date,
  archive_url text, track_url text, setlist_id uuid, report_count integer,
  followers integer, credited integer, first_reported_at timestamptz,
  last_reported_at timestamptz, last_build_sha text, fix_note text,
  fixed_at timestamptz, verified_at timestamptz, verified_via text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'admins only' using errcode = '42501';
  end if;
  return query
    select i.id, i.kind, i.status, i.song_id, coalesce(s.title, i.song_title), i.show_date,
           i.archive_url, i.track_url, i.setlist_id, i.report_count,
           (select count(*)::int from public.playback_issue_reporters r where r.issue_id = i.id and r.wants_notice),
           (select count(*)::int from public.playback_issue_reporters r where r.issue_id = i.id and r.credit_ok),
           i.first_reported_at, i.last_reported_at, i.last_build_sha, i.fix_note,
           i.fixed_at, i.verified_at, i.verified_via
      from public.playback_issues i
      left join public.songs s on s.id = i.song_id
     where p_include_closed or i.status in ('open', 'fixed')
     order by (i.status = 'open') desc, i.last_reported_at desc
     limit 200;
end;
$$;

create or replace function public.set_playback_issue_status(p_issue_id uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'admins only' using errcode = '42501';
  end if;
  if p_status not in ('open', 'fixed', 'verified', 'wont_fix') then
    raise exception 'unknown status' using errcode = '22023';
  end if;
  update public.playback_issues set
    status       = p_status,
    fix_note     = coalesce(left(p_note, 1000), fix_note),
    fixed_at     = case when p_status in ('fixed', 'verified') then coalesce(fixed_at, now()) else null end,
    verified_at  = case when p_status = 'verified' then now() else null end,
    verified_via = case when p_status = 'verified' then 'admin' else null end,
    closed_at    = case when p_status in ('verified', 'wont_fix') then now() else null end
  where id = p_issue_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke execute on function
  public.report_playback_issue(text, uuid, text, date, text, text, uuid, text, boolean),
  public.follow_playback_issue(uuid),
  public.set_playback_credit(uuid, boolean),
  public.my_fixed_tapes(),
  public.mark_fixed_tape_seen(uuid),
  public.record_tape_ok(uuid, date, text, text),
  public.suggest_known_good_tape(uuid, date, text),
  public.community_fixes(integer),
  public.admin_playback_issues(boolean),
  public.set_playback_issue_status(uuid, text, text)
from public;

grant execute on function
  public.report_playback_issue(text, uuid, text, date, text, text, uuid, text, boolean),
  public.record_tape_ok(uuid, date, text, text),
  public.suggest_known_good_tape(uuid, date, text),
  public.community_fixes(integer)
to anon, authenticated;

grant execute on function
  public.follow_playback_issue(uuid),
  public.set_playback_credit(uuid, boolean),
  public.my_fixed_tapes(),
  public.mark_fixed_tape_seen(uuid),
  public.admin_playback_issues(boolean),
  public.set_playback_issue_status(uuid, text, text)
to authenticated;

-- ---------------------------------------------------------------------------
-- Email: a new issue reaches a human; a verified fix reaches its reporters.
-- Same delivery path as notify_moderation_report: pg_net -> send-transactional-
-- email with the service key and URL from the vault. A failed send never fails
-- the write that caused it.
-- ---------------------------------------------------------------------------
create or replace function public.notify_playback_issue()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault'
as $$
declare
  v_service_key text;
  v_function_url text;
  v_recipient text;
  v_recipients text[] := array['eljaguaro@gmail.com'];
begin
  -- Ten an hour is plenty for a real outage of the catalog; past that it is
  -- noise, and the admin queue still has every one.
  if (select count(*) from public.playback_issues where first_reported_at > now() - interval '1 hour') > 10 then
    return new;
  end if;

  select decrypted_secret into v_service_key from vault.decrypted_secrets where name = 'email_queue_service_role_key' limit 1;
  select decrypted_secret into v_function_url from vault.decrypted_secrets where name = 'send_transactional_email_url' limit 1;
  if v_service_key is null or v_function_url is null then
    raise warning 'notify_playback_issue: missing vault secret(s); skipping';
    return new;
  end if;

  foreach v_recipient in array v_recipients loop
    begin
      perform net.http_post(
        url := v_function_url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_service_key),
        body := jsonb_build_object(
          'templateName', 'playback-issue-alert',
          'recipientEmail', v_recipient,
          'idempotencyKey', 'playback-issue-' || new.id::text || '-' || v_recipient,
          'templateData', jsonb_build_object(
            'kind', new.kind,
            'songTitle', new.song_title,
            'showDate', new.show_date,
            'archiveUrl', new.archive_url,
            'buildSha', new.last_build_sha,
            'reportedAt', to_char(new.first_reported_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
          )
        )
      );
    exception when others then
      raise warning 'notify_playback_issue failed for % to %: %', new.id, v_recipient, sqlerrm;
    end;
  end loop;
  return new;
end;
$$;

revoke execute on function public.notify_playback_issue() from public, anon, authenticated;

drop trigger if exists notify_playback_issue on public.playback_issues;
create trigger notify_playback_issue
  after insert on public.playback_issues
  for each row execute function public.notify_playback_issue();

create or replace function public.notify_playback_fixed()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault'
as $$
declare
  v_service_key text;
  v_function_url text;
  v_title text;
  r record;
begin
  select decrypted_secret into v_service_key from vault.decrypted_secrets where name = 'email_queue_service_role_key' limit 1;
  select decrypted_secret into v_function_url from vault.decrypted_secrets where name = 'send_transactional_email_url' limit 1;

  select coalesce(s.title, new.song_title) into v_title from (select 1) x left join public.songs s on s.id = new.song_id;

  for r in
    select rep.user_id, u.email,
           (rep.credit_ok and p.display_name is not null and new.song_id is not null) as credited
      from public.playback_issue_reporters rep
      join auth.users u on u.id = rep.user_id
      left join public.profiles p on p.user_id = rep.user_id
     where rep.issue_id = new.id and rep.wants_notice and rep.notified_at is null
  loop
    if v_service_key is not null and v_function_url is not null and r.email is not null then
      begin
        perform net.http_post(
          url := v_function_url,
          headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_service_key),
          body := jsonb_build_object(
            'templateName', 'playback-fixed',
            'recipientEmail', r.email,
            'idempotencyKey', 'playback-fixed-' || new.id::text || '-' || r.user_id::text,
            'templateData', jsonb_build_object(
              'songTitle', v_title,
              'showDate', new.show_date,
              'songId', new.song_id,
              'credited', r.credited
            )
          )
        );
      exception when others then
        raise warning 'notify_playback_fixed failed for % to %: %', new.id, r.user_id, sqlerrm;
      end;
    end if;
    -- Marked whether or not the email went: the in-app notice still shows
    -- (it keys on seen_at), and a retry here would re-send to everyone else.
    update public.playback_issue_reporters set notified_at = now()
     where issue_id = new.id and user_id = r.user_id;
  end loop;
  return new;
end;
$$;

revoke execute on function public.notify_playback_fixed() from public, anon, authenticated;

drop trigger if exists notify_playback_fixed on public.playback_issues;
create trigger notify_playback_fixed
  after update of status on public.playback_issues
  for each row
  when (new.status = 'verified' and old.status is distinct from 'verified')
  execute function public.notify_playback_fixed();
