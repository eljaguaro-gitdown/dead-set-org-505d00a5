-- ============================================================================
-- record_tape_ok: the hourly cap guards the pool, not verification. Found by
-- the /pre-release gate on 2d81fb3 (note 1), and reproduced there. A new file,
-- not an edit, because merged migrations are append-only (CLAUDE.md). Apply
-- it after 20261026020000_playback_issues_hardening.sql.
--
-- 1. When the 40-new-tapes-an-hour cap was full, record_tape_ok() did
--    `return;`. That skipped the verification block below it too. So while
--    the cap was full, a signed-in fan's genuine play of an admin-"fixed"
--    night verified nothing and emailed nobody. 40 anonymous calls an hour
--    would keep it full, and every fix would wait on an admin forever. Now
--    a full cap skips only the INSERT. The function always reaches the
--    verification block, which still needs a signed-in caller, as before.
--
-- 2. playback_track_matches_night() took any year in the identifier, so
--    gd1066-10-14 and gd2099-01-01 counted as nights (the gate stored both).
--    A two-digit year mapped to 1900–1999, so gd00-01-01 did too. Now the
--    year must be 1965 to 1995, the years the band played. The same check
--    filters suggest_known_good_tape(), so a row from outside those years
--    that is already in verified_tapes stops being offered once this
--    applies. This file deletes nothing.
--
-- Replay: both functions are CREATE OR REPLACE with the same signatures,
-- which keeps their privileges, and the grants are restated at the end
-- exactly as the two earlier files left them. No DML. A second apply is inert.
-- ============================================================================

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
    y := 1900 + y; -- gd77-05-08
  end if;
  if y < 1965 or y > 1995 then
    return false; -- the band played 1965 to 1995: gd1066 and gd2099 are not nights
  end if;
  return make_date(y, m[2]::integer, m[3]::integer) = p_date;
exception when others then
  -- gd77-02-30 and the like: not a night, so not a match.
  return false;
end;
$$;

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
  elsif (select count(*) from public.verified_tapes where first_ok_at > now() - interval '1 hour') < 40 then
    -- New tapes are capped across everyone, so a script cannot flood the pool.
    -- A full cap stops only this insert. Never return here: the play below
    -- still has to count, or 40 calls an hour would hold every fix hostage.
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

-- ---------------------------------------------------------------------------
-- Grants, unchanged: restated so a replay of any of the three files leaves
-- the same ones. (Production's default privileges grant EXECUTE on new
-- functions to anon; see CLAUDE.md. Neither function here is new.)
-- ---------------------------------------------------------------------------
revoke execute on function public.playback_track_matches_night(text, date)
  from public, anon, authenticated;

revoke execute on function public.record_tape_ok(uuid, date, text, text) from public;
grant execute on function public.record_tape_ok(uuid, date, text, text) to anon, authenticated;
