-- Who wrote a slot's notes: Cosmic Charlie, a member, or the site itself.
--
-- The owner's rule (2026-11-26): anything Charlie wrote carries "*Cosmic
-- Charlie" wherever it is shown, linking to /about#cosmic-charlie, and a note a
-- member rewrites is theirs, with his name off it. Slot notes are the one place
-- his words and a member's share a field (he fills `notes` when he builds a
-- night, and the builder lets anyone edit it), so the field needs a record of
-- whose words are in it. See src/lib/charlieCredit.ts.
--
--   charlie   Charlie wrote it (his per-song notes, his reasons on a guide)
--   member    a head wrote or rewrote it
--   dead_set  a label the site wrote ("From 1977-05-08 · Barton Hall")
--   null      unknown. Gets no credit.
--
-- BACKFILL. No record was kept before today, so existing rows are inferred,
-- and the inference is written down here rather than hidden:
--
--   1. Empty free text: null.
--   2. Free text that is itself JSON (the favourites setlists store a
--      differently spaced blob that decodeArchiveNotes does not read): null.
--   3. Free text starting "From ": dead_set (the show-seed label).
--   4. A listening guide saved from the version picker on a voted song (its
--      description ends with sleeperMath's METHOD_LINE): dead_set. Those
--      reasons are the curated blurbs.
--   5. Any other prose: charlie.
--
-- Rule 5 is the guess, and it was checked before it was written: on
-- 2026-11-26 the production rows it covers (2,656 slots) read as Charlie's
-- per-song notes ("A classic high-energy opener to grab the room
-- immediately."), with or without a setlist description. It will also credit
-- Charlie for a note a member typed by hand and never marked. The first edit
-- after this ships sets `member`, so that error corrects itself on contact.
--
-- Replay-safe: the column is added only if missing, and the backfill only
-- touches rows still null.

alter table public.setlist_slots
  add column if not exists notes_by text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'setlist_slots_notes_by_check'
  ) then
    alter table public.setlist_slots
      add constraint setlist_slots_notes_by_check
      check (notes_by is null or notes_by in ('charlie', 'member', 'dead_set'));
  end if;
end $$;

comment on column public.setlist_slots.notes_by is
  'Whose words are in notes: charlie | member | dead_set. Null means unknown and gets no credit. Written by src/lib/slotNotes.ts; read by CharlieCredit surfaces.';

with free as (
  select
    ss.id,
    btrim(
      case
        when left(ss.notes, 17) = '{"__archive":true' then
          case when strpos(ss.notes, E'\n') > 0
               then substr(ss.notes, strpos(ss.notes, E'\n') + 1)
               else '' end
        else coalesce(ss.notes, '')
      end
    ) as text,
    st.description
  from public.setlist_slots ss
  join public.setlists st on st.id = ss.setlist_id
  where ss.notes_by is null
)
update public.setlist_slots ss
set notes_by = case
  when left(free.text, 1) = '{' then null
  when free.text like 'From %' then 'dead_set'
  when free.description like '%Ranked on fan votes. The ones polling under 30% of the leader are the sleepers.' then 'dead_set'
  else 'charlie'
end
from free
where ss.id = free.id
  and free.text <> '';
