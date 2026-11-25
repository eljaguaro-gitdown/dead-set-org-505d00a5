# Tape desk log

One line per ticket run, newest last, under the summary. This file is also the
desk's resume file. A fresh session reads the summary and DECISIONS.md, and
carries on from there.

## Summary: first run, 2026-11-24

**What was built** (branch `claude/deadset-tape-desk-agent-4e9204`, with #156 under it):

- **The night check.** `scripts/tape-desk/night.ts` and `nightCheck.ts` decide whether a song was played that night and whether it is on any tape. They read Relisten v2 and JerryBase and use the player's own matcher.
- **Probe fixes.**
  - #144: a night with no matching track no longer reads as "found".
  - #153: the probe now tries the `.flacNN`-less identifier.
- **The lookout.**
  - Trigger `tape_desk_lookout` posts to the edge function `tape-desk`, which sends a GitHub `repository_dispatch`.
  - `.github/workflows/tape-desk.yml` runs Claude Code headless, on the subscription token, with `concurrency: tape-desk-<song>-<night>` and the `TAPE_DESK_AUTOFIX` kill switch.
  - The workflow reads reports, pins tapes and alerts the owner through the same function, authenticated by GitHub OIDC. Nothing is stored for that.
  - `tape_desk_dispatches` logs every dispatch, so the sweep can tell missed ones.
- **Pins with provenance.** `tape_index.pinned_by / pin_issue / pin_note`. The refresh skips a pinned night.
- **The owner alert.** Template `tape-desk-alert`, with "Ready to close" and "Held for you".
- **The runbook.** `/tape-desk issue=<id>` works one ticket through steps 1–8. Plain `/tape-desk` is the hourly sweep.
- **Proof.**
  - `supabase/tests/tape_desk.pglite.mjs` puts reports in through the real `report_playback_issue()` and reads what the trigger posts: 45 assertions.
  - Vitest covers the dispatch, OIDC (real RSA signatures), pins and alerts.
  - It caught one real bug before it shipped: a CHECK constraint that passed on NULL.

**Found on the way: the index refresh has never worked (#155, fix #156).**

- Every hourly `tape-index-refresh` since deploy was refused with 401.
- The index has held the 2026-11-07 seed (700 rows) plus 6 rows from fans' taps; 500+ keys are waiting.
- #156 passed the gate and CI. #157 (the lookout) passed the gate with notes on `a9ae79c`, and the notes are fixed in `b893d0d`.

**Tickets ready to close:** none.

**Tickets held for the owner:** all four open in-scope tickets are class N, the song wasn't played that night. Each carries a recommended repoint, checked against both sources.

| Ticket | Song · night | Where the night comes from | Recommended |
|---|---|---|---|
| #153 | Bird Song · 1972-04-08 (seed) | Songbook issue slot 2 | repoint to 1972-08-12 or 1972-08-27 |
| #154 | Bird Song · 1971-03-24 | Songbook issue slot 1 ("First time played") | repoint to 1971-02-19 (#150's SQL) |
| #151 | Viola Lee Blues · 1970-02-14 | `songs.last_played` | `last_played` = 1970-10-31 |
| #149 | Ramble On Rose · 1980-10-14 | a Charlie pick in a fan's guide | No tape exists; nobody is waiting |

Out of scope and left as they were: #143 Help on the Way (`wont_play`) and #150 Bird Song Play all (`none_in_setlist`).

**Applied the same evening, on the owner's instruction:** all four repoints (the owner picked 1972-08-27 for #153 and a repoint over No tape exists for #149), plus #150's 1995 night and two nights in the Viola Lee Blues Songbook issue. See [Owner repoints](#owner-repoints-2026-11-24-evening). All five tickets now wait on a tap and Mark fixed.

## Shipped and verified, 2026-11-24 (the owner said "allow the desk to merge")

| What | Merged | Live, and how it was checked |
|---|---|---|
| #156 refresh auth | `d67bc86` | Migration `20261124010000` applied (`cron.job` sends the bearer). `index-tapes` deployed. The job's own request answered `200 {"picked":40,"stored":40,"unreachable":0,"errors":0}`, and 66 rows were written. A no-credential refresh still gets 401. #155 closed. |
| #157 the lookout | `96c494e` | Migration `20261124020000` applied. Checked by `proacl`: only postgres and service_role execute the trigger and the candidates function; anon can't read the log; authenticated can't write it. `send-transactional-email` deployed. `tape-desk` **failed to bundle**: a cross-function import. |
| #158 bundle fix | `2e16b18` | `tape-desk` and `send-transactional-email` deployed. Live probes: every OIDC action returns `401 tape desk workflow only`, and dispatch with a bogus bearer returns `401 service role only`. |

End-to-end checks in production:

- **The workflow on main, `reason=synthetic`** (run 45359052992). It got a real GitHub OIDC token, the live function verified it against GitHub's keys, and it read the seed report: `{"in_scope":true,"kind":"not_on_tape","status":"open","index_rows":1,"dispatches":0,"waiting":1}`.
- **Database to function to GitHub**, exactly as the trigger posts. The function accepted the vault key and logged `no TAPE_DESK_GITHUB_TOKEN`, so it didn't dispatch. That is the one missing link, and it needs the owner's token.

**Open risks:**

1. ~~The lookout dispatches nothing until `TAPE_DESK_GITHUB_TOKEN` exists.~~ Added 2026-11-24; GitHub accepted the first dispatch at 19:41 (see the end-to-end test below).
2. ~~The workflow's Claude step stops at "owner action needed" until `CLAUDE_CODE_OAUTH_TOKEN` exists.~~ Added 2026-11-24 19:29; Claude ran on it at 19:50.
3. ~~No held alert was emailed for this run's four tickets.~~ #153 got its alert at 19:57. The 20:18 hourly sweep dispatched the other three, and each run sent its alert and recorded it on the ticket: #151 and #154 at 20:21, #149 at 20:23. Two sends each, all `sent`.
4. ~~`/songbook/bird-song` still offers "Play all 3 nights" with all three marked "No tape of it from this night".~~ All three nights repointed 2026-11-24 evening; the live page shows none marked.
5. **Charlie's cached prose on `/versions/viola-lee-blues` describes a performance that didn't happen.** It's fan-facing copy, so the desk won't touch it.
6. **The production-play harness for step 7.2 is not built.** No ticket reached it.
7. ~~The hourly task's own prompt still says never merge.~~ Applied on 2026-11-24 after the owner's yes; the text is in [`hourly-task-prompt.md`](hourly-task-prompt.md).

**Decisions that need the owner:**

1. ~~Create two credentials.~~ Done 2026-11-24, with the Actions setting.
   - `claude setup-token`, then add it as the repository secret `CLAUDE_CODE_OAUTH_TOKEN`.
   - A fine-grained GitHub token, Contents read and write on this repo only, as the Lovable Cloud secret `TAPE_DESK_GITHUB_TOKEN`.
   - In repository Settings → Actions → General, enable "Allow GitHub Actions to create and approve pull requests".
2. ~~Apply, or say no to, the four held tickets' repoints.~~ Applied 2026-11-24 evening (see Owner repoints below). Mark fixed on each is still the owner's.
3. **The class-N pattern fix:** audit `songs.first_played/last_played` against JerryBase. 93 of the 114 no-tape nights are catalog first/last dates. The Songbook issues carry the same error: Bird Song had all three nights wrong, Viola Lee Blues two of five, and Ramble On Rose five of eight (all fixed, see Owner repoints). All ten issues have now been checked (Songbook audit below); 14 more nights are fixed. Ripple's guide now ends on 1988-09-03 (the owner removed its 1990-07-14 row), and its catalog `last_played` was set to match (see Songbook audit). The rest of the catalog keys still wait on this audit.
4. **Whether Charlie's picks are checked against a setlist source** before a guide saves. #149's own guide (setlist `5f1089c6`) still has four more class-N nights from the blast-radius run: 1977-05-08, 1977-09-03, 1990-03-24 and 1993-03-27.
5. ~~Paste the proposed hourly-task prompt.~~ Done 2026-11-24: the session applied it on the owner's yes.


## End-to-end test, 2026-11-24 evening (the owner added both tokens)

Each leg was driven in production the way a fan's report drives it. The dispatches went from the production database through `net.http_post`, with the vault key, the function url and the body exactly as the `tape_desk_lookout` trigger posts them. The trigger itself is installed and enabled (`tgenabled = O`). Bird Song 1972-04-08 (#153) was the ticket.

| Leg | Result |
|---|---|
| database → `tape-desk` function | 200, service key accepted |
| function → GitHub `repository_dispatch` (`TAPE_DESK_GITHUB_TOKEN`) | 204 every time, run started within 8 s, on `main` |
| workflow → OIDC → function (`api.mjs issue`) | synthetic run 45472815317: `{"in_scope":true,"kind":"not_on_tape","status":"open","index_rows":1,"dispatches":2,"waiting":1}` |
| workflow → Claude on the subscription (`CLAUDE_CODE_OAUTH_TOKEN`) | run 45474220086: the runbook ran, read the report and `tape_index` through OIDC, found #153, and held it as class N |
| workflow → owner alert (`api.mjs alert` → `send-transactional-email`, template `tape-desk-alert`) | run 45475377388, after #163: two sends at 19:57, one per owner inbox, both `sent`, no error. The run commented `Owner alerted 2026-11-24 19:57 UTC (held)` on #153 as `github-actions` |
| nothing the desk may not touch | after all three runs: row still `open`, no `playback-fixed` email, no push to `main`, no branch |

**Not yet driven live:** the production trigger firing on a real report (only its exact request was replayed), opening a new ticket, a pin, and a PR through merge and publish. They need a new in-scope report from a fan.

**What the test found and fixed:**

1. **#161: never push to `main`.** `main` has no branch protection, and the runbook asked for a LOG.md line without saying how a workflow run lands one. A hold has no PR, so the line goes in the ticket report as `Log: …`, and the next desk PR carries it here.
2. **#162: `ubuntu-latest` is now 26.04, and Playwright 1.58 has no WebKit for it.** The first full run (45473465985) died at Install. `tape-desk.yml` and `tapebench.yml` are pinned to `ubuntu-24.04`. TapeBench had not run since Nov 7, so it would have failed the same way.
3. **#163: a re-run of a held ticket.** Run 45474220086 judged "nothing new", posted nothing and sent no alert. That is right for a repeat, but it means the four tickets held this morning, before the alert template was deployed, would never be alerted. Every alert is now recorded on its ticket (`Owner alerted <time> (held|ready)`), and a held ticket with no such line gets one.

## Owner repoints, 2026-11-24 evening

Night data, no PR: each change is live on dead-set.org the moment it is applied. Every `update` was guarded to the row that still held the old night, and each changed exactly one row. Each new night was checked with `night.ts` (JerryBase and Relisten, the player's own matcher) before or after it was applied, and each live page was read on dead-set.org afterwards. Nobody has tapped them on the live site yet. Each ticket carries the full record and a "Check it" link.

| Ticket | Where | Before → after | The new night |
|---|---|---|---|
| #154 | `/songbook/bird-song`, position 1 | 1971-03-24 Winterland Arena → **1971-02-19 Capitol Theatre** ("First time played") | JerryBase played; 4 tapes carry it; `tape_index` playable (8:37); 3 verified plays |
| #153 | `/songbook/bird-song`, position 2 | 1972-04-08 Wembley Empire Pool → **1972-08-27 Old Renaissance Faire Grounds, Veneta** | JerryBase played; 7 of 7 sources carry it (12:33); not yet in `tape_index` |
| #150 | `/songbook/bird-song`, position 3 | 1995-07-09 Soldier Field → **1995-06-30 Three Rivers Stadium** ("Last time played"). #150's second `update`, with the venue filled from Relisten | JerryBase played; 8 of 8 sources carry it; `tape_index` playable (12:14) |
| #151 | `songs.last_played` (`/versions/viola-lee-blues`) | 1970-02-14 → **1970-10-31** | JerryBase played (both shows); 7 tapes carry it; `tape_index` playable (9:46) |
| #151 | `/songbook/viola-lee-blues`, position 5 | 1970-02-14 Fillmore East → **1970-10-31 Pritchard Gym, S.U.N.Y.** ("Last time played"). Its paragraph about the Valentine's Day '70 run was removed, not rewritten | as above |
| no ticket | `/songbook/viola-lee-blues`, position 2 | 1967-03-17 → **1967-03-18**, Winterland Arena. No show exists on 1967-03-17 in JerryBase, Relisten or the Archive. Venue and note unchanged | JerryBase played; 4 of 4 sources carry it; `tape_index` playable (13:50) |
| #149 | Ramble On Rose listening guide `5f1089c6`, position 5 | 1980-10-14 → **1980-10-11 Warfield Theatre**. The note under it still describes the original pick | JerryBase played; 8 of 11 sources carry it; `tape_index` playable (7:10) |

**Then `/songbook/ramble-on-rose`** (setlist `704d459b`), on the owner's "fix the five too". All five were nights the song wasn't played, from the class-N list below. Each moved to the nearest night Relisten lists with Ramble On Rose (318 nights), on the same tour where one exists. Each note's paragraph described a performance on a night the song wasn't played, for example "Coming from the legendary 'One from the Vault' show", so it was removed and the night keeps a date-and-venue label. One `update`, each row guarded to its old date; five rows changed. The live page lists all eight nights with no "no tape" mark.

| Position | Before → after | The new night |
|---|---|---|
| 3 | 1977-05-08 Barton Hall (Cornell) → **1977-05-11 St. Paul Civic Center** | JerryBase played; 7 of 7 sources carry it |
| 4 | 1989-10-16 Brendan Byrne Arena → **1989-10-22 Charlotte Coliseum** | JerryBase played; 14 of 14 sources; `tape_index` playable (8:07) |
| 5 | 1975-08-13 Great American Music Hall → **1974-10-17 Winterland Arena**. The band never played the song in 1975; this is the nearest night, from the October 1974 retirement run | JerryBase played; 7 of 8 sources |
| 6 | 1991-06-22 → **1991-06-19 Pine Knob Music Theater** | JerryBase played; 12 of 12 sources |
| 7 | 1974-05-19 Memorial Coliseum → **1974-05-17 P.N.E. Coliseum** | JerryBase played; 3 of 3 sources |

## Songbook audit, 2026-11-24 night

`night.ts --keys` over every night in all ten Songbook issues: 82 nights in the eight community issues and the two curated ones (Shakedown Street and Crazy Fingers, whose nights are their `notable_versions` plus the first and last played).

| Result | Nights |
|---|---|
| JerryBase played, on tape | 63 |
| Not in JerryBase, but tapes of the night carry the song (left alone): Slipknot! 1974-06-20 (the early jam), Althea and Shakedown Street 1981-03-28, Ramble On Rose 1971-10-19 | 4 |
| Class N: not in JerryBase's setlist, and no tape of the night has it | 15 |

Both curated issues and the three issues fixed earlier are clean. The 15 are all in community issues. 14 were repointed on the owner's "yes, repoint them", each to the nearest night Relisten lists with the song, checked with `night.ts` (JerryBase played, the song on tape). One `update` guarded each row to its old date; 14 rows changed. Every night's paragraph described a performance on a night the song wasn't played (for example "This version features Branford Marsalis on saxophone" on an Althea from a night with no Althea), so each was replaced by a date-and-venue label, and the stored recording url, a tape of the wrong night, was cleared so the player resolves the new night. The four live pages list the new nights with no "no tape" mark.

| Issue | Before → after | Tapes carrying the song |
|---|---|---|
| Althea | 1982-04-06 → **1982-04-05** The Spectrum | 7 of 7 |
| Althea | 1991-09-10 → **1991-09-13** Madison Square Garden | 15 of 15 |
| Eyes of the World | 1978-11-24 → **1978-11-21** Community War Memorial Auditorium | 4 of 5 |
| Eyes of the World | 1991-03-17 → **1991-03-20** Capital Centre | 12 of 13 |
| Eyes of the World | 1993-06-15 → **1993-06-11** Buckeye Lake Music Center | 10 of 11 |
| Slipknot! | 1976-06-09 → **1976-06-10** Boston Music Hall | 12 of 12 |
| Slipknot! | 1977-04-27 → **1977-04-29** The Palladium | 1 of 1 |
| Slipknot! | 1983-10-06 (no show that date) → **1983-10-12** Madison Square Garden | 24 of 24 |
| Slipknot! | 1990-03-22 → **1990-03-24** Knickerbocker Arena | 21 of 21 |
| Slipknot! | 1991-09-06 → **1991-09-10** Madison Square Garden | 25 of 25 |
| Stella Blue | 1974-07-19 → **1974-07-25** International Amphitheatre | 3 of 3 |
| Stella Blue | 1976-06-18 → **1976-06-15** Beacon Theatre | 8 of 8 |
| Stella Blue | 1988-09-03 → **1988-09-02** Capital Centre | 11 of 11 |
| Stella Blue | 1994-10-14 → **1994-10-10** USAir Arena | 10 of 10 |

~~**Left for the owner: Ripple's "Last time played • 1990-07-14".**~~ Ripple wasn't played that night. The catalog says 1989-09-27 (Warfield): one tape of the night has a track titled Ripple, but JerryBase and Relisten's setlist don't list it. Relisten's last Ripple is 1988-09-03, which is already in the issue.

**Settled 2026-11-25 (UTC):** the owner chose 1988-09-03 as the guide's last night. That night was already no. 5 of setlist `3c056ed0`, so moving no. 6 there would have listed it twice. Instead, on the owner's instruction:

- **No. 5** (slot `1f7e77b5`) is now labelled "Last time played • 1988-09-03 — Capital Centre", and its note is unchanged. Its stored tape `gd1988-09-03.sbd.walker-scotton.81661.sbeok.flac16` doesn't exist on the Archive (the metadata call returns `{}`), so it now points at `gd88-09-03.sbd.miller.27749.sbeok.flacf`, which `tape_index` has as playable (`gd88-09-03d2t12.mp3`, 5:13). The update was guarded to the old url and label, returned `old_notes`, and changed one row. Night check (`night.ts`, 2026-11-25 01:28 UTC): JerryBase played (`19880903-01`), Relisten's venue is Capital Centre, and 17 tapes of the night carry the song.
- **No. 6** (slot `0278c921`, 1990-07-14 Foxboro, a night Ripple wasn't played) was removed by the owner in the builder, because the desk doesn't delete rows. The desk never touched that row. Checked afterwards: the setlist has five slots, ending on no. 5. The live page reads "Play all 5 nights" and "18 years between the first and the last, Fillmore West to Capital Centre", and shows one "Last time played" night.
- **Catalog `last_played`:** the page's "Last played (LTP)" comes from `songs.last_played`, not from the guide. On the owner's instruction it went from 1989-09-27 to **1988-09-03**, in one row, guarded to the old value. `first_played` (1970-08-18), `times_played` (55) and `stats_source` (null, meaning the original import or a hand correction, not setlist.fm) are unchanged. Before the write, the desk checked every writer of the column: `fetch-show-setlist` sets it only on a song it inserts, `scripts/backfill-song-stats.mjs` fills only empty rows and reports a disagreement instead of overwriting, no cron job or database function writes it, and `tape_index_candidates` only reads it. Live afterwards: `/songbook/ripple` reads "Last played (LTP) Sep 3, 1988, Capital Centre", and `/versions/ripple` reads "Last played 1988".
**Two things this run got wrong, to bank:**

1. **Eyes of the World is another member's issue, not the owner's.** Its page names the member and says "These are the ones they picked", and three of those seven nights are now nights this session chose. The proposal listed the issue without saying whose it was. Before changing a Songbook issue, check the setlist's `creator_id` against `user_roles`. A member's issue needs the owner to decide knowing that, and probably the member to be told. Once told, the owner kept the three fixes and is telling the member.
2. **The 14 removed paragraphs were not saved.** The `update` returned only the new label, and the earlier read had cut each paragraph to 110 characters, so their full text is gone from everything this session can reach. The Viola Lee and Ramble On Rose paragraphs removed earlier were read in full first. Return `old_notes` from any `update` that drops text.

The four held tickets were repointed by a side session; #150's 1995 night and the two Viola Lee Songbook nights by this one. Mark fixed on #149–#154 is the owner's, and the fix note for each card was drafted for the owner to paste.

## Blast radius, 2026-11-24 (every no_match / no_tape default in tape_index)

`night.ts --keys` over 114 keys:

| Class | Keys | Detail |
|---|---|---|
| N | 110 | |
| possible G | 3 | 1966-07-03 Cream Puff War, In the Midnight Hour, Minglewood Blues: JerryBase lists them; the two tapes have only an untitled "Jam" |
| sources disagree | 1 | 1991-10-04 Lost Sailor: two hance/sirmick retracked tapes title a track "Lost Sailor >"; JerryBase doesn't list it, and the index says `no_match` |

The 110 class-N keys: 1966-07-03 Aint It Crazy (The Rub) · 1966-07-03 Caution (Do Not Stop on Tracks) · 1966-07-03 Childrenns Lullaby · 1966-07-03 Good Morning Little School Girl · 1966-07-03 It Hurts Me Too · 1966-07-03 Its All Over Now · 1966-07-03 Katie Mae · 1966-07-03 Matilda Mother · 1966-07-03 Satisfaction · 1966-07-03 Seems Like Old Times · 1966-07-03 Tom Dooley · 1966-10-10 Lovelight · 1966-12-01 Aint It Crazy (The Rub) · 1966-12-01 Childrenns Lullaby · 1966-12-01 Katie Mae · 1966-12-01 Matilda Mother · 1966-12-01 Seems Like Old Times · 1967-09-29 Turn on Your Love Light · 1968-03-30 Cream Puff War · 1969-01-17 Kansas City · 1969-02-27 Hard to Handle · 1969-02-28 Kansas City · 1970-02-11 Whipping Post · 1970-02-14 Rosemary · 1970-02-14 Viola Lee Blues · 1970-05-02 Mason's Children · 1970-06-24 Going Down the Road Feeling Bad · 1970-06-24 It Hurts Me Too · 1971-02-18 Good Morning Little School Girl · 1971-02-18 Whipping Post · 1971-03-24 Bird Song · 1971-03-24 Comes a Time · 1971-07-31 Money Money · 1971-10-31 Caution (Do Not Stop on Tracks) · 1972-01-02 Black-Throated Wind · 1972-01-02 Sunshine Daydream · 1972-03-21 Money Money · 1972-04-08 Bird Song · 1973-02-09 Peggy-O · 1974-05-19 Ramble On Rose · 1974-06-30 The Eleven · 1975-08-13 Ramble On Rose · 1976-06-03 Johnny B. Goode · 1976-06-09 Slipknot! · 1977-04-27 Slipknot! · 1977-05-08 Ramble On Rose · 1977-09-03 Ramble On Rose · 1978-01-11 Heaven Help the Fool · 1978-01-13 Heaven Help the Fool · 1978-04-11 Werewolves of London · 1978-11-24 Eyes of the World · 1979-11-01 If the Shoe Fits · 1979-12-28 If the Shoe Fits · 1980-10-14 Ramble On Rose · 1981-03-09 Nobody's Fault But Mine · 1982-04-06 Just Like Tom Thumbs Blues · 1982-10-10 West L.A. Fadeaway · 1983-10-06 Slipknot! · 1984-03-31 La Bamba · 1985-03-09 Lucy in the Sky with Diamonds · 1985-06-15 Lucy in the Sky with Diamonds · 1985-11-02 Shakin All Over · 1986-03-19 The Race Is On · 1986-03-19 Women Are Smarter · 1987-04-03 Queen Jane Approximately · 1987-04-03 Stuck Inside of Mobile with the Memphis Blues Again · 1987-04-03 When I Paint My Masterpiece · 1987-09-15 Wang Dang Doodle · 1988-04-02 Revolution · 1989-07-07 Revolution · 1989-10-08 Blow Away · 1989-10-08 Built to Last · 1989-10-09 Its All Over Now · 1989-10-16 Ramble On Rose · 1990-03-22 Slipknot! · 1990-03-24 Ramble On Rose · 1990-03-29 Hard to Handle · 1990-07-14 Ripple · 1991-03-17 Eyes of the World · 1991-06-22 Ramble On Rose · 1991-09-06 Slipknot! · 1993-03-24 Gentlemen Start Your Engines · 1993-03-27 Ramble On Rose · 1993-06-06 Rain · 1993-06-11 Gentlemen Start Your Engines · 1993-06-15 Eyes of the World · 1993-09-14 Wave to the Wind · 1993-09-22 Rain · 1994-10-01 Little Star · 1994-10-01 Wave to the Wind · 1994-12-10 Two Souls in Communion · 1994-12-16 La Bamba · 1994-12-16 Little Star · 1994-12-16 Two Souls in Communion · 1995-02-20 Unbroken Chain · 1995-03-24 Lady with a Fan · 1995-04-02 Blues for Allah · 1995-06-25 Man Smart Woman Smarter · 1995-06-30 Dancing in the Street · 1995-06-30 Lovelight · 1995-06-30 Stuck Inside of Mobile with the Memphis Blues Again · 1995-06-30 Turn on Your Love Light · 1995-07-01 Lazy Lightning · 1995-07-08 Minglewood Blues · 1995-07-08 New Minglewood Blues · 1995-07-08 Sunshine Daydream · 1995-07-09 Bird Song · 1995-07-09 Playing in the Band · 1995-07-09 Playing in the Band Reprise · 1995-07-09 Scarlet Begonias > Fire on the Mountain

## Runs

- 2026-11-24 08:20 · #153 Bird Song 1972-04-08 · not_on_tape · class N · HELD (night data) · probe track_missing, night N (JerryBase no, Relisten 0/4)
- 2026-11-24 08:20 · #154 Bird Song 1971-03-24 · not_on_tape · class N · HELD (night data) · probe song_not_on_night, night N (JerryBase no, Relisten 0/4)
- 2026-11-24 08:20 · #151 Viola Lee Blues 1970-02-14 · no_tape · class N · HELD (catalog date) · probe archive_unreachable (not re-run), night N (JerryBase no, Relisten 0/6)
- 2026-11-24 08:20 · #149 Ramble On Rose 1980-10-14 · not_on_tape · class N · HELD (a fan's guide) · probe song_not_on_night, night N (JerryBase no, Relisten 0/11)
- 2026-11-24 19:50 · #153 Bird Song 1972-04-08 · not_on_tape · class N · HELD (night data) · end-to-end test, run 45474220086 on Actions; nothing new, the held report and the `no_match` index row were already in place
- 2026-11-24 19:57 · #153 Bird Song 1972-04-08 · not_on_tape · class N · HELD (night data) · end-to-end test, run 45475377388; nothing new, the owed held alert sent and recorded on the ticket
- 2026-11-24 20:21 · #151 Viola Lee Blues 1970-02-14 · no_tape · class N · HELD (catalog date) · hourly sweep, run 45479656318; nothing new, the owed held alert sent and recorded on the ticket
- 2026-11-24 20:21 · #154 Bird Song 1971-03-24 · not_on_tape · class N · HELD (night data) · hourly sweep, run 45479661830; nothing new, the owed held alert sent and recorded on the ticket
- 2026-11-24 20:23 · #149 Ramble On Rose 1980-10-14 · not_on_tape · class N · HELD (a fan's guide) · hourly sweep, run 45479650449; nothing new, the owed held alert sent and recorded on the ticket
- 2026-11-24 22:25 · #154 Bird Song 1971-03-24 · not_on_tape · class N · HELD (repointed, waiting on Mark fixed) · slot 1 → 1971-02-19 Capitol Theatre; night played, tape_index playable, 3 verified plays
- 2026-11-24 22:25 · #153 Bird Song 1972-04-08 · not_on_tape · class N · HELD (repointed, waiting on Mark fixed) · slot 2 → 1972-08-27 Veneta; night played, 7/7 sources carry it, not yet indexed
- 2026-11-24 22:25 · #150 Bird Song (Play all) · none_in_setlist · class N · HELD (repointed, waiting on Mark fixed) · all 3 nights on catalog/owner dates; 1995-06-30 played, 8/8 sources, tape_index playable
- 2026-11-24 22:25 · #151 Viola Lee Blues 1970-02-14 · no_tape · class N · HELD (repointed, waiting on Mark fixed) · last_played and Songbook pos 5 → 1970-10-31 (7 tapes, indexed); Songbook pos 2 1967-03-17 → 1967-03-18 (no show on the 17th)
- 2026-11-24 22:25 · #149 Ramble On Rose 1980-10-14 · not_on_tape · class N · HELD (repointed, waiting on Mark fixed) · pos 5 → 1980-10-11 Warfield; night played, 8/11 sources, tape_index playable
