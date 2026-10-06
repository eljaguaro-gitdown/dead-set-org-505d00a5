-- Build Notes grouped itself by a hand-typed `week_number` and a hand-typed
-- `week_label`, so one bucket could call itself "Week 3" and span five months:
-- "Week 3 · Apr 21 – Sep 23, 2026". Nothing in the schema could notice, because
-- the week and its label were prose, not dates.
--
-- `shipped_on` makes the date the fact and the grouping a consequence of it.
-- The page derives the week and its label from this column, so an edition
-- cannot drift from the period it claims, and a new week forms on its own.
-- The default means a row written by the weekly routine is dated even if
-- nobody fills the field in.
alter table public.changelog_entries
  add column if not exists shipped_on date not null default current_date;

-- Every legacy "week" column becomes optional. They are no longer read for
-- grouping and are no longer written by the admin form; leaving them NOT NULL
-- would force a new entry to carry a week number and a date range that nothing
-- derives anything from — which is precisely how the two got out of step.
alter table public.changelog_entries alter column week_label drop not null;
alter table public.changelog_entries alter column week_number drop not null;
alter table public.changelog_entries alter column week_stats_updates drop not null;
alter table public.changelog_entries alter column week_stats_feedback drop not null;
alter table public.changelog_entries alter column week_stats_bugs drop not null;

comment on column public.changelog_entries.shipped_on is
  'The day this change reached people. Build Notes groups by the ISO week of '
  'this date; week_number/week_label are legacy and must not be used to group.';


-- REPLAY SAFETY. Everything below is a one-time backfill of rows that already
-- existed, so every statement is bounded to rows created before this migration
-- (the newest at the time was 2026-10-05 17:42Z). Without that bound a second
-- apply would not be idempotent — it would be destructive:
--   * `set published = true where published = false` publishes every draft
--     sitting in the queue at that moment, which is the opposite of a draft;
--   * `set edition_title = … where shipped_on >= '2026-10-05'` is open-ended
--     forward, so it would rename every edition shipped from then on;
--   * the title-keyed updates would re-date any future entry reusing a title.
-- Caught by the pre-release gate, which asked what happens if Lovable applies
-- repo migrations on sync. A backfill must say which rows it is for.

-- Backfill, dated from the commit that shipped each item. The repo''s history
-- begins 2026-08-09 (earlier work lives in the orphaned dead-set-org repo), so
-- anything before that keeps the archive date it already implied.
update public.changelog_entries set shipped_on = v.d from (values
  -- Week of Sep 14–20: Charlie's picks made honest, and iOS sign-in back
  ('The listen clock stopped freezing when you switched tabs',        date '2026-09-16'),
  ('Dig deeper by year range on any song''s version ladder',          date '2026-09-17'),
  ('Charlie''s version notes now make it all the way to the poster',  date '2026-09-18'),
  ('No more offering a version that isn''t actually on the tape',     date '2026-09-18'),
  ('Charlie judges a version against its own era',                    date '2026-09-18'),
  ('"Play the sleepers" now plays the sleepers',                      date '2026-09-19'),
  ('Share-card posters are easier to read',                           date '2026-09-20'),
  ('Sign in with Google and Apple on the iPhone build',               date '2026-09-20'),
  -- Week of Sep 21–27: the iPhone week
  ('Signup errors that actually tell you what to do',                 date '2026-09-21'),
  ('The three "strain" chips have new names',                         date '2026-09-21'),
  ('Dead Set is in testing on iPhone',                                date '2026-09-22'),
  ('A tape that won''t play no longer runs away with your set',       date '2026-09-23'),
  ('The tape keeps rolling on your iPhone',                           date '2026-09-23'),
  ('No more false stall warning after switching apps',                date '2026-09-24'),
  ('Cosmic Charlie''s whole note, and new icons',                     date '2026-09-24'),
  -- Week of Sep 28 – Oct 4: the song-first front door
  ('Report and block, everywhere',                                    date '2026-09-30'),
  ('Close buttons you can see',                                       date '2026-10-02'),
  ('A listening guide plays the night each card describes',           date '2026-10-03'),
  ('Pick a song, meet the nights worth hearing',                      date '2026-10-04'),
  -- Week of Oct 5–11: between the tap and the sound
  ('Play All says it''s cueing up',                                   date '2026-10-05'),
  ('Play starts in a blink',                                          date '2026-10-05'),
  ('The Songbook reads like a Songbook',                              date '2026-10-05'),
  ('Rows stop saying "no tape" when the tape plays',                  date '2026-10-05'),
  -- The backlog the "Long Strange Gap" edition was written to cover. The last
  -- commit before the quiet stretch is Aug 21; nothing ships again until
  -- Sep 14, which is why Aug 24 is the archive's closing date.
  ('A "Firsts & Lasts" chip for Cosmic Charlie',                      date '2026-08-13'),
  ('Tap a friend''s name in a message thread to see their sets',      date '2026-08-13'),
  ('A built setlist starts playing the moment it''s done',            date '2026-08-15'),
  ('The Songbook',                                                    date '2026-08-21')
) as v(t, d)
where changelog_entries.title = v.t
    and changelog_entries.created_at < timestamptz '2026-10-06 00:00:00+00';

-- The two April editions predate this repo's history. They were already honest
-- weekly editions, so they keep their stated weeks; a date inside each range
-- reproduces the same grouping.
update public.changelog_entries set shipped_on = date '2026-04-09'
  where week_number = 1 and created_at < timestamptz '2026-10-06 00:00:00+00';
update public.changelog_entries set shipped_on = date '2026-04-17'
  where week_number = 2 and created_at < timestamptz '2026-10-06 00:00:00+00';

-- Edition titles are per-week, and re-dating split one bucket into four. Name
-- each week for what it actually carried.
update public.changelog_entries set edition_title = 'Set the Tape Straight'
  where shipped_on between date '2026-09-14' and date '2026-09-20'
    and created_at < timestamptz '2026-10-06 00:00:00+00';
update public.changelog_entries set edition_title = 'The Silent Switch'
  where shipped_on between date '2026-09-21' and date '2026-09-27'
    and created_at < timestamptz '2026-10-06 00:00:00+00';
update public.changelog_entries set edition_title = 'Pick a Song, Hear the Night'
  where shipped_on between date '2026-09-28' and date '2026-10-04'
    and created_at < timestamptz '2026-10-06 00:00:00+00';
update public.changelog_entries set edition_title = 'Between the Tap and the Sound'
  where shipped_on between date '2026-10-05' and date '2026-10-11'
    and created_at < timestamptz '2026-10-06 00:00:00+00';
-- The name was always right for the backlog; it was wrong only as a "week".
update public.changelog_entries set edition_title = 'The Long Strange Gap'
  where shipped_on between date '2026-04-21' and date '2026-08-24'
    and created_at < timestamptz '2026-10-06 00:00:00+00';

-- Keep the typed label ONLY where it cannot be derived: the two April editions
-- and the catch-up archive, all published before shipped_on existed. Anywhere
-- else a stored label is what lets an edition disagree with its own dates.
update public.changelog_entries set week_label = null
  where shipped_on >= date '2026-04-21' and created_at < timestamptz '2026-10-06 00:00:00+00';
update public.changelog_entries set week_label = 'Apr 21 – Aug 24, 2026'
  where shipped_on between date '2026-04-21' and date '2026-08-24'
    and created_at < timestamptz '2026-10-06 00:00:00+00';

-- The Sep 24 – Oct 5 edition sat written-but-unpublished, which is the other
-- half of why the page looked frozen on a five-month "week".
update public.changelog_entries set published = true
  where published = false and created_at < timestamptz '2026-10-06 00:00:00+00';

-- Brand rule, live on /updates since April: the word "AI" never appears on a
-- user-facing surface, and Cosmic Charlie is a fan with deep crates — never a
-- "generator". Found by sweeping the published rows while re-dating them.
update public.changelog_entries
  set title = 'Cosmic Charlie builds you a night'
  where title = 'Cosmic Charlie — AI setlist generator'
    and created_at < timestamptz '2026-10-06 00:00:00+00';
