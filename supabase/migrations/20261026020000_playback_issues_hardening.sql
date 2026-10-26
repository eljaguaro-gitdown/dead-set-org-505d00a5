-- ============================================================================
-- playback_issues hardening: what the 2026-10-25 /pre-release gate found in
-- 20261025020000_playback_issues.sql before it was ever applied (BLOCK on
-- b323a3e). A new file, not an edit, because merged migrations are append-only
-- (CLAUDE.md). Apply it straight after that one.
--
-- M1. `revoke execute ... from public` leaves Supabase's DEFAULT grants. In
--     this project the postgres role's default privileges give EXECUTE on
--     every new function to anon (checked in production: pg_default_acl,
--     `postgres f {...anon=X/postgres...}`). So anon could call the six
--     signed-in-only functions. They returned false/empty or raised 42501, so
--     nothing leaked, but they were not closed the way the file claimed.
--     Fixed by revoking from anon too; the test now stubs those defaults.
--
-- M2. The first file's header said "nothing a client sends is shown to
--     another person". That was false. record_tape_ok is anon-callable, so a
--     script could plant any archive.org download url as "a tape we know
--     plays" for a real song, or flood the pool until the real tapes fell out
--     of it. It could also verify an admin-"fixed" issue, which emails the
--     fans who were waiting. Now:
--       - a track counts only if its Archive item is a Dead tape of EXACTLY
--         that night (identifier gdYY-MM-DD / gdYYYY-MM-DD, matched to
--         p_show_date);
--       - at most 40 new tapes an hour across everyone, and a tape's count
--         rises at most once per ten minutes, so a loop cannot buy rank;
--       - suggestions rank by that count before recency;
--       - verifying a fix by playback takes a SIGNED-IN fan's play
--         (verified_by records who). An anonymous play still counts as
--         evidence that the tape plays, but it tells nobody anything.
--     What remains true and is NOT guaranteed: a planted url that looks like
--     a real Dead tape of the right night can still enter the pool, within
--     the hourly cap. The server never fetches the Archive to prove a track
--     exists. The suggestion is "played for someone", not "proven".
--     Also: the 200-an-hour flood guard on reports now applies only to NEW
--     problems, so a fan joining an existing issue is never dropped.
--
-- M3. community_fixes() printed profiles.display_name unfiltered. The
--     profiles filter trigger fires on UPDATE only, because a Google- or
--     Apple-seeded name is inserted at signup. A name is creditable now only
--     if it is non-blank and passes is_objectionable(). The same rule decides
--     "your name's on Build Notes" (my_fixed_tapes, the fix email), so that
--     sentence stays true.
--
-- Also: verification by playback now sets closed_at, as the admin path does.
--
-- Replay: every statement is CREATE OR REPLACE, ADD COLUMN IF NOT EXISTS,
-- REVOKE or GRANT. No DML. A second apply is inert.
-- ============================================================================

alter table public.playback_issues
  add column if not exists verified_by uuid references auth.users(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Helpers (called only from inside SECURITY DEFINER functions)
-- ---------------------------------------------------------------------------

-- Is this a Grateful Dead tape on the Archive, of exactly this night?
create or replace function public.playback_track_matches_night(p_url text, p_date date)
returns boolean
language plpgsql
immutable
as $$
declare
  m text[];
  y integer;
begin
  if p_date is null or not public.playback_track_url_ok(p_url) then
    return false;
  end if;
  m := regexp_match(p_url, '^https://archive\.org/download/gd(\d{4}|\d{2})-(\d{2})-(\d{2})[A-Za-z0-9._-]*/');
  if m is null then
    return false;
  end if;
  y := m[1]::integer;
  if y < 100 then
    y := 1900 + y; -- gd77-05-08: the band played 1965 to 1995
  end if;
  return make_date(y, m[2]::integer, m[3]::integer) = p_date;
exception when others then
  -- gd77-02-30 and the like: not a night, so not a match.
  return false;
end;
$$;

-- May this name be printed as a credit?
create or replace function public.playback_creditable_name(p_name text)
returns boolean
language sql
stable
set search_path = public
as $$
  select p_name is not null
     and btrim(p_name) <> ''
     and not public.is_objectionable(p_name)
$$;

-- ---------------------------------------------------------------------------
-- M2: reports — the flood guard is for new problems only
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

  select id into v_song_id from public.songs where id = p_song_id;

  v_key := p_kind || '|' || coalesce(v_song_id::text, lower(v_title)) || '|'
        || coalesce(p_show_date::text, '') || '|' || coalesce(p_setlist_id::text, '');

  -- A flood guard, not a quota, and only for problems nobody has reported
  -- yet: a fan adding to an existing issue is never turned away.
  if not exists (select 1 from public.playback_issues where dedupe_key = v_key and status in ('open', 'fixed'))
     and (select count(*) from public.playback_issues where first_reported_at > now() - interval '1 hour') >= 200 then
    return null;
  end if;

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
-- M2: tapes we know play
-- ---------------------------------------------------------------------------
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
  if not public.playback_track_matches_night(p_track_url, p_show_date) then return; end if;
  if not exists (select 1 from public.songs where id = p_song_id) then return; end if;

  if exists (select 1 from public.verified_tapes where track_url = p_track_url) then
    -- Counted at most once per ten minutes, so a loop cannot buy rank.
    update public.verified_tapes
       set ok_count = ok_count + 1, last_ok_at = now()
     where track_url = p_track_url
       and last_ok_at < now() - interval '10 minutes';
  else
    -- New tapes are capped across everyone, so a script cannot flood the pool.
    if (select count(*) from public.verified_tapes where first_ok_at > now() - interval '1 hour') >= 40 then
      return;
    end if;
    insert into public.verified_tapes (track_url, song_id, show_date, archive_url)
    values (
      p_track_url, p_song_id, p_show_date,
      case when public.playback_archive_url_ok(p_archive_url) then p_archive_url end
    )
    on conflict (track_url) do nothing;
  end if;

  -- Verifying a fix emails the fans waiting on it, so it takes a member's
  -- play. The anon key is public; an anonymous call tells nobody anything.
  if auth.uid() is not null then
    update public.playback_issues
       set status = 'verified', verified_at = now(), verified_via = 'playback',
           verified_by = auth.uid(), closed_at = now()
     where status = 'fixed'
       and kind <> 'none_in_setlist'
       and song_id = p_song_id
       and (show_date is null or show_date = p_show_date);
  end if;
end;
$$;

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
       and public.playback_track_matches_night(v.track_url, v.show_date)
       and v.track_url is distinct from p_exclude_track
       and not (v.song_id = p_song_id and v.show_date is not distinct from p_exclude_date)
       and not exists (
         select 1 from public.playback_issues i
          where i.status in ('open', 'fixed')
            and i.song_id = v.song_id
            and i.show_date is not distinct from v.show_date
       )
     -- Most-heard first: a planted row starts at one and rises at most
     -- every ten minutes, behind tapes people have actually come back to.
     order by v.ok_count desc, v.last_ok_at desc
     limit 50
  )
  select r.song_id, s.title, r.show_date, r.archive_url, r.track_url
    from recent r
    join public.songs s on s.id = r.song_id
   order by (r.song_id = p_song_id) desc, r.ok_count desc, random()
   limit 1
$$;

-- ---------------------------------------------------------------------------
-- M3: credits print only names that pass the house rules
-- ---------------------------------------------------------------------------
create or replace function public.community_fixes(p_limit integer default 20)
returns table (issue_id uuid, song_title text, show_date date, verified_at timestamptz, credited text[])
language sql
stable
security definer
set search_path = public
as $$
  select i.id, s.title, i.show_date, i.verified_at,
         array_agg(btrim(p.display_name) order by r.reported_at)
    from public.playback_issues i
    join public.songs s on s.id = i.song_id
    join public.playback_issue_reporters r on r.issue_id = i.id and r.credit_ok
    join public.profiles p on p.user_id = r.user_id and public.playback_creditable_name(p.display_name)
   where i.status = 'verified'
   group by i.id, s.title, i.show_date, i.verified_at
   order by i.verified_at desc
   limit least(greatest(coalesce(p_limit, 20), 1), 50)
$$;

create or replace function public.my_fixed_tapes()
returns table (issue_id uuid, song_id uuid, song_title text, show_date date, verified_at timestamptz, credit_ok boolean)
language sql
stable
security definer
set search_path = public
as $$
  -- credit_ok means "your name is actually on Build Notes": the yes, a
  -- printable name, and a song community_fixes() can list.
  select i.id, i.song_id, coalesce(s.title, i.song_title), i.show_date, i.verified_at,
         (r.credit_ok and public.playback_creditable_name(p.display_name) and i.song_id is not null)
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
           (rep.credit_ok and public.playback_creditable_name(p.display_name) and new.song_id is not null) as credited
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
    update public.playback_issue_reporters set notified_at = now()
     where issue_id = new.id and user_id = r.user_id;
  end loop;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- M1: close what the first file meant to close
-- ---------------------------------------------------------------------------
revoke execute on function
  public.follow_playback_issue(uuid),
  public.set_playback_credit(uuid, boolean),
  public.my_fixed_tapes(),
  public.mark_fixed_tape_seen(uuid),
  public.admin_playback_issues(boolean),
  public.set_playback_issue_status(uuid, text, text)
from public, anon;

grant execute on function
  public.follow_playback_issue(uuid),
  public.set_playback_credit(uuid, boolean),
  public.my_fixed_tapes(),
  public.mark_fixed_tape_seen(uuid),
  public.admin_playback_issues(boolean),
  public.set_playback_issue_status(uuid, text, text)
to authenticated;

-- Internal: validators, the credit rule and the email triggers. Nobody calls
-- these but the functions above (which run as their owner).
revoke execute on function
  public.playback_archive_url_ok(text),
  public.playback_track_url_ok(text),
  public.playback_track_matches_night(text, date),
  public.playback_creditable_name(text),
  public.notify_playback_issue(),
  public.notify_playback_fixed()
from public, anon, authenticated;

-- The four anon may call, restated so a replay of either file leaves the
-- same grants.
grant execute on function
  public.report_playback_issue(text, uuid, text, date, text, text, uuid, text, boolean),
  public.record_tape_ok(uuid, date, text, text),
  public.suggest_known_good_tape(uuid, date, text),
  public.community_fixes(integer)
to anon, authenticated;
