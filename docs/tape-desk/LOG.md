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
3. **No held alert was emailed for this run's four tickets.** The reports are on the tickets, and the owner has them in the session. A held ticket is not re-dispatched, so nothing would have sent them: since #163 a run on a held ticket sends the alert if no comment records one. #153 got its alert at 19:57. #154, #151 and #149 still owe one, sent the next time each is dispatched.
4. **`/songbook/bird-song` still offers "Play all 3 nights"** with all three marked "No tape of it from this night" (#150, out of scope).
5. **Charlie's cached prose on `/versions/viola-lee-blues` describes a performance that didn't happen.** It's fan-facing copy, so the desk won't touch it.
6. **The production-play harness for step 7.2 is not built.** No ticket reached it.
7. ~~The hourly task's own prompt still says never merge.~~ Applied on 2026-11-24 after the owner's yes; the text is in [`hourly-task-prompt.md`](hourly-task-prompt.md).

**Decisions that need the owner:**

1. ~~Create two credentials.~~ Done 2026-11-24, with the Actions setting.
   - `claude setup-token`, then add it as the repository secret `CLAUDE_CODE_OAUTH_TOKEN`.
   - A fine-grained GitHub token, Contents read and write on this repo only, as the Lovable Cloud secret `TAPE_DESK_GITHUB_TOKEN`.
   - In repository Settings → Actions → General, enable "Allow GitHub Actions to create and approve pull requests".
2. **Apply, or say no to, the four held tickets' repoints.**
3. **The class-N pattern fix:** audit `songs.first_played/last_played` against JerryBase. 93 of the 114 no-tape nights are catalog first/last dates.
4. **Whether Charlie's picks are checked against a setlist source** before a guide saves.
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
