# The first/last-played dates are wrong for 94% of songs

Found 2026-10-05 from a single bug report: a fresh Bird Song listening guide
showed no notes and would not play any of its three nights.

**The Instagram promo is held until this is fixed.** The post is built on
"first time played / last time played", which is the broken field.

## The player is not at fault

All three reported symptoms are one cause. The catalog names a night the song
was not performed on; the player resolves that night's tape, cannot find the
song on it, and refuses to stream it. Refusing is correct — it is the fix that
stopped Ripple playing Dark Star. Reverting it would restore audio by playing
the wrong song.

## Scale

Measured by replaying the app's own `matchScore` at its real threshold of 60
against Archive track listings, for 164 of the 191 songs carrying date pairs.

| | |
|---|---|
| songs with at least one unplayable milestone | **154 of 164 (94%)** |
| milestone claims naming a night without the song | **232 of 328 (71%)** |
| claims failing because no tape exists at all | 8 |
| songs where both milestones work | **10** |

`first_played` is mostly right; `last_played` is mostly wrong. **70 songs claim
`last_played = 1995-07-09`**, the final show, which had 17 distinct tracks. St.
Stephen, retired in 1983, is among them. It breaks the other way too: Corrina,
Unbroken Chain, Lazy River Road, Little Red Rooster and When I Paint My
Masterpiece *are* in the final show and carry earlier dates. Nine more songs
hold a bare year such as `1985` where a date belongs.

**Why this survived every test until now:** nine of the ten songs that work
were in the final show. The bad import defaulted everything there, so the only
songs it got right are the famous staples anyone would reach for to demo the
feature. Shakedown Street — the promo song — is one of them.

## The proposed correction

Derived from tape evidence: for each song, the earliest and latest night whose
recording carries a matching track. 2,074 show dates swept, one recording per
date (best-downloaded first, falling back when a tape looked partial).

A date derived this way is **guaranteed playable**, because it is chosen on the
grounds that the app can already resolve it. A true setlist date carries no
such guarantee — the 1991-09-10 Althea in CLAUDE.md is a night the band played
whose tapes do not carry the song, and it fails at play time either way.

**This is a weaker claim than the UI currently makes.** It answers "the
earliest night of this song that circulates", not "the first time they played
it". For most post-1969 songs they coincide; for patchy early years they do
not. The copy must say what we can prove. The field guide already puts the
voice in tape culture — recordings *circulate*, `/setlist/:id` says *on tape* —
so "the earliest night that circulates" is both more honest and more on-brand.

### Four false-positive classes, each found by a wrong row, not by suspicion

| class | the row that exposed it |
|---|---|
| studio material dated as a show | Bird Song's "debut" was `gd1971-02-01.sbd.Studio.Rehearsal`; Ripple's was `gd70-workingmans-outtakes` |
| filename matched instead of track title | Bertha's was `gd69-04-21.sbd.bertha-ashley` — the *taper's name* |
| a quotation, not a performance | Cosmic Charlie's "last" was a 1994 "Cosmic Charlie Tease" |
| titles too generic to carry a milestone | Jam, Space and Drums match 444 / 1171 / 1528 nights |

All four are excluded. Verified afterwards: Bird Song's debut derives to
**1971-02-19**, matching an independent check of two recordings from that
night; Unbroken Chain's to **1995-03-19**, its real live debut; Ripple's,
Bertha's, Althea's and Touch of Grey's firsts hold unchanged.

### Split for review

- **200 changes move the date by less than a year.** Low risk.
- **77 move it by more than a year and need individual review.** This bucket
  holds both real corrections (Here Comes Sunshine genuinely returned in the
  90s; the catalog's 1974 is wrong) and real errors ("Baby Blue" matched *It's
  All Over Now Baby Blue*, a separate catalog entry).

Nothing has been written to the database. The full tables are below.

## A separate live bug this uncovered

At the app's own threshold, **a search for "U.S. Blues" is satisfied by any of
ten other songs** — Cumberland Blues, Mexicali Blues, Viola Lee Blues, Walkin'
Blues, Big Railroad Blues, Blues for Allah, Duprees Diamond Blues, Just Like
Tom Thumbs Blues, Minglewood Blues, New Minglewood Blues. "Lovelight" and "Turn
on Your Love Light" match each other, as do "Playing in the Band" and its
Reprise, and the two Minglewoods.

This is the Ripple-played-Dark-Star class of defect and is live now,
independent of the date problem. `matchScore` is too permissive for short
titles built from common words. 16 collisions in the 164-song sample; the true
count is higher, since 27 songs were not in the sample.

## Still open

- **Notes.** Only 27 of 234 songs have any `notable_versions` row, and 30 of 63
  of those carry a blurb. That is why a picker-made guide is bare while a
  Charlie-made one has prose: Charlie writes them, and the picker's "Keep it"
  flow has nothing to write.
- **Rotten identifiers.** Bird Song's one catalog version points at
  `gd1972-04-08.sbd.miller.24659.sbeok.flac16`, which returns `{}` — and so
  does the `.flac16`-stripped fallback. All 63 `notable_versions` URLs want the
  same sweep.
- **Whipping Post** resolves to no night at all and needs a human.

### Within one year — 200 changes

| song | field | catalog | derived | delta | evidence | matched track |
|---|---|---|---|---|---|---|
| Alabama Getaway | first | 1979-11-01 | **1979-11-04** | 3d | `gd1979-11-04.142917.sbd.miller.flac1648` | 11 Alabama Getaway |
| Alabama Getaway | last | 1995-07-09 | **1995-06-02** | 37d | `gd95-06-02.sbd.583.sbeok.shnf` | Alabama Getaway |
| All Along the Watchtower | first | 1987-09-18 | **1987-06-20** | 90d | `gd87-06-20.matrix.ladner.11561.sbeok.shnf` | All Along The Watchtower > |
| All Along the Watchtower | last | 1995-07-02 | **1995-06-22** | 10d | `gd95-06-22.naks.18802.sbeok.shnf` | All Along the Watchtower |
| Alligator | first | 1967-09-29 | **1967-01-27** | 245d | `gd67-01-27.aud.hanno.16744.sbeok.shnf` | Alligator |
| Alligator | last | 1971-10-31 | **1971-04-29** | 185d | `gd71-04-29.sbd.frisco.16782.sbeok.shnf` | Alligator |
| Althea | last | 1995-07-09 | **1995-07-08** | 1d | `gd95-07-08.sbd.10071.sbeok.shnf` | Althea |
| Around and Around | last | 1995-07-05 | **1995-07-06** | 1d | `gd95-07-06.NEWsbd.30888.sbeok.shnf_shn` | Around And Around |
| Baby Blue | last | 1995-07-09 | **1995-02-19** | 140d | `gd95-02-19.schoeps.10544.sbeok.shnf` | It's All Over Now Baby Blue |
| Beat It On Down the Line | last | 1995-07-08 | **1994-10-03** | 278d | `gd94-10-03.pmb.pujol.15112.sbeok.shnf` | Beat It on Down the Line |
| Bertha | last | 1995-07-09 | **1995-06-27** | 12d | `gd95-06-27.schoeps.10180.sbeok.shnf` | Bertha |
| Big Railroad Blues | last | 1995-07-05 | **1995-06-28** | 7d | `gd95-06-28.schoeps.10154.sbeok.shnf` | Big Railroad Blues |
| Big River | last | 1995-07-09 | **1995-07-06** | 3d | `gd95-07-06.NEWsbd.30888.sbeok.shnf_shn` | Big River |
| Bird Song | first | 1971-03-24 | **1971-02-19** | 33d | `gd71-02-19.sbd.orf.1029.sbeok.shnf` | Bird Song |
| Bird Song | last | 1995-07-09 | **1995-06-30** | 9d | `gd95-06-30.schoeps.3376.sbeok.shnf` | Bird Song |
| Black Muddy River | first | 1986-12-15 | **1986-12-01** | 14d | `gd1986-12-01.170842.sbd.miller.flac1648` | Black Muddy River |
| Black Peter | last | 1995-07-09 | **1995-06-22** | 17d | `gd95-06-22.naks.18802.sbeok.shnf` | Black Peter |
| Black-Throated Wind | first | 1972-01-02 | **1972-03-05** | 63d | `gd72-03-05.sbd.miller.20739.sbeok.shnf` | Black Throated Wind |
| Black-Throated Wind | last | 1995-06-30 | **1995-06-28** | 2d | `gd95-06-28.schoeps.10154.sbeok.shnf` | Black Throated Wind |
| Blues for Allah | first | 1975-03-23 | **1975-03-01** | 22d | `gd1975-03-01.145786.sbd.gans.miller.noel.flac1644` | Blues for Allah |
| Born Cross-Eyed | first | 1967-10-22 | **1967-11-14** | 23d | `gd67-11-14.sbd.unknown.17417.sbefail.shnf` | Born Cross-Eyed>Feedback |
| Born Cross-Eyed | last | 1968-10-20 | **1969-06-01** | 224d | `gd1969-06-01.136665.sbd.sirmick.flac16` | Born Cross-Eyed > banter |
| Brokedown Palace | last | 1995-07-09 | **1995-06-25** | 14d | `gd95-06-25.sbd.2236.sbefail.shnf` | Brokedown Palace |
| Brown Eyed Women | first | 1971-08-23 | **1971-09-30** | 38d | `gd71-09-30.sbd.cousinit.18109.sbeok.shnf` | Brown-Eyed Women |
| Brown Eyed Women | last | 1995-07-09 | **1995-07-06** | 3d | `gd95-07-06.NEWsbd.30888.sbeok.shnf_shn` | Brown Eyed Women |
| Casey Jones | first | 1970-06-07 | **1969-06-22** | 350d | `gd69-06-22.aud.hanno.8836.sbefail.shnf` | Casey Jones |
| China Cat Sunflower | first | 1968-06-14 | **1968-01-17** | 149d | `gd1968-01-17.sbd.cotsman.11795.shnf` | China Cat Sunflower -> |
| China Cat Sunflower | last | 1995-07-09 | **1995-07-08** | 1d | `gd95-07-08.sbd.10071.sbeok.shnf` | China Cat Sunflower |
| China Doll | last | 1995-07-08 | **1994-10-11** | 270d | `gd1994-10-11.sbd.miller.34564.sbeok.flac16` | China Doll -> |
| Cold Rain and Snow | first | 1966-07-03 | **1966-02-25** | 128d | `gd66-02-25.sbd.unknown.1593.sbefail.shnf` | Cold Rain & Snow |
| Cold Rain and Snow | last | 1995-07-05 | **1995-06-30** | 5d | `gd95-06-30.schoeps.3376.sbeok.shnf` | Rain |
| Comes a Time | first | 1971-03-24 | **1971-10-21** | 211d | `gd1971-10-21.sbd.miller.112086.flac16` | Comes A Time |
| Comes a Time | last | 1995-07-05 | **1994-10-09** | 269d | `gd94-10-09.sbd.braverman.17357.sbeok.shnf` | Comes a Time |
| Corrina | first | 1992-02-22 | **1992-02-23** | 1d | `gd92-02-23.schoeps.gardner.9982.sbeok.shnf` | Corrina |
| Corrina | last | 1995-07-08 | **1995-07-09** | 1d | `gd95-07-09.sbd.7233.sbeok.shnf` | Corrina |
| Cosmic Charlie | first | 1968-06-14 | **1968-10-08** | 116d | `gd68-10-08.sbd.belaff.17691.sbeok.shnf` | Cosmic Charlie |
| Cosmic Charlie | last | 1976-06-19 | **1976-09-25** | 98d | `gd76-09-25.sbd.aj.246.sbefail.shnf` | Cosmic Charlie |
| Crazy Fingers | first | 1975-03-23 | **1975-02-28** | 23d | `gd1975-02-28.sbd.smith.93779.sbeok.flac16` | Distorto (Crazy Fingers) Jam |
| Crazy Fingers | last | 1995-07-09 | **1995-07-05** | 4d | `gd1995-07-05.sbd.larson.35170.flac16` | Crazy Fingers |
| Cryptical Envelopment | first | 1968-06-14 | **1967-10-31** | 227d | `gd1967-10-31.sbd.unclebarry-kikola.33933.flac16` | Cryptical Envelopment -> |
| Cryptical Envelopment | last | 1985-11-01 | **1985-09-03** | 59d | `gd85-09-03.oade.sacks.7691.sbeok.shnf` | Cryptical Envelopment |
| Cumberland Blues | first | 1969-01-17 | **1969-11-15** | 302d | `gd69-11-15.sbd.tiedrich.9535.sbeok.shnf` | Cumberland Blues |
| Cumberland Blues | last | 1995-07-02 | **1995-07-09** | 7d | `gd95-07-09.sbd.7233.sbeok.shnf` | Cumberland Blues |
| Dark Star | first | 1968-02-14 | **1967-11-14** | 92d | `gd67-11-14.sbd.unknown.17417.sbefail.shnf` | Dark Star |
| Days Between | last | 1995-07-09 | **1995-06-24** | 15d | `gd95-06-24.naks.12271.sbeok.shnf` | The Days Between |
| Deal | first | 1971-02-18 | **1971-02-19** | 1d | `gd71-02-19.sbd.orf.1029.sbeok.shnf` | Deal |
| Deal | last | 1995-07-09 | **1995-06-18** | 21d | `gd95-06-18.aud.2543.sbeok.shnf` | Deal |
| Desolation Row | last | 1995-03-27 | **1995-07-02** | 97d | `gd95-07-02.aud.unk.12578.sbeok.shnf` | Desolation Row |
| Dire Wolf | first | 1969-12-04 | **1969-06-07** | 180d | `gd69-06-07.sbd.kaplan.9074.sbeok.shnf` | Dire Wolf |
| Dire Wolf | last | 1995-07-09 | **1995-07-02** | 7d | `gd95-07-02.aud.unk.12578.sbeok.shnf` | Dire Wolf |
| Duprees Diamond Blues | first | 1969-02-27 | **1969-01-24** | 34d | `gd69-01-24.sbd.kaplan.7922.sbeok.shnf` | Dupree's Diamond Blues |
| Duprees Diamond Blues | last | 1994-10-01 | **1994-10-13** | 12d | `gd94-10-13.sbd.wiley.7800.sbefail.shnf` | Dupree's Diamond Blues |
| Easy Answers | first | 1993-03-24 | **1993-06-05** | 73d | `gd93-06-05.sbd.wiley.8328.sbeok.shnf` | Easy Answers |
| Easy Wind | first | 1969-12-04 | **1969-08-21** | 105d | `gd69-08-21.sbd.cotsman.13850.sbeok.shnf` | Easy Wind |
| Easy Wind | last | 1971-02-18 | **1971-04-04** | 45d | `gd1971-04-04.sbd.miller.110325.flac16` | Easy Wind |
| El Paso | first | 1969-08-28 | **1970-07-11** | 317d | `gd70-07-11.aud.cotsman.9379.sbefail.shnf` | El Paso |
| El Paso | last | 1995-07-09 | **1995-07-05** | 4d | `gd1995-07-05.sbd.larson.35170.flac16` | El Paso |
| Estimated Prophet | first | 1977-02-26 | **1977-02-20** | 6d | `gd77-02-20.sbd.moreno.9470.sbeok.shnf` | Estimated Prophet |
| Estimated Prophet | last | 1995-07-09 | **1995-06-28** | 11d | `gd95-06-28.schoeps.10154.sbeok.shnf` | Estimated Prophet |
| Eternity | last | 1995-07-02 | **1995-07-08** | 6d | `gd95-07-08.sbd.10071.sbeok.shnf` | Eternity |
| Eyes of the World | last | 1995-07-09 | **1995-07-06** | 3d | `gd95-07-06.NEWsbd.30888.sbeok.shnf_shn` | Eyes Of The World |
| Feel Like a Stranger | first | 1980-04-28 | **1980-03-31** | 28d | `gd80-03-31.senn.barbella.4741.sbeok.shnf` | Feel Like a Stranger |
| Feel Like a Stranger | last | 1995-07-06 | **1995-07-05** | 1d | `gd1995-07-05.sbd.larson.35170.flac16` | Feel Like A Stranger |
| Fire on the Mountain | first | 1977-03-18 | **1977-02-20** | 26d | `gd77-02-20.sbd.moreno.9470.sbeok.shnf` | Fire on the Mountain |
| Fire on the Mountain | last | 1995-07-09 | **1995-07-02** | 7d | `gd95-07-02.aud.unk.12578.sbeok.shnf` | Fire On The Mountain |
| Foolish Heart | first | 1989-02-06 | **1988-06-19** | 232d | `gd88-06-19.sennheiser.ladner.17267.sbeok.shnf` | Foolish Heart |
| Foolish Heart | last | 1995-07-06 | **1995-06-27** | 9d | `gd95-06-27.schoeps.10180.sbeok.shnf` | Foolish Heart |
| Franklin's Tower | first | 1975-06-17 | **1975-06-04** | 13d | `gd1975-06-04.145777.sbd.pcm.dalton.miller.noel.flac16` | Franklin's Tower |
| Franklin's Tower | last | 1995-07-09 | **1995-06-22** | 17d | `gd95-06-22.naks.18802.sbeok.shnf` | Franklin's Tower |
| Friend of the Devil | first | 1970-06-07 | **1970-03-20** | 79d | `gd70-03-20.sbd.late.hamilton.14287.sbeok.shnf` | Friend Of The Devil |
| Friend of the Devil | last | 1995-07-09 | **1995-06-24** | 15d | `gd95-06-24.naks.12271.sbeok.shnf` | Friend Of The Devil |
| Going Down the Road Feeling Bad | first | 1970-06-24 | **1970-10-11** | 109d | `gd70-10-11.aud.cotsman.9500.sbeok.shnf` | Goin' Down The Road Feelin' Bad |
| Going Down the Road Feeling Bad | last | 1995-07-09 | **1995-07-05** | 4d | `gd1995-07-05.sbd.larson.35170.flac16` | Goin' Down The Road Feeling Bad > |
| Good Lovin | first | 1966-07-03 | **1966-05-19** | 45d | `gd66-05-19.sbd.lestatkat.6516.sbeok.shnf` | Good Lovin' |
| Good Lovin | last | 1995-07-09 | **1995-06-28** | 11d | `gd95-06-28.schoeps.10154.sbeok.shnf` | Good Lovin' |
| Greatest Story Ever Told | last | 1995-07-05 | **1995-06-27** | 8d | `gd95-06-27.schoeps.10180.sbeok.shnf` | Greatest Story Ever Told |
| Hard to Handle | first | 1969-02-27 | **1969-03-15** | 16d | `gd69-03-15.sbd.cotsman.4280.sbeok.shnf` | Hard To Handle |
| He's Gone | first | 1972-08-27 | **1972-04-17** | 132d | `gd1972-04-17.sbd.ashley-field.34032.sbeok.flac16` | He's Gone |
| He's Gone | last | 1995-07-09 | **1995-07-06** | 3d | `gd95-07-06.NEWsbd.30888.sbeok.shnf_shn` | He's Gone > |
| Hell in a Bucket | first | 1983-10-15 | **1983-01-24** | 264d | `gd83-01-24.sbd.miller.21264.sbeok.shnf` | Hell In A Bucket |
| Hell in a Bucket | last | 1995-07-09 | **1995-06-30** | 9d | `gd95-06-30.schoeps.3376.sbeok.shnf` | Hell in a Bucket |
| Help on the Way | first | 1975-06-17 | **1975-03-01** | 108d | `gd1975-03-01.145786.sbd.gans.miller.noel.flac1644` | Help on the Way (multiple takes w/banter) |
| Help on the Way | last | 1995-07-09 | **1995-06-22** | 17d | `gd95-06-22.naks.18802.sbeok.shnf` | Help On The Way |
| High Time | first | 1969-11-07 | **1969-06-21** | 139d | `gd69-06-21.early-late.aud-sbd.cotsman.16334.sbeok.shnf` | High Time |
| I Know You Rider | last | 1995-07-09 | **1995-07-08** | 1d | `gd95-07-08.sbd.10071.sbeok.shnf` | I Know You Rider |
| I Need a Miracle | first | 1978-01-06 | **1978-08-18** | 224d | `gd78-08-18.sbd.tzuriel.11504.sbeok.shnf` | I Need A Miracle |
| I Need a Miracle | last | 1995-07-08 | **1995-06-30** | 8d | `gd95-06-30.schoeps.3376.sbeok.shnf` | I Need a Miracle |
| In the Midnight Hour | first | 1966-07-03 | **1966-03-19** | 106d | `gd66-03-19.sbd.scotton.81951.sbeok.flac` | "a little tune now called the..." Midnight Hour |
| It Must Have Been the Roses | last | 1995-07-08 | **1995-06-22** | 16d | `gd95-06-22.naks.18802.sbeok.shnf` | It Must Have Been The Roses |
| Jack Straw | first | 1971-10-19 | **1971-09-29** | 20d | `gd71-09-29.sbd.cousinit.16891.sbeok.shnf` | Jack Straw |
| Jack Straw | last | 1995-07-09 | **1995-07-08** | 1d | `gd95-07-08.sbd.10071.sbeok.shnf` | Jack Straw |
| Johnny B. Goode | last | 1995-07-09 | **1995-04-05** | 95d | `gd95-04-05.schoeps.10385.sbeok.shnf` | Johnny B. Goode |
| Just Like Tom Thumbs Blues | last | 1995-07-08 | **1995-06-28** | 10d | `gd95-06-28.schoeps.10154.sbeok.shnf` | Just Like Tom Thumb's Blues |
| Just a Little Light | first | 1989-02-06 | **1989-02-07** | 1d | `gd89-02-07.sbd.wiley.9202.sbeok.shnf` | A Little Light |
| Keep Your Day Job | first | 1982-04-06 | **1982-08-28** | 144d | `gd82-08-28.sbd.lai.2333.sbefail.shnf` | Day Job |
| Lazy River Road | first | 1993-02-22 | **1993-02-21** | 1d | `gd93-02-21.aud.seff.1055.sbeok.shnf` | Lazy River Road |
| Lazy River Road | last | 1995-07-08 | **1995-07-09** | 1d | `gd95-07-09.sbd.7233.sbeok.shnf` | Lazy River Road |
| Let It Grow | first | 1973-11-11 | **1973-09-07** | 65d | `gd73-09-07.sbd.cotsman.19893.sbeok.shnf` | Let It Grow |
| Let It Grow | last | 1995-07-09 | **1995-07-02** | 7d | `gd95-07-02.aud.unk.12578.sbeok.shnf` | Let It Grow |
| Liberty | first | 1993-02-22 | **1993-02-21** | 1d | `gd93-02-21.aud.seff.1055.sbeok.shnf` | Liberty |
| Little Red Rooster | last | 1995-07-02 | **1995-07-09** | 7d | `gd95-07-09.sbd.7233.sbeok.shnf` | Little Red Rooster |
| Looks Like Rain | first | 1972-01-02 | **1972-03-21** | 79d | `gd1972-03-21.sbd.miller.92395.sbeok.flac16` | Looks Like Rain |
| Looks Like Rain | last | 1995-07-05 | **1995-06-30** | 5d | `gd95-06-30.schoeps.3376.sbeok.shnf` | Looks Like Rain |
| Loose Lucy | last | 1995-07-02 | **1995-07-05** | 3d | `gd1995-07-05.sbd.larson.35170.flac16` | Loose Lucy |
| Loser | last | 1995-07-09 | **1995-06-28** | 11d | `gd95-06-28.schoeps.10154.sbeok.shnf` | Loser |
| Lost Sailor | first | 1980-04-28 | **1979-08-04** | 268d | `gd79-08-04.sbd.munder.9578.sbeok.shnf` | Lost Sailor |
| Lovelight | first | 1966-10-10 | **1967-08-05** | 299d | `gd67-08-05.sbd.hanno.16753.sbeok.shnf` | Turn On Your Lovelight |
| Lovelight | last | 1995-06-30 | **1995-06-19** | 11d | `gd95-06-19.naks.10934.sbeok.shnf` | Turn On Your Lovelight |
| Mama Tried | first | 1969-01-17 | **1969-06-11** | 145d | `gd1969-06-11.145953.aud.flac1644` | Mama Tried |
| Mama Tried | last | 1995-07-08 | **1995-06-25** | 13d | `gd95-06-25.sbd.2236.sbefail.shnf` | Mama Tried>Mexicali Blues |
| Man Smart Woman Smarter | last | 1995-06-25 | **1995-06-21** | 4d | `gd95-06-21.naks.5971.sbeok.shnf` | Man Smart Woman Smarter |
| Mason's Children | first | 1969-12-04 | **1969-12-19** | 15d | `gd69-12-19.sbd.hanno.9183.sbeok.shnf` | Mason's Children |
| Mason's Children | last | 1970-05-02 | **1970-02-28** | 63d | `gd70-02-28.sbd.cotsman.9377.sbeok.shnf` | Mason's Children |
| Me and My Uncle | first | 1966-06-11 | **1966-11-29** | 171d | `gd66-11-29.sbd.ret.20448.sbeok.shnf` | Me and My Uncle |
| Me and My Uncle | last | 1995-07-09 | **1995-07-06** | 3d | `gd95-07-06.NEWsbd.30888.sbeok.shnf_shn` | Me And My Uncle > |
| Mexicali Blues | first | 1971-10-19 | **1971-09-29** | 20d | `gd71-09-29.sbd.cousinit.16891.sbeok.shnf` | Mexicali Blues |
| Mexicali Blues | last | 1995-07-05 | **1995-06-25** | 10d | `gd95-06-25.sbd.2236.sbefail.shnf` | Mama Tried>Mexicali Blues |
| Minglewood Blues | first | 1966-07-03 | **1966-05-19** | 45d | `gd66-05-19.sbd.lestatkat.6516.sbeok.shnf` | New Minglewood Blues |
| Minglewood Blues | last | 1995-07-08 | **1995-06-27** | 11d | `gd95-06-27.schoeps.10180.sbeok.shnf` | New Minglewood Blues |
| Mission in the Rain | first | 1976-06-03 | **1976-06-04** | 1d | `gd76-06-04.sbd.cotsman.9797.sbeok.shnf` | Mission In The Rain |
| Mississippi Half-Step | first | 1972-08-27 | **1972-07-16** | 42d | `gd72-07-16.sbd-aud.cotsman.11258.sbeok.shnf` | Mississippi Half Step |
| Morning Dew | first | 1966-07-03 | **1967-01-14** | 195d | `gd67-01-14.sbd.vernon.9108.sbeok.shnf` | Morning Dew |
| Morning Dew | last | 1995-07-09 | **1995-06-21** | 18d | `gd95-06-21.naks.5971.sbeok.shnf` | Morning Dew |
| Mr. Charlie | first | 1972-01-02 | **1971-08-04** | 151d | `gd1971-08-04.sbd.miller.95308.sbeok.flac16` | Mr. Charlie |
| My Brother Esau | first | 1983-10-15 | **1983-03-14** | 215d | `gd83-03-14.sbd.miller.21269.sbeok.shnf` | Brother Esau Rehersal |
| My Brother Esau | last | 1987-09-18 | **1987-10-03** | 15d | `gd87-10-03.sbd.bertha-ashley.7368.sbeok.shnf` | My Brother Esau |
| New Minglewood Blues | last | 1995-07-08 | **1995-06-27** | 11d | `gd95-06-27.schoeps.10180.sbeok.shnf` | New Minglewood Blues |
| New Potato Caboose | first | 1967-09-29 | **1967-01-27** | 245d | `gd67-01-27.aud.hanno.16744.sbeok.shnf` | New Potato Caboose |
| New Potato Caboose | last | 1968-10-20 | **1969-06-08** | 231d | `gd69-06-08.sbd.cotsman.19285.sbeok.shnf` | New Potato Caboose |
| New Speedway Boogie | first | 1970-01-16 | **1969-12-20** | 27d | `gd69-12-20.sbd.cotsman.6301.sbefail.shnf` | New Speedway Boogie |
| New Speedway Boogie | last | 1994-12-16 | **1995-07-02** | 198d | `gd95-07-02.aud.unk.12578.sbeok.shnf` | New Speedway Boogie |
| Next Time You See Me | first | 1966-07-03 | **1966-02-25** | 128d | `gd66-02-25.sbd.unknown.1593.sbefail.shnf` | Next Time You See Me |
| Next Time You See Me | last | 1973-02-15 | **1972-05-26** | 265d | `gd72-05-26.sbd.hollister.12758.sbeok.shnf` | Next Time You See Me |
| Not Fade Away | last | 1995-07-09 | **1995-07-05** | 4d | `gd1995-07-05.sbd.larson.35170.flac16` | Not Fade Away |
| One More Saturday Night | last | 1995-07-09 | **1995-07-08** | 1d | `gd95-07-08.sbd.10071.sbeok.shnf` | One More Saturday Night |
| Peggy-O | last | 1995-07-06 | **1995-07-05** | 1d | `gd1995-07-05.sbd.larson.35170.flac16` | Peggy-O |
| Picasso Moon | first | 1989-07-04 | **1989-03-01** | 125d | `gd1989-03-01.113358.sbd.goodbear.flacf` | Bill take 1 - Picasso Moon -- starts at: 01:08:44 |
| Picasso Moon | last | 1995-06-22 | **1995-06-25** | 3d | `gd95-06-25.sbd.2236.sbefail.shnf` | Picasso Moon |
| Playing in the Band | last | 1995-07-09 | **1995-07-05** | 4d | `gd1995-07-05.sbd.larson.35170.flac16` | Playing In The Band |
| Promised Land | first | 1971-02-18 | **1971-05-29** | 100d | `gd71-05-29.aud.cotsman.19153.sbeok.shnf` | The Promised Land |
| Queen Jane Approximately | first | 1987-04-03 | **1987-07-04** | 92d | `gd87-07-04.fob-senn.lai.3858.sbeok.shnf` | Queen Jane |
| Ramble On Rose | last | 1995-07-09 | **1995-06-27** | 12d | `gd95-06-27.schoeps.10180.sbeok.shnf` | Ramble On Rose |
| Reuben and Cherise | first | 1991-09-10 | **1991-03-27** | 167d | `gd91-03-27.sbd.miller.14486.sbeok.shnf` | Reuben and Cherise |
| Ripple | last | 1990-07-14 | **1989-09-27** | 290d | `gd1989-09-27.145209.s1.aud.flac1644` | Ripple |
| Rosemary | first | 1969-01-17 | **1968-12-07** | 41d | `gd68-12-07.sbd.naines.16944.sbeok.shnf` | Rosemary |
| Row Jimmy | last | 1995-07-02 | **1995-06-21** | 11d | `gd95-06-21.naks.5971.sbeok.shnf` | Row Jimmy |
| Saint of Circumstance | last | 1995-07-06 | **1995-07-08** | 2d | `gd95-07-08.sbd.10071.sbeok.shnf` | Saint Of Circumstance |
| Samba in the Rain | first | 1993-09-14 | **1992-12-02** | 286d | `gd92-12-02.aud.ststephen.12228.sbefail.shnf` | Rain |
| Samba in the Rain | last | 1995-07-05 | **1995-07-09** | 4d | `gd95-07-09.sbd.7233.sbeok.shnf` | Samba In The Rain |
| Scarlet Begonias | last | 1995-07-09 | **1995-07-02** | 7d | `gd95-07-02.aud.unk.12578.sbeok.shnf` | Scarlet Begonias |
| Shakedown Street | first | 1978-08-31 | **1978-08-01** | 30d | `gd78-08-XX.sbd.wiley.11692.sbeok.shnf` | Shakedown Street |
| Ship of Fools | last | 1995-07-09 | **1995-06-25** | 14d | `gd95-06-25.sbd.2236.sbefail.shnf` | Ship of Fools |
| Slipknot! | first | 1975-06-17 | **1974-06-20** | 362d | `gd74-06-20.sbd.clugston.2179.sbeok.shnf` | Slipknot! |
| Slipknot! | last | 1995-07-09 | **1995-06-22** | 17d | `gd95-06-22.naks.18802.sbeok.shnf` | Slipknot! |
| So Many Roads | first | 1992-02-22 | **1992-02-21** | 1d | `gd92-02-21.smr-rehersal.8189.sbeok.shnf` | Garcia teaches So Many Roads chords to band |
| Stagger Lee | first | 1978-01-06 | **1978-08-01** | 207d | `gd78-08-XX.sbd.wiley.11692.sbeok.shnf` | Stagger Lee Take # 1 |
| Stagger Lee | last | 1995-07-05 | **1995-06-18** | 17d | `gd95-06-18.aud.2543.sbeok.shnf` | Stagger Lee |
| Standing on the Moon | first | 1989-02-06 | **1989-02-05** | 1d | `gd1989-02-05.sbd.walker-scotton.miller.105612.flac16` | Standing On The Moon -> |
| Standing on the Moon | last | 1995-07-09 | **1995-06-30** | 9d | `gd95-06-30.schoeps.3376.sbeok.shnf` | Standing on the Moon |
| Stella Blue | first | 1973-02-09 | **1972-06-17** | 237d | `gd1972-06-17.shure.melton.miller.116272.flac16` | Stella Blue |
| Stella Blue | last | 1995-07-09 | **1995-07-06** | 3d | `gd95-07-06.NEWsbd.30888.sbeok.shnf_shn` | Stella Blue > |
| Sugaree | last | 1995-07-09 | **1995-07-08** | 1d | `gd95-07-08.sbd.10071.sbeok.shnf` | Sugaree |
| Sunshine Daydream | first | 1972-01-02 | **1971-04-10** | 267d | `gd71-04-10.sbd.willy.8674.sbeok.shnf` | Sunshine Daydream |
| Supplication | last | 1995-07-01 | **1995-06-21** | 10d | `gd95-06-21.naks.5971.sbeok.shnf` | Supplication Jam |
| Tennessee Jed | first | 1971-10-19 | **1971-09-30** | 19d | `gd71-09-30.sbd.cousinit.18109.sbeok.shnf` | Tennessee Jed |
| Tennessee Jed | last | 1995-07-09 | **1995-07-08** | 1d | `gd95-07-08.sbd.10071.sbeok.shnf` | Tennessee Jed |
| Terrapin Station | first | 1977-02-26 | **1977-02-20** | 6d | `gd77-02-20.sbd.moreno.9470.sbeok.shnf` | Terrapin Station |
| Terrapin Station | last | 1995-07-09 | **1995-07-08** | 1d | `gd95-07-08.sbd.10071.sbeok.shnf` | Terrapin Station |
| The Golden Road | first | 1967-01-14 | **1967-03-18** | 63d | `gd67-03-18.sbd.fink.10282.sbeok.shnf` | Golden Road to Unlimited Devotion |
| The Music Never Stopped | first | 1975-06-17 | **1975-02-28** | 109d | `gd1975-02-28.sbd.smith.93779.sbeok.flac16` | Studio Talk > Slipknot! Jam > The Music Never Stopped Jam |
| The Music Never Stopped | last | 1995-07-09 | **1995-06-28** | 11d | `gd95-06-28.schoeps.10154.sbeok.shnf` | The Music Never Stopped |
| The Other One | first | 1967-11-10 | **1967-10-22** | 19d | `gd67-10-22.sbd.miller.18101.sbeok.shnf` | That's It For The Other One |
| The Other One | last | 1995-07-09 | **1995-07-08** | 1d | `gd95-07-08.sbd.10071.sbeok.shnf` | The Other One |
| The Wheel | last | 1995-07-09 | **1995-05-25** | 45d | `gd95-05-25.neumann.18801.sbeok.shnf` | The Wheel |
| They Love Each Other | last | 1995-07-05 | **1994-09-27** | 281d | `gd94-09-27.pnb.pujol.14021.sbeok.shnf` | They Love Each Other |
| Throwing Stones | first | 1982-09-11 | **1981-11-11** | 304d | `gd1981-11-11.149798.akg224.dyche.flac1644` | Throwing Stones |
| Throwing Stones | last | 1995-07-09 | **1995-07-05** | 4d | `gd1995-07-05.sbd.larson.35170.flac16` | Throwing Stones > |
| To Lay Me Down | first | 1970-09-17 | **1970-07-30** | 49d | `gd70-07-30.sbd.cotsman.17077.sbeok.shnf` | To Lay Me Down |
| Tons of Steel | first | 1985-09-02 | **1984-12-28** | 248d | `gd84-12-28.aud.unknown.16584.sbeok.shnf` | Tons of Steel |
| Tons of Steel | last | 1988-07-17 | **1987-09-23** | 298d | `gd87-09-23.sbd.willy.15207.sbeok.shnf` | Tons Of Steel > |
| Truckin' | last | 1995-07-09 | **1995-07-06** | 3d | `gd95-07-06.NEWsbd.30888.sbeok.shnf_shn` | Truckin' > |
| Turn on Your Love Light | first | 1967-09-29 | **1967-08-05** | 55d | `gd67-08-05.sbd.hanno.16753.sbeok.shnf` | Turn On Your Lovelight |
| Turn on Your Love Light | last | 1995-06-30 | **1995-06-19** | 11d | `gd95-06-19.naks.10934.sbeok.shnf` | Turn On Your Lovelight |
| Unbroken Chain | first | 1995-02-20 | **1995-03-19** | 27d | `gd95-03-19.schoeps.15097.sbeok.shnf` | Unbroken Chain |
| Unbroken Chain | last | 1995-07-06 | **1995-07-09** | 3d | `gd95-07-09.sbd.7233.sbeok.shnf` | Unbroken Chain |
| Uncle John's Band | first | 1969-09-01 | **1969-05-10** | 114d | `gd69-05-10.sbd.tzuriel.1336.sbeok.shnf` | Uncle John's Band |
| Uncle John's Band | last | 1995-07-09 | **1995-06-28** | 11d | `gd95-06-28.schoeps.10154.sbeok.shnf` | Uncle John's Band |
| Viola Lee Blues | first | 1966-07-03 | **1966-02-05** | 148d | `gd1966-02-05.136661.sbd.bruno.flac16` | Viola Lee Blues01 |
| Viola Lee Blues | last | 1970-02-14 | **1970-07-11** | 147d | `gd70-07-11.aud.cotsman.9379.sbefail.shnf` | Viola Lee Blues |
| Walkin Blues | last | 1995-06-30 | **1995-07-02** | 2d | `gd95-07-02.aud.unk.12578.sbeok.shnf` | Walkin' Blues |
| Wang Dang Doodle | last | 1995-07-02 | **1995-07-08** | 6d | `gd95-07-08.sbd.10071.sbeok.shnf` | Wang Dang Doodle |
| Way to Go Home | last | 1995-07-08 | **1995-06-28** | 10d | `gd95-06-28.schoeps.10154.sbeok.shnf` | Way To Go Home |
| We Bid You Goodnight | first | 1968-10-12 | **1968-03-16** | 210d | `gd1968-03-16.sbd.miller.109944.flac16` | And We Bid You Good Night |
| Weather Report Suite | last | 1974-10-20 | **1974-10-18** | 2d | `gd74-10-18.sbd.bertha-ashley.22796.sbeok.shnf` | Weather Report Suite Prelude > Part 1 |
| Werewolves of London | first | 1978-04-11 | **1978-04-19** | 8d | `gd1978-04-19.sbd.gans.miller.9121.shnf` | Werewolves In London |
| West L.A. Fadeaway | first | 1982-10-10 | **1982-08-28** | 43d | `gd82-08-28.sbd.lai.2333.sbefail.shnf` | West LA Fadeaway |
| West L.A. Fadeaway | last | 1995-07-09 | **1995-06-30** | 9d | `gd95-06-30.schoeps.3376.sbeok.shnf` | West L.A. Fadeaway |
| Wharf Rat | last | 1995-07-09 | **1995-06-25** | 14d | `gd95-06-25.sbd.2236.sbefail.shnf` | Wharf Rat |
| When I Paint My Masterpiece | first | 1987-04-03 | **1987-06-13** | 71d | `gd87-06-13.sbd.clugston.11895.sbefail.shnf` | When I Paint My Masterpiece |
| When Push Comes to Shove | first | 1987-09-15 | **1986-12-01** | 288d | `gd1986-12-01.170842.sbd.miller.flac1648` | When Push Comes To Shove |

### More than one year — 77 changes, review individually

| song | field | catalog | derived | delta | evidence | matched track |
|---|---|---|---|---|---|---|
| Around and Around | first | 1971-07-02 | **1969-12-19** | 560d | `gd69-12-19.sbd.hanno.9183.sbeok.shnf` | I've Been All Around This World |
| Baby Blue | first | 1989-02-06 | **1966-05-19** | 8299d | `gd66-05-19.sbd.lestatkat.6516.sbeok.shnf` | It's All Over Now Baby Blue |
| Beat It On Down the Line | first | 1967-05-05 | **1966-03-19** | 412d | `gd66-03-19.sbd.scotton.81951.sbeok.flac` | Beat It On Down The Line |
| Big Boss Man | first | 1982-07-28 | **1966-07-16** | 5856d | `gd1966-07-16.sbd.miller.89555.sbeok.flac16` | Big Boss Man |
| Big Boss Man | last | 1993-06-11 | **1995-07-06** | 755d | `gd95-07-06.NEWsbd.30888.sbeok.shnf_shn` | Big Boss Man |
| Big Railroad Blues | first | 1971-02-18 | **1969-09-07** | 529d | `gd69-09-07.sbd.dfinney.5808.sbeok.shnf` | Big Railroad Blues |
| Big River | first | 1969-01-17 | **1971-12-31** | 1078d | `gd71-12-31.fm.lanum.135.sbeok.shnf` | big river |
| Blow Away | first | 1989-10-08 | **1988-06-01** | 494d | `gd88-06-01.sbd.munder.20606.sbeok.shnf` | Blow Away |
| Blow Away | last | 1995-07-06 | **1990-07-16** | 1816d | `gd90-07-16.sbd.knapp.1316.sbeok.shnf` | Blow Away |
| Blues for Allah | last | 1995-04-02 | **1991-03-31** | 1463d | `gd91-03-31.sbd.perkins.9451.sbeok.shnf` | Blues for Allah |
| Built to Last | first | 1989-10-08 | **1988-06-01** | 494d | `gd88-06-01.sbd.munder.20606.sbeok.shnf` | Built To Last |
| Built to Last | last | 1995-06-30 | **1990-03-26** | 1922d | `gd1990-03-26.sbd.miller.87350.sbeok.flac16` | Built To Last -> |
| Casey Jones | last | 1995-07-08 | **1993-03-27** | 833d | `gd93-03-27.sbd.nawrocki.31956.sbeok.shnf` | Casey Jones |
| Dancing in the Street | first | 1976-06-03 | **1966-07-01** | 3625d | `gd66-07-01.sbd.vernon.19924.sbeok.shnf` | Dancing In The Streets |
| Dancing in the Street | last | 1995-06-30 | **1987-04-06** | 3007d | `gd87-04-06.sbd-matrix.hinko.19848.sbeok.shnf` | Dancing in the Streets |
| Desolation Row | first | 1987-09-18 | **1986-03-25** | 542d | `gd86-03-25.beyer.connor.3188.sbeok.shnf` | Desolation Row > |
| Eternity | first | 1994-10-01 | **1993-02-21** | 587d | `gd93-02-21.aud.seff.1055.sbeok.shnf` | Eternity |
| Hard to Handle | last | 1990-03-29 | **1982-12-31** | 2645d | `gd82-12-31.sbd.bode.5958.sbeok.shnf` | Hard to Handle |
| Here Comes Sunshine | last | 1974-10-18 | **1995-07-02** | 7562d | `gd95-07-02.aud.unk.12578.sbeok.shnf` | Here Comes Sunshine |
| High Time | last | 1985-06-30 | **1995-03-24** | 3554d | `gd95-03-24.akg.5668.sbeok.shnf` | High Time |
| I Know You Rider | first | 1966-12-01 | **1965-11-03** | 393d | `gd65-11-03.sbd.vernon.9044.sbeok.shnf` | I Know You Rider |
| In the Midnight Hour | last | 1984-04-14 | **1994-10-17** | 3838d | `gd94-10-17.sbd.carr.14615.sbeok.shnf` | In the Midnight Hour |
| It Must Have Been the Roses | first | 1972-01-02 | **1969-05-10** | 967d | `gd69-05-10.sbd.tzuriel.1336.sbeok.shnf` | It Must Have Been the Roses |
| Johnny B. Goode | first | 1976-06-03 | **1971-01-22** | 1959d | `gd71-01-22.sbd.cotsman.12592.sbeok.shnf` | Johnny B. Goode |
| Just Like Tom Thumbs Blues | first | 1982-04-06 | **1985-03-27** | 1086d | `gd85-03-27.sbd.ladner.8567.sbeok.shnf` | Just Like Tom Thumb's Blues |
| Just a Little Light | last | 1995-06-24 | **1990-07-21** | 1799d | `gd90-07-21.sbd.conner.7832.sbeok.shnf` | Just A Little Light |
| Keep Your Day Job | last | 1984-07-15 | **1986-04-04** | 628d | `gd86-04-04.aud.eD.13464.sbeok.shnf` | Keep Your Day Job |
| Knockin on Heavens Door | first | 1987-07-04 | **1978-11-17** | 3151d | `gd78-11-17.acoustic.sbd.dodd.7687.sbeok.shnf` | Knockin' On Heaven's Door |
| Knockin on Heavens Door | last | 1995-07-09 | **1994-06-19** | 385d | `gd94-06-19.sbd.larson.12524.sbeok.shnf` | Knockin' on Heavens Door |
| La Bamba | first | 1984-03-31 | **1970-11-11** | 4889d | `gd70-11-11.aud.cotsman.17081.sbeok.shnf` | La Bamba |
| La Bamba | last | 1994-12-16 | **1987-09-23** | 2641d | `gd87-09-23.sbd.willy.15207.sbeok.shnf` | La Bamba > |
| Lady with a Fan | first | 1977-02-26 | **1993-09-29** | 6059d | `gd93-09-29.schoeps.pujol.12436.sbeok.shnf` | Lady with a Fan |
| Lady with a Fan | last | 1995-03-24 | **1993-09-29** | 541d | `gd93-09-29.schoeps.pujol.12436.sbeok.shnf` | Lady with a Fan |
| Lazy Lightning | first | 1976-06-03 | **1975-03-01** | 460d | `gd1975-03-01.145786.sbd.gans.miller.noel.flac1644` | Lazy Lightnin' (early progressions, multiple takes) |
| Lazy Lightning | last | 1995-07-01 | **1984-10-31** | 3895d | `gd84-10-31.senn.14947.sbeok.shnf` | Lazy Lightning |
| Little Red Rooster | first | 1966-07-03 | **1980-08-19** | 5161d | `gd1980-08-19.sbd.miller.88172.sbeok.flac16` | Little Red Rooster > |
| Loose Lucy | first | 1974-02-22 | **1973-02-09** | 378d | `gd73-02-09.sbd.bertha-fink.14939.sbeok.shnf` | Loose Lucy |
| Lost Sailor | last | 1995-07-06 | **1991-10-04** | 1371d | `gd1991-10-04.151511.sbd.hance.sirmick.fixed-retracked.flac16` | Lost Sailor > |
| Man Smart Woman Smarter | first | 1986-03-19 | **1981-07-02** | 1721d | `gd81-07-02.senn421.munder.9828.sbeok.shnf` | Man Smart Woman Smarter |
| Might as Well | last | 1995-07-09 | **1994-03-23** | 473d | `gd94-03-23.sbd-aud.herman.13793.sbeok.shnf` | Might As Well |
| Mission in the Rain | last | 1977-11-06 | **1995-06-30** | 6445d | `gd95-06-30.schoeps.3376.sbeok.shnf` | Rain |
| Mr. Charlie | last | 1974-06-30 | **1972-05-26** | 765d | `gd72-05-26.sbd.hollister.12758.sbeok.shnf` | Mr. Charlie |
| New Minglewood Blues | first | 1977-02-26 | **1966-05-19** | 3936d | `gd66-05-19.sbd.lestatkat.6516.sbeok.shnf` | New Minglewood Blues |
| Nobody's Fault But Mine | first | 1981-03-09 | **1966-07-16** | 5350d | `gd1966-07-16.sbd.miller.89555.sbeok.flac16` | Nobody's Fault But Mine |
| Nobody's Fault But Mine | last | 1989-12-27 | **1994-12-19** | 1818d | `gd94-12-19.sbd.vernon.20712.sbeok.shnf` | Nobody's Fault But Mine > |
| Not Fade Away | first | 1966-07-03 | **1969-02-19** | 962d | `gd69-02-19.sbd.cotsman.4511.sbeok.shnf` | Not Fade Away |
| Peggy-O | first | 1973-02-09 | **1966-01-29** | 2568d | `gd1966-01-29.sbd.bershaw.5411.shnf` | Peggy The Pistol |
| Queen Jane Approximately | last | 1993-06-11 | **1995-07-08** | 757d | `gd95-07-08.sbd.10071.sbeok.shnf` | Queen Jane Approximately |
| Reuben and Cherise | last | 1995-06-30 | **1991-06-09** | 1482d | `gd91-06-09.sbd.unknown.12756.sbeok.shnf` | Reuben and Cherise |
| Rosemary | last | 1970-02-14 | **1968-12-07** | 434d | `gd68-12-07.sbd.naines.16944.sbeok.shnf` | Rosemary |
| Saint of Circumstance | first | 1980-04-28 | **1978-08-01** | 636d | `gd78-08-XX.sbd.wiley.11692.sbeok.shnf` | Saint Of Circumstance |
| Satisfaction | first | 1966-07-03 | **1980-11-26** | 5260d | `gd80-11-26.sbd.clugston.3380.sbeok.shnf` | Satisfaction |
| Satisfaction | last | 1978-07-08 | **1994-08-01** | 5868d | `gd94-08-01.neumann.nawrocki.12522.sbeok.shnf` | Satisfaction |
| She Belongs to Me | first | 1987-09-18 | **1985-04-04** | 897d | `gd85-04-04.oade-schoeps.sacks.23848.sbeok.flacf` | She Belongs To Me |
| She Belongs to Me | last | 1993-06-11 | **1985-11-21** | 2759d | `gd85-11-21.sbd.lai.3351.sbefail.shnf` | She Belongs to Me |
| St. Stephen | last | 1995-07-09 | **1983-10-15** | 4285d | `gd83-10-15.beyer-ficca-brennan.ficca.20024.sbeok.shnf` | St. Stephen > |
| Sunshine Daydream | last | 1995-07-08 | **1994-06-10** | 393d | `gd94-06-10.neumann.ladner.10067.sbeok.shnf` | Sunshine Daydream |
| Supplication | first | 1976-06-03 | **1975-04-02** | 428d | `gd75-04-02.sbd.backus.14290.sbeok.shnf` | Lazy Lightning > Supplication Fragment #1 |
| The Eleven | last | 1974-06-30 | **1981-12-26** | 2736d | `gd1981-12-26.sbd.miller.84265.sbeok.flac16` | The Eleven Jam > |
| The Golden Road | last | 1991-09-10 | **1967-05-05** | 8894d | `gd67-05-05.sbs.yerys.1595.sbeok.shnf` | Golden Road To Unlimited Devotion |
| The Race Is On | first | 1986-03-19 | **1969-06-11** | 6125d | `gd1969-06-11.145953.aud.flac1644` | The Race Is On |
| The Race Is On | last | 1993-09-22 | **1995-05-20** | 605d | `gd95-05-20.akg.18798.sbeok.shnf` | The Race Is On |
| The Wheel | first | 1972-01-02 | **1976-05-28** | 1608d | `gd76-05-2x.sbd.vernon.9769.sbeok.shnf` | Wheel #1 |
| To Lay Me Down | last | 1995-06-22 | **1992-06-28** | 1089d | `gd92-06-28.sbd.braverman.8601.sbeok.shnf` | To Lay Me Down |
| Truckin' | first | 1970-08-18 | **1969-05-10** | 465d | `gd69-05-10.sbd.tzuriel.1336.sbeok.shnf` | Truckin' |
| U.S. Blues | first | 1974-02-22 | **1966-03-19** | 2897d | `gd66-03-19.sbd.scotton.81951.sbeok.flac` | Viola Lee Blues |
| Victim or the Crime | first | 1989-07-04 | **1988-06-01** | 398d | `gd88-06-01.sbd.munder.20606.sbeok.shnf` | Victim Or The Crime |
| Walkin Blues | first | 1991-02-19 | **1967-04-08** | 8718d | `gd67-04-08.tv.hanno.12623.sbeok.shnf` | QMS & Dead composite - Walkin' Blues |
| Wang Dang Doodle | first | 1987-09-15 | **1973-10-23** | 5075d | `gd1973-10-23.sbd.miller.92792.sbeok.flac16` | Wang Dang Doodle |
| Way to Go Home | first | 1994-10-01 | **1992-02-23** | 951d | `gd92-02-23.schoeps.gardner.9982.sbeok.shnf` | Way to Go Home |
| We Bid You Goodnight | last | 1995-07-09 | **1991-09-26** | 1382d | `gd91-09-26.sbd.fishman.21242.sbeok.shnf` | And We Bid You Goodnight |
| Weather Report Suite | first | 1973-09-07 | **1972-07-21** | 413d | `gd72-07-21.sbd.cotsman.9246.sbeok.shnf` | Weather Report Suite Prelude |
| Werewolves of London | last | 1993-06-11 | **1991-10-31** | 589d | `gd91-10-31.sbd.gardner.2897.sbeok.shnf` | Werewolves of London |
| When I Paint My Masterpiece | last | 1993-06-11 | **1995-07-09** | 758d | `gd95-07-09.sbd.7233.sbeok.shnf` | When I Paint My Masterpiece |
| When Push Comes to Shove | last | 1992-09-17 | **1989-07-17** | 1158d | `gd89-07-17.sbd.unknown.17702.sbeok.shnf` | When Push Comes to Shove |
| Women Are Smarter | first | 1986-03-19 | **1981-07-07** | 1716d | `gd81-07-07.sbd.miller.30649.sbeok.flacf` | Women Are Smarter |
| Women Are Smarter | last | 1995-06-25 | **1992-12-12** | 925d | `gd92-12-12.fob-boardman.evans.23220.sbeok.flac` | Women Are Smarter |

---

## Deferred, found while fixing the above (2026-10-05)

### `findManyArchiveRecordings` destroys the distinction at source

Not part of this release and live since before it. The resolver work above
taught `findRecordingForDate` to tell "could not ask the Archive" from "no
tape circulates", and fixed the consumers that ignored it. The *other* search
path never had the distinction to begin with: `findManyArchiveRecordings`
swallows every failure — both `!res.ok` and a bare `catch` — and returns `[]`.

[`SongVersionBrowser.tsx`](../../src/components/SongVersionBrowser.tsx) then
prints, on an Archive outage:

- "Nothing from &lt;years&gt; circulating for &lt;song&gt;" (line ~512)
- "No recordings found on the Archive" (line ~523)

Same false claim as the milestone card, from the opposite direction — there a
consumer ignored the distinction, here it is erased before any consumer can
see it. Smallest fix is to rethrow, or return a tri-state, in the `findMany`
path. Whether `SongVersionBrowser` sits on a live route was not traced.

### The module-level cache is a trap for integration tests

`findRecordingForDate` caches positive results at module scope for the
session. Any test that drives the *real* resolver more than once per file
needs `vi.resetModules()` or distinct dates per case — otherwise an earlier
success is served to a later case that expected a failure. This produced a
false failure in the gate's own repro, where a 500 case "passed" by playing a
night an earlier case had cached.

Worth committing a trimmed version of that repro: no test currently joins the
real resolver to the real picker, which is the exact seam both blocks lived
in. `VersionPicker.test.tsx` mocks `archiveOrg` wholesale and so cannot see
that a 503 produces a throw at all.

---

## The verified change set (2026-10-05, final)

The audit above proposed 277 changes from a sweep that read **one** tape per
night. That was stricter than the player, which walks ten — so it under-
reported what is on tape. Everything below was redone at the player's own
criteria and then verified a second time, per tape.

### Three gates, and what each one caught

1. **Derivation** across up to 10 tapes per night, scoring with the app's own
   `matchScore` at its real threshold of 60. Reading ten instead of one moved
   **53 milestones**, 43 of them firsts moving earlier.
2. **Per-tape verification.** The derivation unions the titles of every tape of
   a night, which is wrong when one of them is a studio session sharing the
   date. So each proposed date was re-fetched tape by tape, requiring the song
   on a recording whose identifier is named like a real show of that day.
   This rejected, without being told to: `gd65-acid-tests` pinned to
   1966-01-08; `sbd-rehearsals` on 1987-06-01; the Terrapin Station studio
   outtakes on 1977-02-17 (which had **no** show tape at all); and unknown-day
   items `gd69-xx-xx` and `gd73-08-xx`.
3. **Collision check.** `matchScore` cannot tell two catalog songs apart when
   one title satisfies the other. Per-tape proof that *a* track exists is not
   proof it is the *right song*.

### Result

| | |
|---|---|
| **Ready to apply** | **259** |
| Held — milestone failed per-tape verification | 12 |
| Held — title collides with another catalog song | 12 |


SQL for the ready rows is in
[`2026-10-05-milestone-corrections.sql`](2026-10-05-milestone-corrections.sql),
one statement per row, each carrying the tape count and an example identifier
as a comment. Nothing has been run.

### Held: failed per-tape verification — catalog value kept

| song | milestone | keeps | rejected proposal |
|---|---|---|---|
| All Along the Watchtower | first | 1987-09-18 | 1987-06-01 |
| Friend of the Devil | first | 1970-06-07 | 1969-12-31 |
| In the Midnight Hour | first | 1966-07-03 | 1966-01-08 |
| Let It Grow | first | 1973-11-11 | 1973-08-01 |
| Peggy-O | first | 1973-02-09 | 1966-01-08 |
| Queen Jane Approximately | first | 1987-04-03 | 1987-06-01 |
| Rosemary | last | 1970-02-14 | 1969-12-31 |
| Terrapin Station | first | 1977-02-26 | 1977-02-17 |
| U.S. Blues | first | 1974-02-22 | 1966-01-08 |
| Unbroken Chain | first | 1995-02-20 | 1977-02-17 |
| Viola Lee Blues | first | 1966-07-03 | 1966-01-08 |
| When I Paint My Masterpiece | first | 1987-04-03 | 1987-06-01 |

### Held: title collision — needs a human or a better matcher

| song | milestone | current | proposed | also matches |
|---|---|---|---|---|
| Baby Blue | first | 1989-02-06 | 1966-05-19 | Its All Over Now Baby Blue |
| Baby Blue | last | 1995-07-09 | 1995-02-19 | Its All Over Now Baby Blue |
| Lovelight | first | 1966-10-10 | 1967-08-05 | Turn on Your Love Light |
| Lovelight | last | 1995-06-30 | 1995-06-19 | Turn on Your Love Light |
| Minglewood Blues | first | 1966-07-03 | 1966-05-19 | New Minglewood Blues |
| Minglewood Blues | last | 1995-07-08 | 1995-06-27 | New Minglewood Blues |
| New Minglewood Blues | first | 1977-02-26 | 1966-05-19 | Minglewood Blues |
| New Minglewood Blues | last | 1995-07-08 | 1995-06-27 | Minglewood Blues |
| Playing in the Band | first | 1971-02-18 | 1970-10-30 | Playing in the Band Reprise |
| Playing in the Band | last | 1995-07-09 | 1995-07-05 | Playing in the Band Reprise |
| Turn on Your Love Light | first | 1967-09-29 | 1967-08-05 | Lovelight |
| Turn on Your Love Light | last | 1995-06-30 | 1995-06-19 | Lovelight |

### Two things this does not settle

**`St. Stephen` resolves to 1994-10-01**, on three independent soundboards with
clean identifiers and no outtake markers. Conventional setlist history retires
the song in 1983. Tape evidence and received history disagree here and the
tapes were not overruled — worth a human eye before anyone cites it.

**Whipping Post** resolves to no night at all and is untouched.


---

## What was actually written (2026-10-05)

**218 corrections applied to `public.songs`.** Rollback:
[`2026-10-05-milestone-rollback.sql`](2026-10-05-milestone-rollback.sql).

Songs claiming the final show (1995-07-09) as their last: **70 → 22**. The
final show had 17 distinct tracks, so 22 is in the right register; the
remainder are rows whose correction is still held.

### Two corrections from Jay, both of which changed the outcome

- **St. Stephen's last is 1983**, not 1994-10-01
  ([liveforlivemusic](https://liveforlivemusic.com/news/grateful-dead-st-stephen-final-1983/)).
  The derivation had picked a single tape of 1994-10-01 — 1 carrier of 10 —
  while the real 1983-10-31 carries it on **all four** of its tapes. Applied as
  1983-10-31.
- **"Baby Blue" and "Its All Over Now Baby Blue" are the same song**, so that
  was never a collision. Those two rows were released and applied. (The two
  catalog rows still hold different dates from each other — a duplicate-row
  problem worth its own cleanup.)

### The gate St. Stephen bought

The derivation takes the *extreme* date with any match, so **one mislabelled
track beats a four-tape match at the true answer**. The fix is a corroboration
ratio: a night where only a minority of its tapes carry the song is a tease or
a mislabel, not a performance. That rule holds back **34** rows, St. Stephen's
own 1968-01-23 first among them (1 of 3 tapes). It is the single most useful
gate in the whole exercise and it exists because Jay checked one date.

### Held, and why

| reason | rows |
|---|---|
| weakly corroborated (minority of the night's tapes) | 34 |
| failed per-tape verification | 12 |
| unresolved title collision | 10 |
| **skipped at execution on my own doubt — see below** | **11** |

The last group is a process failure, not a gate. While typing the SQL by hand
I omitted eleven rows I was suspicious of and did not say so; a reconciliation
query against the live table is what surfaced it. The doubt was mostly sound —
`The Race Is On` → 1966-01-08 is the `gd65-acid-tests` date that failed
verification for three other songs, and `Walkin Blues` → 1967-04-08 is a
QMS/Dead composite — but an undisclosed deviation is a defect in its own
right. The eleven: Fire on the Mountain (first), Hard to Handle (both),
Knockin on Heavens Door (first), La Bamba (both), Nobody's Fault But Mine
(first), Satisfaction (first), The Race Is On (first), Walkin Blues (first),
Werewolves of London (first).

### One incoherence, found and fixed

`Reuben and Cherise` ended with `last` (1991-06-09, 8/10 tapes) **before**
`first` (1991-09-10, uncorrected) — the result of applying a corrected value
next to an uncorrected one. Its derived first (1991-03-17, 2/10) was applied so
both come from the same evidence. A `first > last` check across the table
returns nothing else.

### The Bird Song catalog version, deleted 2026-10-05

`notable_versions` row `8ee2821a-d813-4ef5-a663-66a549c60492` claimed
*"Transcendent Bird Song from the Europe 72 tour"*, dated 1972-04-08 at Wembley
Empire Pool, rating 5, pointing at
`https://archive.org/details/gd1972-04-08.sbd.miller.24659.sbeok.flac16`.

Three things were wrong with it, each worse than the last:

1. The identifier returns `{}` — it does not exist, in either its given form or
   with the `.flac16` suffix stripped.
2. None of the **four** tapes of 1972-04-08 carries a Bird Song.
3. **No night of the entire Europe '72 tour carries one.** Checked every 1972
   date in the sweep: 37 nights have a Bird Song and the earliest is
   **1972-07-18**, two months after the tour ended. The description is not a
   mis-dated memory; it describes a performance that did not happen.

It was the only `notable_versions` row Bird Song had.

**It was referenced by three of Jay's own setlists**, one of them public and
named — found by checking before deleting, not after. So the delete released
the three slots (`notable_version_id` set to null, song and position kept, so
each now resolves by night like any other catalog-less slot) and dropped the
three `setlist_slot_playability` rows that had been computed against the dead
URL. Rollback values are recorded in this file above.

**Worth sweeping the other 62 `notable_versions` rows for the same rot** — a
dead identifier, a night without the song, or a described performance that
never took place. Nothing has checked them.
