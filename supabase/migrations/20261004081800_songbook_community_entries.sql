-- ---------------------------------------------------------------------------
-- The Songbook, continued by the people reading it.
--
-- song_features is the editorial series: one song a week, issue numbers,
-- sourced figures, written by hand. Two issues exist. The repertoire is ~523
-- songs, so at a song a week the series is a decade of work and 232 of the
-- 234 songs in the catalog currently have nothing.
--
-- This table is the other half: the first listening guide anyone builds for a
-- song becomes that song's community entry, credited to whoever made it. It
-- does NOT touch song_features — an unreviewed guide must never appear as an
-- issue, because the issues are the thing that makes the Songbook worth
-- reading. Two tiers, one shelf.
--
-- "Has not yet been added" is enforced by the database, not by the client:
-- song_id is unique, so the first guide in wins and every later one is a
-- no-op. A check on the client would race itself the moment two people
-- saved a guide for the same song at once.
-- ---------------------------------------------------------------------------

create table if not exists public.songbook_entries (
  id          uuid primary key default gen_random_uuid(),

  -- One entry per song. This UNIQUE is the whole "not yet in the Songbook"
  -- rule; everything else is bookkeeping.
  song_id     uuid not null unique references public.songs(id) on delete cascade,

  -- The guide itself. If the author deletes it the credit goes with it, and
  -- the song opens back up for the next person.
  setlist_id  uuid not null references public.setlists(id) on delete cascade,

  -- Credit. Never null: an entry exists because a signed-in person made it.
  creator_id  uuid not null references auth.users(id) on delete cascade,

  created_at  timestamptz not null default now()
);

create index if not exists songbook_entries_created_idx
  on public.songbook_entries (created_at desc);
create index if not exists songbook_entries_creator_idx
  on public.songbook_entries (creator_id);

alter table public.songbook_entries enable row level security;

-- Readable by everyone, signed in or not. The Songbook is the front door and
-- a visitor has to be able to see that the community is filling it.
drop policy if exists "Songbook entries are readable by everyone" on public.songbook_entries;
create policy "Songbook entries are readable by everyone"
  on public.songbook_entries for select
  using (true);

-- You may only add an entry that credits YOU, and only for a guide you own
-- and have made public. Without the setlists check a signed-in user could
-- claim the Songbook slot for a song using somebody else's guide, or a
-- private one nobody can open.
drop policy if exists "Authors add their own songbook entry" on public.songbook_entries;
create policy "Authors add their own songbook entry"
  on public.songbook_entries for insert
  to authenticated
  with check (
    creator_id = auth.uid()
    and exists (
      select 1 from public.setlists s
      where s.id = setlist_id
        and s.creator_id = auth.uid()
        and s.is_public = true
    )
  );

-- Authors can withdraw their own entry; admins can remove any. There is no
-- UPDATE policy on purpose — an entry is a fact about who got there first,
-- so it is created or removed, never edited.
drop policy if exists "Authors withdraw their own songbook entry" on public.songbook_entries;
create policy "Authors withdraw their own songbook entry"
  on public.songbook_entries for delete
  to authenticated
  using (creator_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- RLS alone is not enough for Data API reads — grant explicitly, and grant
-- only the columns and verbs the policies above actually allow.
grant select on public.songbook_entries to anon, authenticated;
grant insert, delete on public.songbook_entries to authenticated;
