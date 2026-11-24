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

**Open risks:**

1. **Nothing is deployed.** This session's permissions refused `gh pr merge` on #156. Until the owner merges, the refresh stays broken and the lookout doesn't exist in production.
2. **No held alert was emailed.** The template and the function that send it ship with the lookout PR. The four reports are on the tickets.
3. **The page still offers "Play all 3 nights" on `/songbook/bird-song`,** where all three nights are marked "No tape of it from this night". That is what produces `none_in_setlist` reports (#150). Out of scope here.
4. **Charlie's cached prose on `/versions/viola-lee-blues` describes a performance that didn't happen:** it calls Feb 14, 1970 "part of the legendary Dick's Picks Vol. 4 show". It's fan-facing copy, so the desk won't touch it.
5. **A production-play harness is not built.** Step 7.2 (first sound on dead-set.org) needs a Playwright script that taps the real row. No ticket reached step 7, so it was not built against a real fix. The first S/M/C ticket will need it.

**Decisions that need the owner:**

1. **Merge #156**, then deploy `index-tapes` and apply `20261124010000`. Or allow the desk to merge and publish, which the brief says was decided on Nov 6. This machine's settings refused it.
2. **Create two credentials.**
   - `claude setup-token`, then add it as the repository secret `CLAUDE_CODE_OAUTH_TOKEN`.
   - A fine-grained GitHub token, Contents read and write on this repo only, as the Lovable Cloud secret `TAPE_DESK_GITHUB_TOKEN`.
   - In repository Settings → Actions → General, "Allow GitHub Actions to create and approve pull requests", so the workflow can open a fix PR.
3. **The four held tickets:** apply the repoints, or say no.
4. **The pattern fix for class N:** audit `songs.first_played/last_played` against JerryBase. 93 of the 114 no-tape nights are catalog first/last dates.
5. **Whether Charlie's picks are checked against a setlist source** before a guide saves.

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
