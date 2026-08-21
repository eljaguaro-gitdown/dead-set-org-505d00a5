-- ============================================================================
-- The Songbook — a weekly, growing song-by-song feature series.
--
-- Two pieces:
--   1. `song_features` — one row per featured song, published on a weekly cadence.
--   2. Extra columns on `notable_versions` so a version can carry its ranking
--      and, critically, the SOURCE that ranking came from. No claim renders on
--      a public surface without a source_url behind it.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. notable_versions gains ranking + provenance
-- ---------------------------------------------------------------------------
alter table public.notable_versions
  add column if not exists votes         integer,
  add column if not exists vote_source   text,
  add column if not exists source_url    text,
  add column if not exists source_quote  text,
  add column if not exists blurb         text,
  add column if not exists is_benchmark  boolean not null default false,
  add column if not exists verified_at   timestamptz;

comment on column public.notable_versions.votes is
  'Public vote count from vote_source. NULL means unranked — the UI must not imply regard it cannot evidence.';
comment on column public.notable_versions.source_url is
  'Required before any superlative renders publicly. No source, no claim.';

create index if not exists notable_versions_song_votes_idx
  on public.notable_versions (song_id, votes desc nulls last);

-- ---------------------------------------------------------------------------
-- 2. song_features — the weekly series
-- ---------------------------------------------------------------------------
create table if not exists public.song_features (
  id            uuid primary key default gen_random_uuid(),
  song_id       uuid references public.songs(id) on delete set null,
  slug          text not null unique,
  title         text not null,

  -- publication
  week_of       date not null,
  published     boolean not null default false,
  issue_number  integer,

  -- editorial
  headline      text,
  dek           text,
  body          text,

  -- lifespan (FTP / LTP)
  ftp_date      text,
  ftp_venue     text,
  ftp_city      text,
  ltp_date      text,
  ltp_venue     text,
  ltp_city      text,
  ltp_note      text,
  times_played  integer,

  -- provenance for the lifespan figures themselves
  stats_source_name text,
  stats_source_url  text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists song_features_published_idx
  on public.song_features (published, week_of desc);

alter table public.song_features enable row level security;

drop policy if exists "Published song features are readable by everyone" on public.song_features;
create policy "Published song features are readable by everyone"
  on public.song_features for select
  using (published = true);

drop policy if exists "Admins manage song features" on public.song_features;
create policy "Admins manage song features"
  on public.song_features for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- RLS alone is not enough for Data API reads — grant explicitly.
grant select on public.song_features to anon, authenticated;
grant select on public.notable_versions to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Issue 001 — Shakedown Street
--    Every figure below is sourced. See stats_source_url / source_url columns.
-- ---------------------------------------------------------------------------
insert into public.songs (title, tags, is_jam_vehicle, typical_set_position, times_played)
select 'Shakedown Street', array['rocker','funk'], true, 'opener', 163
where not exists (select 1 from public.songs where title = 'Shakedown Street');

insert into public.song_features (
  song_id, slug, title, week_of, published, issue_number,
  headline, dek,
  ftp_date, ftp_venue, ftp_city,
  ltp_date, ltp_venue, ltp_city, ltp_note,
  times_played, stats_source_name, stats_source_url, body
)
select
  s.id,
  'shakedown-street',
  'Shakedown Street',
  date '2026-08-24',
  true,
  1,
  'One night is a moment. Seventeen years is a life.',
  'Rhino just released the 1985 Merriweather version — the one everybody names. Here are the other 162, laid out by era, including nine almost nobody has heard.',
  'Aug 31, 1978', 'Red Rocks Amphitheatre', 'Morrison, CO',
  'July 9, 1995', 'Soldier Field', 'Chicago, IL',
  'the last night the Grateful Dead ever played',
  163,
  'setlist.fm song statistics',
  'https://www.setlist.fm/song/grateful-dead/shakedown-street-1bd645cc.html',
  $md$On August 20, 2026, Rhino released the June 30, 1985 **Shakedown Street** as a standalone single — fifteen minutes that opened Set II at Merriweather Post Pavilion. David Lemieux, the band's own legacy manager and archivist, put it plainly: *"It's often described with well-deserved hyperbole; it's really that great."*

He is right, and forty years of heads got there first. It sits at the top of every ranked list anyone has taken a vote on.

But one night is a moment. Shakedown Street was played **163 times** across seventeen years, and the song you hear in 1978 is not the song you hear in 1991. It arrived as a disco-inflected groove with Donna still in the band. It sharpened under Brent. It detonated in 1985. And it went out with the band itself.

Because that is the part worth sitting with: the song's last performance was **July 9, 1995 at Soldier Field** — the final night the Grateful Dead ever played. It opened Set II that night, the same slot it took at Merriweather ten years earlier. Nobody planned that.

What follows is every ranked version, grouped by the era it belongs to. Nine of them are **sleepers**: enough heads voted them onto the all-time list that they are not random picks, but they poll under a third of Merriweather's count. Real regard, almost no attention. The other Barton Hall show. A Shakedown in West Germany. An MSG version from the Vince years that tops its whole era and still barely registers.

Go buy the Rhino single. Then come back and hear what else the song did.$md$
from public.songs s
where s.title = 'Shakedown Street'
  and not exists (select 1 from public.song_features where slug = 'shakedown-street');

-- The fifteen ranked versions. votes + vote_source from headyversion.
insert into public.notable_versions
  (song_id, show_date, venue, city, era_id, votes, vote_source, source_url, is_benchmark, blurb, verified_at)
select s.id, v.show_date, v.venue, v.city, e.id, v.votes,
       'headyversion',
       'https://headyversion.com/song/238/grateful-dead/shakedown-street/',
       v.is_benchmark, v.blurb, now()
from public.songs s
cross join (values
  ('1978-09-16','Sphinx Theatre','Giza, Egypt','Shakedown Street',58,false,
   'Sixteen days after the debut, played at the pyramids. In the pocket start to finish.'),
  ('1978-11-24','Capitol Theatre','Passaic, NJ','Shakedown Street',47,false,
   'Debut-year version from a room small enough to hear the band listening to each other.'),
  ('1979-01-15','Springfield Civic Center','Springfield, MA','Shakedown Street',71,false,
   'Comes out of a Miracle. Still in development as a live standard — as funky as it ever got.'),
  ('1979-10-25','New Haven Coliseum','New Haven, CT','Shakedown Street',168,true,
   'Phil drives the opening; the vocals dissolve into a Brent-and-Jerry funk excursion. The only version that seriously rivals Merriweather.'),
  ('1979-10-31','Nassau Coliseum','Uniondale, NY','Shakedown Street',40,false,
   'Halloween. Six days after New Haven, with the same band still red-hot.'),
  ('1979-12-26','Oakland Auditorium','Oakland, CA','Shakedown Street',53,false,
   'Brent''s first December with the band, and he spends the jam proving it.'),
  ('1981-03-28','Grugahalle','Essen, West Germany','Go to Nassau',39,false,
   'A European Shakedown almost nobody goes looking for. Different room, different band.'),
  ('1981-05-16','Barton Hall, Cornell University','Ithaca, NY','Go to Nassau',42,false,
   'The other Barton Hall show. Opens Set II and has spent forty years buried under 5/8/77.'),
  ('1982-04-06','The Spectrum','Philadelphia, PA','Go to Nassau',89,true,
   'The era''s consensus pick, and the bridge between the ''79 funk and the ''85 explosion.'),
  ('1983-04-26','The Spectrum','Philadelphia, PA','Go to Nassau',51,false,
   'Philly again, a year on. Lives permanently in the shadow of its own room-mate.'),
  ('1984-12-31','SF Civic Auditorium','San Francisco, CA','Touch of Grey',73,false,
   'Seventeen minutes, opening a New Year''s Eve show. Six months before Merriweather, same fire.'),
  ('1985-06-30','Merriweather Post Pavilion','Columbia, MD','Touch of Grey',181,true,
   'Fifteen minutes opening Set II. Archivist David Lemieux calls it one of the greatest single performances of any song the band ever played. Released by Rhino on Aug 20, 2026 and included on Summer Magic 1985.'),
  ('1987-09-18','Madison Square Garden','New York, NY','Touch of Grey',40,false,
   'Post-In the Dark, playing to a room half full of brand-new fans.'),
  ('1989-04-02','Civic Arena','Pittsburgh, PA','Touch of Grey',37,false,
   'Brent''s last full year. The most overlooked stretch of his playing on this song.'),
  ('1991-09-10','Madison Square Garden','New York, NY','Final Run',48,true,
   'Tops its whole era on 48 votes — fewer than versions that don''t even lead theirs. The Vince years are almost entirely unmapped.')
) as v(show_date, venue, city, era_name, votes, is_benchmark, blurb)
join public.eras e on e.name = v.era_name
where s.title = 'Shakedown Street'
  and not exists (
    select 1 from public.notable_versions nv
    where nv.song_id = s.id and nv.show_date = v.show_date
  );

-- The Merriweather version carries the quote that anchors the whole issue.
update public.notable_versions nv
set source_quote = 'It''s often described with well-deserved hyperbole; it''s really that great. — David Lemieux, Grateful Dead legacy manager & archivist'
from public.songs s
where nv.song_id = s.id
  and s.title = 'Shakedown Street'
  and nv.show_date = '1985-06-30';
