# What makes a sleeper, and how well the Archive can tell

Validated 2026-09-26 against the only ground truth that exists: the
headyversion votes hand-transcribed into `notable_versions` for **Crazy
Fingers** and **Shakedown Street**, 15 versions each, `vote_source =
'headyversion'` with a `source_url` on every row.

## The rule

`supabase/functions/_shared/sleeperScore.ts`. A sleeper is a recording **rated
as highly as the song's best, that almost nobody pulls down** — under
`SLEEPER_RATIO` (0.3) of the song's most-pulled version, with at least
`MIN_REVIEWS` (3) reviews so one enthusiast cannot crown anything, and within
`RATING_TOLERANCE` (0.5) of the best credible rating.

Downloads are divided by months on the Archive. Raw counts reward age: a 2004
etree upload has had twenty years to accumulate and a 2019 one has not.

Everything is measured **within a song**. A catalogue-wide download floor
would call every Dark Star version a sleeper and none of Touch of Grey's.

## The result: 18 of 30

| Song | Agreement with headyversion |
|---|---|
| Crazy Fingers | **12/15 (80%)** — and 2 of the 3 misses sit within 0.05 of the cutoff |
| Shakedown Street | **6/15 (40%)** |

Crazy Fingers alone would have read as a validated method. Shakedown Street is
why one song is not a validation.

## Why they disagree — structural, not noise

**Archive items are shows. headyversion votes are song performances.** An
Archive item is a whole concert, usually with several tapes of it; its
`avg_rating` and `downloads` describe the night, not the song.

The sharpest case: **1987-09-18 MSG** is the **2nd most-pulled** of Shakedown's
fifteen shows (0.902 share) and a headyversion **sleeper** for Shakedown
(0.221 share). A famous night whose Shakedown nobody rates. No amount of
Archive metadata can see that.

The distributions also differ in shape. headyversion concentrates — Shakedown's
top two hold 181 and 168 votes, so 9 of 15 fall under 30% of the leader.
Archive pulls spread — only 4 of 15 do. The same cutoff therefore selects
different sets even where the ordering broadly agrees.

## What follows

**Do not present Archive-derived sleepers as what heads think.** They are not,
and 40% is the evidence. Two honest and different claims:

- **headyversion** → *"the version heads swear by."* Song-level. 2 songs.
- **Archive metrics** → *"a night you probably haven't spun."* Show-level. All 234.

Both are worth shipping. The UI must say which it is showing, and
`notable_versions.vote_source` already carries the distinction.

## The bridge worth a spike

Archive **reviews are free text**, and heads routinely write "the Scarlet is
unreal." Mining review bodies for song mentions would give song-level signal
from a source the app already reads — no rights question, nothing scraped from
anyone's database. That is the only route found so far from show-level data to
the song-level claim headyversion makes.

## Reproducing this

`score-sleepers` takes a song title and returns the scored recordings. The
validation above used `net.http_get` from the production database against
`archive.org/advancedsearch.php`, aggregating per show date: summed downloads,
earliest `publicdate`, best rating among items with 3+ reviews. Archive's
search takes several seconds — pg_net's 5s default times out, 30s is enough.
