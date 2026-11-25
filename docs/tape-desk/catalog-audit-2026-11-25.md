# Catalog first/last-played audit, 2026-11-25

Decision 3 in [LOG.md](LOG.md): check `songs.first_played` / `songs.last_played` against the setlists, because most of the "no tape" nights the desk found were catalog first/last dates that were never performances. The audit itself was read-only. **Sets A and C1 were applied the same day, on the owner's instruction, except Katie Mae and Little Star.** See "Catalog fixes applied, 2026-11-25" in LOG.md. The tables below show the catalog as it was before that. (Ripple was changed the day before and agrees with both sources.)

## What was checked

All 226 rows of `songs`. 190 have dates. 184 of those match a Grateful Dead song in JerryBase; the other 6, and one row with no dates, are set D.

| | First played | Last played |
|---|---|---|
| Agrees with JerryBase | 75 | 139 |
| Differs, and JerryBase and Relisten agree on the right date (set A) | 67 | 35 |
| Differs, and the sources disagree or only JerryBase knows (set B) | 42 | 10 |

64 songs have both dates right. For 95 of set A's 102 dates, the catalog's night **was not a performance of the song at all**, which is why those nights came up as "no tape". Songs with no dates at all: 35 (set C). 22 of them can be filled from two agreeing sources.

## How

- **JerryBase** (jerrybase.com): each song's performance rows, kept to `act = Grateful Dead` and public events. This is the performed setlist, including nights no tape survives from. Its song page's own "First/Last Played" covers every Jerry act, so it is not used.
- **Relisten** (api.relisten.net v2, `/songs/{id}`): every show with the song on an Archive tape. It says what is **on tape**, dated by the Archive items.
- Titles are matched with the player's own matcher (`tapeMatch.matchScore`, 60 and up), never a second one. 14 titles were checked by hand (`OVERRIDES` in the script): St. Stephen is "Saint Stephen", Women Are Smarter is "Man Smart (Woman Smarter)", Dancing in the Street is "Dancin' In The Streets", and so on. Lady with a Fan matches JerryBase's "Terrapin Station", which it opens (the matcher's suite rule). A medley row is matched to the nights where both parts were played, which is approximate, so medleys never go in set A.
- JerryBase writes an unknown day as `-00` (Big Railroad Blues "1966-02-00"). Those nights can't be a first or last date, and a song with one at that end goes to set B.
- Re-run: `npx vite-node --config vitest.config.ts scripts/tape-desk/catalogAudit.ts -- <dir>`, then `node scripts/tape-desk/catalogAuditReport.mjs <dir>`. Responses are cached in `<dir>`. A full uncached run takes about 450 requests, spaced 400–600 ms.

## What a change would touch

`first_played` / `last_played` feed the FTP/LTP block on `/songbook/:slug`, the "very first time they played it" and last-time milestones on `/versions/:slug`, Charlie's per-song facts (`ai-deadhead`), and `tape_index_candidates` (the hourly index refresh picks the new nights up). Nothing in the app writes these columns for an existing song: `fetch-show-setlist` sets them only on a song it inserts, and `scripts/backfill-song-stats.mjs` fills only empty rows. `stats_source` is null on every row, so no row here is setlist.fm data.

## Also found, not part of this audit

- **`times_played` is off too.** On 75 songs JerryBase and Relisten count the same number of nights and the catalog says something else by 3 or more (Big River 274 against 399, Black Muddy River 103 against 66, Ripple 55 against 40).
- **The catalog has duplicate songs**: Lovelight and Turn on Your Love Light, Minglewood Blues and New Minglewood Blues, Women Are Smarter and Man Smart Woman Smarter, and Scarlet Fire beside Scarlet Begonias > Fire on the Mountain.
- **Set D** songs have no Grateful Dead performance in JerryBase at all (Matilda Mother, Children's Lullaby, Seems Like Old Times, Tom Dooley and others), so their dates can't be checked here.

## The sets

### A. Both sources agree, and the catalog doesn't (102 dates, 86 songs)

| Song | | Catalog | JerryBase = Relisten | Venue | Catalog's night |
|---|---|---|---|---|---|
| Aint It Crazy (The Rub) | last | 1966-12-01 | **1971-12-01** | Music Hall, Boston | **not played** |
| All Along the Watchtower | first | 1987-09-18 | **1987-06-20** | William Randolph Hearst Greek Theatre, UC Berkeley, Berkeley | played, on tape |
| Around and Around | first | 1969-12-19 | **1970-11-08** | Capitol Theatre, Port Chester | **not played** |
| Big Boss Man | first | 1966-07-16 | **1966-07-03** | Fillmore Auditorium, San Francisco | played, on tape |
| Black Muddy River | first | 1986-12-01 | **1986-12-15** | Oakland-Alameda County Coliseum Arena, Oakland | **not played** |
| Black-Throated Wind | first | 1972-01-02 | **1972-03-05** | Winterland, San Francisco | **not played** |
| Blow Away | first | 1989-10-08 | **1988-06-20** | Alpine Valley Music Theatre, East Troy | **not played** |
| Blues for Allah | last | 1995-04-02 | **1975-08-13** | Great American Music Hall, San Francisco | **not played** |
| Born Cross-Eyed | first | 1967-11-14 | **1968-01-17** | Carousel Ballroom, San Francisco | **not played** |
| Built to Last | first | 1989-10-08 | **1988-10-20** | The Summit, Houston | **not played** |
| Casey Jones | first | 1969-06-22 | **1969-06-20** | Fillmore East, New York | played, on tape |
| Cold Rain and Snow | last | 1995-06-30 | **1995-06-19** | Giants Stadium, East Rutherford | **not played** |
| Comes a Time | first | 1971-03-24 | **1971-10-19** | Northrop Auditorium, University of Minnesota, Minneapolis | **not played** |
| Cosmic Charlie | first | 1968-10-08 | **1969-01-17** | Robertson Gym, UC Santa Barbara, Goleta | **not played** |
| Crazy Fingers | first | 1975-02-28 | **1975-06-17** | Winterland, San Francisco | **not played** |
| Cumberland Blues | first | 1969-11-15 | **1969-11-08** | Fillmore Auditorium, San Francisco | played, on tape |
| Dancing in the Street | last | 1995-06-30 | **1987-04-06** | Meadowlands Arena, East Rutherford | **not played** |
| Dark Star | first | 1967-11-14 | **1968-01-17** | Carousel Ballroom, San Francisco | **not played** |
| Dont Ease Me In | first | 1966-07-03 | **1966-07-16** | Fillmore Auditorium, San Francisco | **not played** |
| Feel Like a Stranger | first | 1980-04-28 | **1980-03-31** | Capitol Theatre, Passaic | played, on tape |
| Franklin's Tower | first | 1975-06-04 | **1975-06-17** | Winterland, San Francisco | **not played** |
| Friend of the Devil | first | 1970-06-07 | **1970-03-20** | Capitol Theatre, Port Chester | played, on tape |
| Gentlemen Start Your Engines | first | 1993-03-24 | **1988-06-26** | Pittsburgh Civic Arena, Pittsburgh | **not played** |
| Gentlemen Start Your Engines | last | 1993-06-11 | **1988-07-31** | Laguna Seca Raceway, Salinas | **not played** |
| Good Morning Little School Girl | last | 1971-02-18 | **1995-06-28** | The Palace, Auburn Hills | **not played** |
| Hard to Handle | first | 1969-02-27 | **1969-03-15** | Hilton Hotel, San Francisco | **not played** |
| Hard to Handle | last | 1990-03-29 | **1982-12-31** | Oakland Auditorium, Oakland | **not played** |
| Heaven Help the Fool | first | 1978-01-11 | **1980-09-29** | Warfield Theatre, San Francisco | **not played** |
| Heaven Help the Fool | last | 1978-01-13 | **1980-10-31** | Radio City Music Hall, New York | **not played** |
| Hell in a Bucket | first | 1983-01-24 | **1983-05-13** | William Randolph Hearst Greek Theatre, UC Berkeley, Berkeley | **not played** |
| Help on the Way | first | 1975-03-01 | **1975-06-17** | Winterland, San Francisco | **not played** |
| I Need a Miracle | first | 1978-08-18 | **1978-08-30** | Red Rocks Amphitheatre, Morrison | **not played** |
| If the Shoe Fits | first | 1979-11-01 | **1994-06-09** | Cal Expo Amphitheatre, Sacramento | **not played** |
| If the Shoe Fits | last | 1979-12-28 | **1995-03-24** | Charlotte Coliseum, Charlotte | **not played** |
| It Hurts Me Too | first | 1966-07-03 | **1966-05-19** | Avalon Ballroom, San Francisco | **not played** |
| It Hurts Me Too | last | 1970-06-24 | **1972-05-24** | Lyceum, London | **not played** |
| It Must Have Been the Roses | first | 1969-05-10 | **1974-02-22** | Winterland, San Francisco | **not played** |
| Its All Over Now | first | 1966-07-03 | **1969-09-06** | Family Dog On The Great Highway, San Francisco | **not played** |
| Its All Over Now | last | 1989-10-09 | **1995-07-02** | Deer Creek Music Center, Noblesville | **not played** |
| Johnny B. Goode | first | 1976-06-03 | **1971-01-22** | Gymnasium, Lane Community College, Eugene | **not played** |
| Just Like Tom Thumbs Blues | first | 1982-04-06 | **1985-03-27** | Nassau Veterans Memorial Coliseum, Uniondale | **not played** |
| Kansas City | first | 1969-01-17 | **1985-10-28** | Fox Theatre, Atlanta | **not played** |
| Kansas City | last | 1969-02-28 | **1985-11-05** | Centrum, Worcester | **not played** |
| Katie Mae | first | 1966-07-03 | **1970-01-31** | The Warehouse, New Orleans | **not played** |
| La Bamba | first | 1984-03-31 | **1970-11-11** | 46th Street Rock Palace, Brooklyn | **not played** |
| La Bamba | last | 1994-12-16 | **1987-09-23** | Spectrum, Philadelphia | **not played** |
| Lady with a Fan | last | 1995-03-24 | **1995-07-08** | Soldier Field, Chicago | **not played** |
| Lazy Lightning | first | 1975-03-01 | **1976-06-03** | Paramount Theatre, Portland | **not played** |
| Lazy Lightning | last | 1995-07-01 | **1984-10-31** | Berkeley Community Theater, Berkeley | **not played** |
| Let It Grow | first | 1973-11-11 | **1973-09-07** | Nassau Veterans Memorial Coliseum, Uniondale | played, on tape |
| Little Star | last | 1994-12-16 | **1983-06-20** | Merriweather Post Pavilion, Columbia | **not played** |
| Lost Sailor | last | 1991-10-04 | **1986-03-24** | Spectrum, Philadelphia | **not played** |
| Lovelight | last | 1995-06-30 | **1995-06-19** | Giants Stadium, East Rutherford | **not played** |
| Lucy in the Sky with Diamonds | first | 1985-03-09 | **1993-03-17** | Capital Centre, Landover | **not played** |
| Lucy in the Sky with Diamonds | last | 1985-06-15 | **1995-06-28** | The Palace, Auburn Hills | **not played** |
| Mama Tried | first | 1969-06-11 | **1969-06-20** | Fillmore East, New York | **not played** |
| Man Smart Woman Smarter | last | 1995-06-25 | **1995-06-21** | Knickerbocker Arena, Albany | **not played** |
| Mason's Children | last | 1970-05-02 | **1970-02-28** | Family Dog On The Great Highway, San Francisco | **not played** |
| Mexicali Blues | first | 1971-09-29 | **1971-10-19** | Northrop Auditorium, University of Minnesota, Minneapolis | **not played** |
| Minglewood Blues | last | 1995-07-08 | **1995-06-27** | The Palace, Auburn Hills | **not played** |
| Mission in the Rain | last | 1995-06-30 | **1976-06-29** | Auditorium Theatre, Chicago | **not played** |
| Money Money | first | 1971-07-31 | **1974-05-17** | P.N.E. Coliseum, Vancouver | **not played** |
| Money Money | last | 1972-03-21 | **1974-05-21** | Hec S. Edmundson Pavilion, University of Washington, Seattle | **not played** |
| My Brother Esau | first | 1983-03-14 | **1983-03-25** | Compton Terrace, Tempe | **not played** |
| New Minglewood Blues | last | 1995-07-08 | **1995-06-27** | The Palace, Auburn Hills | **not played** |
| Peggy-O | first | 1973-02-09 | **1973-12-10** | Charlotte Coliseum, Charlotte | **not played** |
| Playing in the Band | last | 1995-07-09 | **1995-07-05** | Riverport Amphitheatre, Maryland Heights | **not played** |
| Rain | first | 1993-06-06 | **1992-12-02** | McNichols Sports Arena, Denver | **not played** |
| Rain | last | 1993-09-22 | **1995-06-30** | Three Rivers Stadium, Pittsburgh | **not played** |
| Revolution | first | 1988-04-02 | **1983-10-12** | Madison Square Garden, New York | **not played** |
| Revolution | last | 1989-07-07 | **1990-03-28** | Nassau Veterans Memorial Coliseum, Uniondale | **not played** |
| Rosemary | last | 1970-02-14 | **1968-12-07** | Knight's Hall, Bellarmine College, Louisville | **not played** |
| Samba in the Rain | first | 1992-12-02 | **1994-06-08** | Cal Expo Amphitheatre, Sacramento | **not played** |
| Satisfaction | first | 1966-07-03 | **1980-11-26** | Sportatorium, Pembroke Pines | **not played** |
| Shakedown Street | first | 1978-08-18 | **1978-08-31** | Red Rocks Amphitheatre, Morrison | **not played** |
| Slipknot! | first | 1974-06-20 | **1975-06-17** | Winterland, San Francisco | **not played** |
| So Many Roads | first | 1992-02-21 | **1992-02-22** | Oakland-Alameda County Coliseum Arena, Oakland | **not played** |
| Stagger Lee | first | 1978-08-18 | **1978-08-30** | Red Rocks Amphitheatre, Morrison | **not played** |
| Standing on the Moon | first | 1989-02-06 | **1989-02-05** | Henry J. Kaiser Convention Center, Oakland | **not played** |
| Stuck Inside of Mobile with the Memphis Blues Again | last | 1995-06-30 | **1995-04-02** | The Pyramid, Memphis | **not played** |
| Sunshine Daydream | first | 1972-01-02 | **1973-12-10** | Charlotte Coliseum, Charlotte | **not played** |
| Sunshine Daydream | last | 1995-07-08 | **1994-06-10** | Cal Expo Amphitheatre, Sacramento | **not played** |
| Supplication | first | 1975-04-02 | **1976-06-03** | Paramount Theatre, Portland | **not played** |
| Tennessee Jed | first | 1971-09-30 | **1971-10-19** | Northrop Auditorium, University of Minnesota, Minneapolis | **not played** |
| The Music Never Stopped | first | 1975-02-28 | **1975-08-13** | Great American Music Hall, San Francisco | **not played** |
| The Race Is On | first | 1986-03-19 | **1969-12-31** | Boston Tea Party, Boston | **not played** |
| The Wheel | first | 1976-05-28 | **1976-06-03** | Paramount Theatre, Portland | **not played** |
| Throwing Stones | first | 1981-11-11 | **1982-09-17** | Cumberland County Civic Center, Portland | **not played** |
| Turn on Your Love Light | last | 1995-06-30 | **1995-06-19** | Giants Stadium, East Rutherford | **not played** |
| Two Souls in Communion | first | 1994-12-10 | **1972-03-21** | Academy of Music, New York | **not played** |
| Two Souls in Communion | last | 1994-12-16 | **1972-05-26** | Lyceum, London | **not played** |
| U.S. Blues | last | 1995-07-09 | **1995-07-08** | Soldier Field, Chicago | **not played** |
| Unbroken Chain | first | 1995-02-20 | **1995-03-19** | Spectrum, Philadelphia | **not played** |
| Victim or the Crime | first | 1988-06-01 | **1988-06-17** | Metropolitan Sports Center, Bloomington | **not played** |
| Wang Dang Doodle | first | 1987-09-15 | **1983-08-26** | Portland Memorial Coliseum, Portland | **not played** |
| Wave to the Wind | first | 1993-09-14 | **1992-02-22** | Oakland-Alameda County Coliseum Arena, Oakland | **not played** |
| Wave to the Wind | last | 1994-10-01 | **1993-12-09** | Los Angeles Memorial Sports Arena, Los Angeles | **not played** |
| Werewolves of London | first | 1978-04-11 | **1978-04-19** | Veterans Memorial Auditorium, Columbus | **not played** |
| West L.A. Fadeaway | first | 1982-10-10 | **1982-08-28** | Oregon Country Fairgrounds, Veneta | **not played** |
| When I Paint My Masterpiece | first | 1987-04-03 | **1987-06-13** | Ventura County Fairgrounds, Ventura | **not played** |
| When Push Comes to Shove | first | 1986-12-01 | **1986-12-15** | Oakland-Alameda County Coliseum Arena, Oakland | **not played** |
| Women Are Smarter | first | 1986-03-19 | **1981-07-02** | The Summit, Houston | **not played** |

### B. The sources disagree, or only JerryBase knows (52 dates, 46 songs)

JerryBase is the performed setlist. Relisten's first/last is the first/last night *on tape*, read from the Archive's own dating.

| Song | | Catalog | JerryBase | Venue (JerryBase) | Relisten's on tape | Catalog's night | Why it's here |
|---|---|---|---|---|---|---|---|
| Aint It Crazy (The Rub) | first | 1966-07-03 | 1970-04-19 | Family Dog On The Great Highway, San Francisco | 1970-05-15 | **not played** | JerryBase's night isn't on any tape Relisten lists |
| Alligator | first | 1967-01-27 | 1967-06-01 | Tompkins Square Park, New York | 1967-05-05 | **not played** | JerryBase's night isn't on any tape Relisten lists |
| Beat It On Down the Line | first | 1966-03-12 | 1966-02-06 | Valley Unitarian Universalist Church, North Hills | 1966-03-19 | **not played** | JerryBase's night isn't on any tape Relisten lists |
| Big Railroad Blues | first | 1969-09-07 | 1970-06-24 | Capitol Theatre, Port Chester | 1970-06-24 | **not played** | JerryBase also lists it on a night with no known day (1966-02-00) |
| Born Cross-Eyed | last | 1969-06-01 | 1968-06-01 | Carousel Ballroom, San Francisco | 1968-03-30 | **not played** | JerryBase's night isn't on any tape Relisten lists |
| Brown Eyed Women | first | 1971-09-30 | 1971-08-24 | Auditorium Theatre, Chicago | 1971-10-19 | **not played** | JerryBase's night isn't on any tape Relisten lists |
| Caution (Do Not Stop on Tracks) | first | 1966-07-03 | 1966-02-25 | Empire Studios, Los Angeles | 1966-01-08 | **not played** | Relisten has a taped night JerryBase doesn't list (1966-01-08) |
| Caution (Do Not Stop on Tracks) | last | 1971-10-31 | 1981-05-06 | Nassau Veterans Memorial Coliseum, Uniondale | 1972-05-11 | **not played** | JerryBase's night isn't on any tape Relisten lists |
| Cold Rain and Snow | first | 1966-02-25 | 1966-03-25 | Trouper's Hall, Los Angeles | 1966-02-25 | **not in JerryBase's setlist**, but on tape | Relisten has a taped night JerryBase doesn't list (1966-02-25) |
| Cream Puff War | first | 1966-07-03 | 1966-05-19 | Avalon Ballroom, San Francisco | 1966-03-12 | played, on tape | Relisten has a taped night JerryBase doesn't list (1966-03-12) |
| Cream Puff War | last | 1968-03-30 | 1967-04-28 | Stockton Ballroom, Stockton | 1967-03-18 | **not played** | JerryBase's night isn't on any tape Relisten lists |
| Cryptical Envelopment | first | 1967-10-22 | 1967-08-05 | O'Keefe Centre, Toronto | 1967-10-22 | played, on tape | JerryBase's night isn't on any tape Relisten lists |
| Dancing in the Street | first | 1966-07-01 | 1966-05-29 | California Hall, San Francisco | 1966-07-03 | **not played** | JerryBase's night isn't on any tape Relisten lists |
| Drums | first | 1978-01-06 | 1967-08-06 | Place Ville Marie, Montreal | 1967-11-10 | played, on tape | a segment name, not a song; JerryBase's night isn't on any tape Relisten lists |
| El Paso | first | 1970-07-11 | 1969-07-08 | Rock Pile, Toronto | 1970-07-11 | **not in JerryBase's setlist**, but on tape | JerryBase's night isn't on any tape Relisten lists |
| Going Down the Road Feeling Bad | first | 1970-06-24 | 1970-10-10 | Colden Auditorium, Queens College, Queens | 1970-10-11 | **not played** | JerryBase's night isn't on any tape Relisten lists |
| Good Morning Little School Girl | first | 1966-07-03 | 1966-04-22 | Longshoreman's Hall, San Francisco | 1966-07-16 | **not played** | JerryBase's night isn't on any tape Relisten lists |
| High Time | first | 1969-06-21 | 1969-06-20 | Fillmore East, New York | 1969-06-21 | played, on tape | JerryBase's night isn't on any tape Relisten lists |
| I Know You Rider | first | 1965-11-03 | 1966-01-28 | Matrix, San Francisco | 1966-02-25 | **not played** | January 1966 Matrix tapes; JerryBase's night isn't on any tape Relisten lists |
| In the Midnight Hour | first | 1966-07-03 | 1965-12-18 | The Big Beat Club, Palo Alto | 1966-09-16 | played, no tape | JerryBase's night isn't on any tape Relisten lists |
| Its All Over Now Baby Blue | first | 1966-05-19 | 1966-01-07 | Matrix, San Francisco | 1966-03-12 | played, on tape | January 1966 Matrix tapes; JerryBase's night isn't on any tape Relisten lists |
| Jam | first | 1966-07-03 | 1967-07-23 | Straight Theater, San Francisco | 1966-03-25 | **not played** | a segment name, not a song; JerryBase's night isn't on any tape Relisten lists |
| Jam | last | 1995-07-09 | 1995-07-08 | Soldier Field, Chicago | 1995-03-23 | **not played** | a segment name, not a song; JerryBase's night isn't on any tape Relisten lists |
| Katie Mae | last | 1966-12-01 | 1970-07-11 | Fillmore East, New York | 1970-07-12 | **not played** | JerryBase's night isn't on any tape Relisten lists |
| Knockin on Heavens Door | first | 1987-07-04 | 1987-07-06 | Pittsburgh Civic Arena, Pittsburgh | 1978-11-17 | **not in JerryBase's setlist**, but on tape | Relisten has a taped night JerryBase doesn't list (1978-11-17) |
| Little Star | first | 1994-10-01 | 1983-04-09 | Hampton Coliseum, Hampton | 1983-04-15 | **not played** | JerryBase's night isn't on any tape Relisten lists |
| Lovelight | first | 1966-10-10 | 1967-06-01 | Tompkins Square Park, New York | 1967-08-05 | **not played** | JerryBase's night isn't on any tape Relisten lists |
| Minglewood Blues | first | 1966-07-03 | 1966-05-19 | Avalon Ballroom, San Francisco | 1966-03-12 | played, on tape | Relisten has a taped night JerryBase doesn't list (1966-03-12) |
| Morning Dew | first | 1967-01-14 | 1967-03-18 | Winterland, San Francisco | 1967-01-14 | **not in JerryBase's setlist**, but on tape | Relisten has a taped night JerryBase doesn't list (1967-01-14) |
| New Minglewood Blues | first | 1977-02-26 | 1966-05-19 | Avalon Ballroom, San Francisco | 1966-03-12 | played, on tape | Relisten has a taped night JerryBase doesn't list (1966-03-12) |
| New Potato Caboose | first | 1967-01-27 | 1967-08-04 | O'Keefe Centre, Toronto | 1967-05-05 | **not played** | Relisten has a taped night JerryBase doesn't list (1967-05-05) |
| New Potato Caboose | last | 1969-06-08 | 1969-07-08 | Rock Pile, Toronto | 1969-06-08 | played, on tape | JerryBase's night isn't on any tape Relisten lists |
| Nobody's Fault But Mine | first | 1981-03-09 | 1966-07-03 | Fillmore Auditorium, San Francisco | 1966-07-16 | **not played** | JerryBase's night isn't on any tape Relisten lists |
| Playing in the Band Reprise | first | 1972-01-02 | 1984-10-12 | Augusta Civic Center, Augusta | 1985-11-05 | **not played** | JerryBase's night isn't on any tape Relisten lists |
| Playing in the Band Reprise | last | 1995-07-09 | 1993-09-29 | Boston Garden, Boston | 1985-11-05 | **not played** | JerryBase's night isn't on any tape Relisten lists |
| Promised Land | first | 1971-05-29 | 1966-01-28 | Matrix, San Francisco | 1971-05-29 | played, on tape | January 1966 Matrix tapes; JerryBase's night isn't on any tape Relisten lists |
| Queen Jane Approximately | first | 1987-04-03 | 1987-09-08 | Providence Civic Center, Providence | 1987-07-04 | **not played** | Relisten has a taped night JerryBase doesn't list (1987-07-04) |
| Scarlet Begonias > Fire on the Mountain | first | 1977-05-08 | 1977-03-18 | Winterland, San Francisco | — | played, no tape | medley row: nights where both parts were played |
| Scarlet Begonias > Fire on the Mountain | last | 1995-07-09 | 1995-07-02 | Deer Creek Music Center, Noblesville | — | **not played** | medley row: nights where both parts were played |
| She Belongs to Me | first | 1985-04-04 | 1966-01-07 | Matrix, San Francisco | 1985-04-04 | played, on tape | January 1966 Matrix tapes; JerryBase's night isn't on any tape Relisten lists |
| Space | first | 1974-10-18 | 1967-07-23 | Straight Theater, San Francisco | 1972-08-21 | **not played** | a segment name, not a song; JerryBase's night isn't on any tape Relisten lists |
| St. Stephen | first | 1968-06-14 | 1968-06-07 | Carousel Ballroom, San Francisco | 1968-06-14 | played, on tape | JerryBase's night isn't on any tape Relisten lists |
| Stuck Inside of Mobile with the Memphis Blues Again | first | 1987-04-03 | 1988-03-17 | Henry J. Kaiser Convention Center, Oakland | 1987-07-04 | **not played** | Relisten has a taped night JerryBase doesn't list (1987-07-04) |
| The Eleven | last | 1974-06-30 | 1970-04-25 | Mammoth Gardens, Denver | 1970-04-24 | **not played** | JerryBase's night isn't on any tape Relisten lists |
| The Golden Road | last | 1967-05-05 | 1967-09-29 | Straight Theater, San Francisco | 1967-05-05 | **not in JerryBase's setlist**, but on tape | JerryBase's night isn't on any tape Relisten lists |
| To Lay Me Down | first | 1970-07-30 | 1970-07-28 | Matrix, San Francisco | 1970-07-30 | **not in JerryBase's setlist**, but on tape | JerryBase's night isn't on any tape Relisten lists |
| Truckin' | first | 1969-05-10 | 1970-08-17 | Fillmore West, San Francisco | 1970-08-18 | **not played** | JerryBase's night isn't on any tape Relisten lists |
| Turn on Your Love Light | first | 1967-09-29 | 1967-06-01 | Tompkins Square Park, New York | 1967-08-05 | **not played** | JerryBase's night isn't on any tape Relisten lists |
| Uncle John's Band | first | 1969-05-10 | 1969-11-01 | Family Dog On The Great Highway, San Francisco | 1969-12-04 | **not played** | JerryBase's night isn't on any tape Relisten lists |
| Viola Lee Blues | first | 1966-07-03 | 1966-01-28 | Matrix, San Francisco | 1966-03-19 | played, on tape | January 1966 Matrix tapes; JerryBase's night isn't on any tape Relisten lists |
| Walkin Blues | first | 1991-02-19 | 1967-04-08 | KPIX-TV Studios, San Francisco | 1966-10-07 | **not played** | JerryBase's night is a TV/radio session; JerryBase's night isn't on any tape Relisten lists |
| We Bid You Goodnight | first | 1968-01-22 | 1968-03-09 | Melodyland Theatre, Anaheim | 1968-03-16 | **not played** | JerryBase's night isn't on any tape Relisten lists |

### C. The catalog has no dates (35 songs)

C1, 22 songs: JerryBase and Relisten agree at both ends.

| Song | First | Venue | Last | Venue | Nights (JerryBase) |
|---|---|---|---|---|---|
| Attics of My Life | 1970-05-14 | Meramec Community College, St. Louis | 1995-07-02 | Deer Creek Music Center, Noblesville | 49 |
| Baby What You Want Me To Do | 1982-12-31 | Oakland Auditorium, Oakland | 1985-11-08 | Rochester Community War Memorial, Rochester | 4 |
| Big Boy Pete | 1966-11-29 | Matrix, San Francisco | 1985-11-21 | Henry J. Kaiser Convention Center, Oakland | 8 |
| C.C. Rider | 1979-12-01 | Stanley Theatre, Pittsburgh | 1992-03-16 | Spectrum, Philadelphia | 127 |
| Candyman | 1970-04-03 | Armory Field House, University of Cincinnati, Cincinnati | 1995-06-30 | Three Rivers Stadium, Pittsburgh | 286 |
| Cassidy | 1974-03-23 | Cow Palace, Daly City | 1995-07-06 | Riverport Amphitheatre, Maryland Heights | 335 |
| Dear Mr. Fantasy | 1984-06-14 | Red Rocks Amphitheatre, Morrison | 1990-07-21 | World Music Theatre, Tinley Park | 58 |
| Easy To Love You | 1979-08-14 | McNichols Sports Arena, Denver | 1990-07-18 | Deer Creek Music Center, Noblesville | 45 |
| Gimme Some Lovin' | 1984-11-02 | Berkeley Community Theater, Berkeley | 1990-09-15 | Madison Square Garden, New York | 87 |
| Hide Away Jam | 1971-11-07 | Harding Theater, San Francisco | 1989-06-21 | Shoreline Amphitheatre, Mountain View | 2 |
| I Will Take You Home | 1988-06-22 | Alpine Valley Music Theatre, East Troy | 1990-07-14 | Sullivan Stadium, Foxboro | 34 |
| Iko Iko | 1977-05-15 | St. Louis Arena, St. Louis | 1995-07-05 | Riverport Amphitheatre, Maryland Heights | 185 |
| It Takes A Lot To Laugh, It Takes A Train To Cry | 1973-06-10 | Robert F. Kennedy Stadium, Washington | 1992-03-16 | Spectrum, Philadelphia | 7 |
| Keep On Growing | 1985-06-14 | William Randolph Hearst Greek Theatre, UC Berkeley, Berkeley | 1986-02-14 | Henry J. Kaiser Convention Center, Oakland | 4 |
| Let The Good Times Roll | 1988-04-30 | Frost Amphitheatre, Stanford University, Palo Alto | 1995-05-29 | Portland Meadows, Portland | 47 |
| Maybe You Know | 1983-04-13 | Patrick Gymnasium, University of Vermont, Burlington | 1986-04-21 | Berkeley Community Theater, Berkeley | 6 |
| Monkey & The Engineer | 1969-12-19 | Fillmore Auditorium, San Francisco | 1989-02-12 | Great Western Forum, Inglewood | 39 |
| Mountains of the Moon | 1968-12-20 | Shrine Exhibition Hall, Los Angeles | 1969-07-12 | NY State Pavilion, Flushing Meadows Park, New York | 15 |
| Operator | 1970-08-18 | Fillmore West, San Francisco | 1970-11-08 | Capitol Theatre, Port Chester | 4 |
| The Weight | 1990-03-28 | Nassau Veterans Memorial Coliseum, Uniondale | 1995-03-23 | Charlotte Coliseum, Charlotte | 41 |
| Visions of Johanna | 1986-03-19 | Hampton Coliseum, Hampton | 1995-07-08 | Soldier Field, Chicago | 8 |
| Walkin' The Dog | 1970-03-21 | Capitol Theatre, Port Chester | 1985-11-21 | Henry J. Kaiser Convention Center, Oakland | 6 |

C2, 13 songs: the sources disagree at one end, or the row is a medley.

| Song | JerryBase first | Relisten first | JerryBase last | Relisten last | Note |
|---|---|---|---|---|---|
| Death Don't Have No Mercy | 1965-12-11 | 1966-01-08 | 1990-04-02 | 1990-04-02 |  |
| Frozen Logger | 1970-05-07 | 1970-06-21 | 1985-09-07 | 1970-06-21 |  |
| Gloria | 1967-03-25 | 1981-10-16 | 1995-06-30 | 1995-06-30 |  |
| Good Time Blues | 1981-08-28 | — | 1990-07-23 | — | no Relisten song |
| Hey Jude | 1969-02-11 | 1969-03-01 | 1990-03-22 | 1990-03-22 |  |
| I'm A King Bee | 1966-03-19 | 1966-01-08 | 1994-03-31 | 1994-03-31 |  |
| Louie Louie | 1967-05-18 | 1988-04-05 | 1989-04-09 | 1989-04-09 |  |
| Mona | 1970-09-25 | 1972-03-25 | 1991-10-27 | 1991-10-27 |  |
| Oh Boy! | 1971-04-06 | 1971-04-06 | 1971-04-06 | 1981-12-12 |  |
| Scarlet Fire | 1977-03-18 | — | 1995-07-02 | — | medley row |
| That's Alright Mama | 1973-06-10 | — | 1986-04-18 | — | no Relisten song |
| The Same Thing | 1966-11-18 | 1966-11-19 | 1995-07-05 | 1995-07-05 |  |
| Truckin > Smokestack Lightning | 1970-09-17 | — | 1994-10-18 | — | medley row |

### D. JerryBase has no Grateful Dead performance of it (7 songs)

| Song | Catalog first | Catalog last |
|---|---|---|
| Childrenns Lullaby | 1966-07-03 | 1966-12-01 |
| Gypsy Heart | — | — |
| Matilda Mother | 1966-07-03 | 1966-12-01 |
| Seems Like Old Times | 1966-07-03 | 1966-12-01 |
| Shakin All Over | 1985-11-01 | 1985-11-02 |
| Tom Dooley | 1966-07-03 | 1968-10-20 |
| Whipping Post | 1970-02-11 | 1971-02-18 |
