-- ============================================================================
-- The Songbook — Issue 002: Crazy Fingers.
--
-- Same shape as 20260821120000_songbook.sql (Issue 001): one song_features row
-- plus its ranked notable_versions. Every figure below carries a source:
--
--   · FTP / LTP / play count  — setlist.fm song statistics (stats_source_url)
--   · the 417-concert gap     — dead.net, "Greatest Stories Ever Told"
--   · every vote count        — headyversion (vote_source / source_url)
--
-- New this issue: every version carries an archive_org_url. Issue 001 shipped
-- with two of fifteen, so thirteen rungs of that ladder had a play button that
-- resolved to nothing. Each identifier below was confirmed to hold a Crazy
-- Fingers track with an MP3 derivative before it went in.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The song is already in the catalogue. Only the play count moves, onto the
--    same setlist.fm basis the issue page cites — the vault said 118 against
--    setlist.fm's 145 (which files the 2015 Fare Thee Well performance under
--    the Grateful Dead; the body copy below says so out loud rather than
--    quietly subtracting it).
-- ---------------------------------------------------------------------------
update public.songs
set times_played = 145
where title = 'Crazy Fingers'
  and times_played is distinct from 145;

-- ---------------------------------------------------------------------------
-- 2. The issue
-- ---------------------------------------------------------------------------
insert into public.song_features (
  song_id, slug, title, week_of, published, issue_number,
  headline, dek,
  ftp_date, ftp_venue, ftp_city,
  ltp_date, ltp_venue, ltp_city, ltp_note,
  times_played, stats_source_name, stats_source_url, body
)
select
  s.id,
  'crazy-fingers',
  'Crazy Fingers',
  date '2026-09-14',
  true,
  2,
  'They put it down for 417 shows. It came back a different song.',
  'Nine of the fifteen ranked versions come from the first eighteen months, before the band shelved it. What happened to the song after the gap is the part nobody plays you.',
  'June 17, 1975', 'Winterland Arena', 'San Francisco, CA',
  'July 5, 1995', 'Riverport Amphitheatre', 'Maryland Heights, MO',
  'three shows before the band''s last night',
  145,
  'setlist.fm song statistics',
  'https://www.setlist.fm/song/grateful-dead/crazy-fingers-4bd6fb56.html',
  $md$On **June 17, 1975**, at a benefit called the Bob Fried Memorial Boogie at Winterland, the band played a song nobody in the room had heard yet. *Blues for Allah* was still months from the shops. Robert Hunter has said the words started as *"a page or two of haiku I'd been working on in a notebook"* — and Garcia found the shape of them.

Then, after 1976, they put it down and left it there for **417 concerts**. That count is the band's own, from the Greatest Stories Ever Told entry on dead.net. It came back mid-1982, went away again between October 1983 and April 1985, and came back a second time. A song with two resurrections in it does not sound the same on either side of them.

The ladder below shows you what that cost. **Nine of the fifteen ranked versions are from 1975 and 1976** — the song's first eighteen months — and most of them run past twelve minutes. **June 9, 1976 at the Boston Music Hall** tops the whole list on 92 votes and runs 14:38 on the tape that circulates. Second place, August 13, 1975 at the Great American Music Hall, is the night that became *One from the Vault*, which is to say it is the version most people have actually heard.

After the gap the song got shorter and the votes got thin. **Seven of the fifteen are sleepers** — ranked by enough heads to be real, but polling under 28 votes against 92. And here is the number worth sitting with: the best-regarded Crazy Fingers of the entire Brent era, **July 2, 1989 at Sullivan Stadium**, polls 24. It leads its era *and* it falls under the sleeper line at the same time. Six years of the song, and the consensus pick barely registers.

The last one was **July 5, 1995 at Riverport Amphitheatre**, outside St. Louis. The band played three more shows after that night and never called it again.

One wrinkle we would rather show than smooth over: setlist.fm counts 145 Grateful Dead performances, and one of them is July 3, 2015 at Soldier Field — Fare Thee Well, twenty years after Riverport. Which number you use depends on which band you mean.

Fifteen versions below, grouped by era, every one of them on tape. Start at the top of 1976. Then go find out what happened to it.$md$
from public.songs s
where s.title = 'Crazy Fingers'
  and not exists (select 1 from public.song_features where slug = 'crazy-fingers');

-- ---------------------------------------------------------------------------
-- 3. The fifteen ranked versions.
--    votes + vote_source from headyversion; archive_org_url verified to carry
--    a Crazy Fingers track. Era join is by name so the uuids stay out of here.
-- ---------------------------------------------------------------------------
insert into public.notable_versions
  (song_id, show_date, venue, city, era_id, votes, vote_source, source_url,
   archive_org_url, is_benchmark, blurb, verified_at)
select s.id, v.show_date, v.venue, v.city, e.id, v.votes,
       'headyversion',
       'https://headyversion.com/song/61/grateful-dead/crazy-fingers/',
       v.archive_org_url, v.is_benchmark, v.blurb, now()
from public.songs s
cross join (values
  ('1975-06-17','Winterland Arena','San Francisco, CA','Hiatus & Return',32,
   'https://archive.org/details/gd1975-06-17.sbd.GEMS.96125.flac16',false,
   'The first one. Eleven minutes, played at a benefit, months before Blues for Allah was in the shops.'),
  ('1975-08-13','Great American Music Hall','San Francisco, CA','Hiatus & Return',79,
   'https://archive.org/details/gd1975-08-13.155570.FM.flegel.flac1644',false,
   'The One from the Vault night — the version most people have actually heard, and it still only polls second.'),
  ('1976-06-03','Paramount Theatre','Portland, OR','Hiatus & Return',28,
   'https://archive.org/details/gd1976-06-03.139643.sbd.betty.pcm.kreider.miller.clugston.fixed.flac16',false,
   'Four votes above the sleeper line. 11:35, from the first week of the 1976 comeback run.'),
  ('1976-06-09','Boston Music Hall','Boston, MA','Hiatus & Return',92,
   'https://archive.org/details/gd1976-06-09.sbd.miller.95399.sbeok.flac16',true,
   'Tops the all-time list on 92 votes. 14:38 on the Miller soundboard — the long, unhurried read of the song.'),
  ('1976-06-14','Beacon Theatre','New York, NY','Hiatus & Return',76,
   'https://archive.org/details/gd1976-06-14.143026.sbd.betty.composite.dalton.miller.clugston.flac1644',false,
   'Second set, 12:16. Third on the list, and still inside the same eight-week stretch as the two above it.'),
  ('1976-06-18','Capitol Theatre','Passaic, NJ','Hiatus & Return',17,
   'https://archive.org/details/gd1976-06-18.165169.sony.ecm99.warburton.wagner.miller.t-flac1644',false,
   'Bottom of the list on seventeen votes — 14:06, off an audience tape. Nothing in the playing says last place.'),
  ('1976-06-22','Tower Theatre','Upper Darby, PA','Hiatus & Return',24,
   'https://archive.org/details/gd1976-06-22.sbd.digitalrbb.miller.112218.flac16',false,
   'Segues straight out. 12:42 on the Miller soundboard, and almost nobody goes looking for it.'),
  ('1976-07-13','Orpheum Theatre','San Francisco, CA','Hiatus & Return',37,
   'https://archive.org/details/gd1976-07-13.152150.sbd.1stGen.miller.version2.t.flac16',false,
   'Home-town run at the Orpheum. 14:51, and it segues out rather than landing.'),
  ('1976-09-30','Mershon Auditorium, OSU','Columbus, OH','Hiatus & Return',19,
   'https://archive.org/details/gd1976-09-30.sbd.18107.shnf',false,
   'At 15:41 it is the longest Crazy Fingers on this list. Nineteen votes.'),
  ('1982-10-10','Frost Amphitheatre','Palo Alto, CA','Go to Nassau',41,
   'https://archive.org/details/gd1982-10-10.141523.sbd.pcm.dalton.miller.clugston.flac1644',true,
   'The era''s consensus pick, from months after the song came back off the shelf. 11:40.'),
  ('1989-07-02','Sullivan Stadium','Foxboro, MA','Touch of Grey',24,
   'https://archive.org/details/gd1989-07-02.138287.sbd.miller.flac24',true,
   'Leads its whole era on 24 votes and falls under the sleeper line doing it. 7:40 — the tightest version here.'),
  ('1990-09-15','Madison Square Garden','New York, NY','Final Run',20,
   'https://archive.org/details/gd1990-09-15.161622.UltraMatrix.sbd.cm.miller.t.flac1644',false,
   'Seven weeks after Brent died, with the band still rebuilding around the keyboard. 9:32.'),
  ('1991-09-25','Boston Garden','Boston, MA','Final Run',32,
   'https://archive.org/details/gd1991-09-25.149681.sbd.cm.miller.flac16',true,
   'Leads the Vince years on 32 votes. 9:40 — post-revival length, nothing like the 1976 sprawl.'),
  ('1993-03-24','Dean Smith Center','Chapel Hill, NC','Final Run',20,
   'https://archive.org/details/gd1993-03-24.sbd.miller.109210.flac16',false,
   '12:52, the longest of anything after the revival — a full minute past the 1982 return.'),
  ('1993-05-26','Cal Expo','Sacramento, CA','Final Run',20,
   'https://archive.org/details/gd93-05-26.sbd.miller.27776.sbeok.flacf',false,
   '9:34, from a Sacramento run heads rate highly and the ladder barely knows about.')
) as v(show_date, venue, city, era_name, votes, archive_org_url, is_benchmark, blurb)
join public.eras e on e.name = v.era_name
where s.title = 'Crazy Fingers'
  and not exists (
    select 1 from public.notable_versions nv
    where nv.song_id = s.id and nv.show_date = v.show_date
  );

-- ---------------------------------------------------------------------------
-- 4. The hero cassette follows the current issue. One spotlight at a time —
--    Shakedown Street hands it over. Clearing both flags stops the takeover
--    and returns the cassette to the daily community rotation; no deploy.
-- ---------------------------------------------------------------------------
update public.song_features set spotlight = false where slug <> 'crazy-fingers';
update public.song_features set spotlight = true  where slug =  'crazy-fingers';
