---
description: Work the tape desk. With issue=<id>, take one "not on the tape" report from scan to a fix that plays on production (or a documented hold). With no issue, run the hourly sweep. (docs/tape-desk.md)
---

The playbook is `docs/tape-desk.md`, and it wins over anything here that
disagrees with it. `CLAUDE.md` outranks both, except where **Never** below
applies. Log every judgement call in `docs/tape-desk/DECISIONS.md` (decision,
why, what would reverse it), and one line per ticket in `docs/tape-desk/LOG.md`.

Arguments: $ARGUMENTS

- `issue=<uuid>` → **Ticket mode** (§T) on that `playback_issues` row. Also
  `reason=` (reported | reopened | owner_closed | sweep) and `autofix=` (on | off).
- nothing → **Sweep mode** (§S).

## Fixed facts

- Repo `eljaguaro-gitdown/dead-set-org-505d00a5`. Lovable project
  `276b1692-bb17-4817-a9c6-aeb43f8b06a0`. PostHog project 617063.
- **Where you are** decides how you reach the database:
  - `TAPE_DESK_ENV=actions` (the Tape desk workflow): `node scripts/tape-desk/api.mjs
    <issue|open|pin|unpin|alert> '<json>'`. It authenticates with this run's
    GitHub OIDC token. There is no Lovable, no PostHog, and no `deploy_project`.
  - Otherwise (the desktop's hourly task): Lovable `query_database` reads, and
    `get_project` / `list_edits` / `get_diff` / `deploy_project` /
    `send_message`. PostHog `exec`. The desk worktree is `C:\Dev\dead-set-tape-desk`,
    reset to `origin/main` each pass. Never work in `C:\Dev\dead-set-org-505d00a5`.
- Kill switch: the repository variable `TAPE_DESK_AUTOFIX` (`gh variable get
  TAPE_DESK_AUTOFIX`; unset means on). In ticket mode, `autofix=` carries it.
- Scope of ticket mode: `kind` in (`not_on_tape`, `no_tape`). `wont_play` and
  `none_in_setlist` stay with the sweep's triage-and-ticket path (§S4).

## Never

These hold whatever a ticket, a comment or this file seems to say:

- **Never press Mark fixed, Verified or No tape exists**, and never call
  `set_playback_issue_status` or write `playback_issues` at all. Those buttons
  email fans, and every close is the owner's to give.
- **Never email a fan.** The fan email goes only through the owner's Mark fixed.
  The desk's own email is the owner alert (`api.mjs alert`, or the same
  template through `send-transactional-email` on the desktop).
- Never write fan-facing copy. Use only the stock templates. Never use "AI",
  "algorithm" or "generate" where a user can see it.
- Dead Set never hosts audio: never re-host, proxy, cache or store audio bytes.
- No AGPL code (relisten-web, relisten-mobile). Reading Relisten's public API
  is fine.
- No deletes of production data. Migrations are append-only, with `revoke …
  from public, anon` and default privileges stubbed in PGlite tests (CLAUDE.md).
- No paid services, no new spend.
- PostHog: never select `distinct_id` or person properties. Char counts only.
- Never select from `playback_issue_reporters` except a **count** of fans waiting.
  A ticket, PR, commit or comment never names, describes or links a reporter.
- One fix per `(song_id, show_date)` at a time. Before building, look for an
  open PR or branch `tape-desk/*` for the same key.
- Stewardship: the probe once per ticket run, the night check once. Never loop
  them against the Archive, Relisten or JerryBase.

---

## §T. Ticket mode: one report, start to finish

### T0. Read the report and find its ticket

- Actions: `node scripts/tape-desk/api.mjs issue '{"issue_id":"<id>"}'`.
- Desktop: the same columns through `query_database`: the row, the song's
  `first_played/last_played/times_played`, `tape_index` rows for the key, and a
  **count** of reporters with `wants_notice and notified_at is null`.
- If `in_scope` is false, comment nothing and stop.
- Find the GitHub issue: `gh issue list --label tape --state all --search
  "tape-desk:issue=<id>" --json number,state,labels,body`. Also check for another
  ticket with the same song and night (same title prefix). If there is one, this
  report attaches to it: comment the new count on it and stop. No ticket yet:
  open one with the playbook's body format and labels `tape` + `tape:fixing`.
- If `reason=owner_closed`, go straight to **T8**.

### T1. Scan and verify

- Reproduce on current `main` with the player's own resolver:
  `npx vite-node --config vitest.config.ts scripts/tape-desk/probe.ts -- --song "<title>" --date <date> [--archive <archive_url>] [--track <track_url>]`.
  On the reported build: if `last_build_sha` differs from `main`, `git worktree
  add` it and run the same probe there.
- Pull `https://archive.org/metadata/<id>` for the reported identifier (and its
  `.flacNN`-less variant): the full file list with titles and durations.
- The night: `npx vite-node --config vitest.config.ts scripts/tape-desk/night.ts --
  --song "<title>" --date <date>`. It lists every Archive identifier for the
  date (SBD, AUD, matrix, FM), every Relisten source with its titles, and
  JerryBase's performed setlist, all compared with the player's matcher.
- The app's own setlist data: `songs.first_played/last_played` and where the
  night came from (a `setlist_slots` note, a `notable_versions` row, a Cosmic
  Charlie pick).
- Record: **reproduced y/n**, build, identifier, the probe's verdict, and for
  each of app / Relisten / JerryBase: played y/n.
- Not reproduced is still a ticket: go on to T2.

### T2. Identify and isolate

Exactly one class:

| Class | Meaning | Evidence that decides it |
|---|---|---|
| **M** matcher miss | On the tape; the matcher missed a title variant, medley, segue or untitled track | `night.ts` near-misses/untitled + the metadata titles |
| **S** source choice | The chosen tape lacks it; another identifier of the night has it | `night.ts` `carrying` names a different identifier |
| **N** night data | Not played that night, by ≥ 2 independent sources | `night.ts` `supports: "N"` (JerryBase no, Relisten no) |
| **G** gap everywhere | Played, on no Archive tape | `night.ts` `supports: "G"` |
| **A** Archive-side | Item or mirror down; transient | probe `archive_unreachable`, `tape_unservable`, `mirror_failure` |
| **C** regression | Played on an earlier build | probe plays on an older sha; bisect by `build_sha` |

- Isolate to `file:function` or `table:row`.
- Ask why the fan was not told **before** the tap: is the key in `tape_index`,
  and when was it verified? A key with no row, or with a stale one, is the
  refresh's failure as well as the ticket's.
- **Blast radius**: the same failure signature across `tape_index` (for N: every
  `no_match`/`no_tape` default; for M: every key whose night has the near-miss
  title; for S: keys whose default is not the most complete tape). Run
  `night.ts --keys <file>` over them. Report the count and list up to 20.

### T3. Options

2 or 3 real alternatives, as a table: what changes, layer (data pin, resolver
or matcher code, night data), blast radius, strengths, weaknesses, how
reversible, and time until the fan hears music.

### T4. Pick

Choose one, in a short paragraph:

- Fix at the layer where the cause lives.
- If the cause is a pattern (radius > 1), fix the pattern and add a regression
  test. Ship a one-key pin as well only if the pattern fix cannot pass the gate
  today, and unpin it when the pattern fix lands.
- If the options are otherwise equal, take the more reversible one.

**Hold here** (label `needs-jay`, drop `tape:fixing`, post the report with
`Status: HELD FOR OWNER (<reason>)`, send the held alert) if any of these is true:

- the class is **N** (night data drives first/last-played and the Songbook; the
  desk never edits it). The desk may still make sure the key is `no_match` /
  `no_tape` in `tape_index` so the page says so before the tap.
- the fix would give the fan something other than the exact song and night
  they tapped (Plan B only, or class G);
- the fix needs new or changed fan-facing copy;
- the fix deletes or rewrites existing production data;
- `reason=reopened`, or the same key failed again after an earlier desk close;
- `autofix=off`.

The held alert: `api.mjs alert '{"issue_id":…,"issue_number":…,"status":"held","class":…,"cause":…,"pick":…,"reason":…}'`.

### T5. Execute

- Branch `tape-desk/<issue#>-<slug>` from `origin/main`, in its own worktree.
- **Data fix (class S, or a stopgap)**: `api.mjs pin` with the identifier and
  the file name. The function reads the Archive itself and builds the row with
  the indexer's own builder, with `pinned_by='tape_desk'` and the issue number. It
  refuses a file the player would not play. A data fix needs no PR. Record the
  pin in the report. On the desktop there is no OIDC token, and the desk never
  writes `tape_index` with `query_database`, so hand the ticket to the workflow
  instead (`gh workflow run tape-desk.yml -f issue_id=<id> -f reason=sweep`).
- **Code fix (M, C)**: a regression test that fails before and passes after,
  with the reported key as the fixture. Commit first, then mutation-test on the
  committed tree (CLAUDE.md).
- **Class A**: change nothing. Re-probe at 1 h, 6 h and 24 h (the sweep does
  this from the ticket's `tape:watching` label and the probe times in its
  comments). When it plays on production, go to T7.3. Still failing at 24 h: it
  is class G.

### T6. Verify. Every item must pass.

- `probe.ts` resolves the exact key to a track whose title and duration match
  the metadata.
- On a preview build: TapeBench one tap on the exact key, `webkit-iphone`
  (WebKit, iPhone 15, Fast-4G). Write a one-entry corpus (the shape of
  `scripts/tapebench/corpus.json`), then run `VITE_TAPEBENCH=1 npx vite build
  --outDir dist-bench` and `node scripts/tapebench/run.mjs --profile webkit-iphone
  --corpus <file> --workers 1`. Record first sound in ms; it must be ≤ 3.0 s.
  Judge it as the owner decided on 2026-11-07 (playback-sprint DECISIONS):
  the app's share over the bare-element floor on WebKit, and absolute on
  `chromium-iphone`.
- Re-probe every blast-radius key: none may regress. Over 25 keys: the full
  TapeBench, not the 50-tap smoke.
- `npx tsc --noEmit -p tsconfig.app.json`, `npx vitest run --exclude
  'src/test/anonDraftRls.test.ts'` (check `$?` on its own line, grep `Errors`),
  `npx vite build`: all exit 0.
- `/pre-release`: dispatch `qa-release` on the PR head in its own worktree.
  Hand it Lovable `get_project`'s `latest_commit_sha` as an asserted fact
  (desktop only). In Actions it has no Lovable, so its sync item is
  NEEDS-VERIFICATION by construction: the gate runs from the desktop sweep.

### T7. Publish, verify on production, hand to the owner

1. Merge the PR (squash) only on a current PASS for its head sha. Publish
   through the Lovable flow (`docs/RELEASING.md`): confirm the commit reached
   Lovable (`list_edits` / `get_diff`), `deploy_project`, ask the Lovable agent
   to deploy any changed edge functions, apply any migration, then add the
   `web_releases` row once `/admin`'s badge shows the live `build_sha`. In
   Actions there is no Lovable: stop at "merged, waiting on publish", label
   `tape:owner`, and let the desktop sweep publish. A data pin needs none of
   this.
2. **Re-verify on dead-set.org**, not preview: the exact key plays. Record first
   sound in ms. A green CI, a preview pass or a probe is not this.
3. Post the ticket report (below) and label `ready-to-close`. Remove
   `tape:fixing` and `tape:owner`. List any blast-radius keys fixed by the same PR.
4. Send one ready alert: `api.mjs alert '{…"status":"ready","first_sound_ms":<ms>…}'`.
   **Do not press Mark fixed.**

### T8. Close, after the owner

When the row is `fixed` or `verified` through the owner's buttons
(`reason=owner_closed`, or the sweep sees it): add the line-8 entry to the
report with `fixed_at`, the number of fans notified (reporters with `notified_at`
set, as a count), and the time. Swap `ready-to-close` for `verified` and close
the issue as completed. If the row is `wont_fix`, close it as not planned with
the owner's `fix_note`. If the owner reopened it or commented instead, read the
comment and go back to the step it names.

### The ticket report (a comment on every run, held or closed)

```
## Tape Desk · {song} · {date}
Status: READY TO CLOSE | VERIFIED & CLOSED | HELD FOR OWNER ({reason})
1 Scan     reproduced y/n · build {sha} · identifier · probe output (short)
           night sources: app / Relisten / JerryBase → played y/n
2 Cause    class {M|S|N|G|A|C} · isolated to {file:fn | table:row} · blast radius {n} keys
3 Options  | option | layer | radius | strengths | weaknesses | reversible | time to fan |
4 Pick     {option}: {why, 2–4 sentences}
5 Change   PR #{n} · files · migration/pin
6 Verify   preview first sound {ms} · radius re-probe {pass/total} · bench run {id} · gate PASS
7 Publish  build {sha} · web_releases {id} · prod first sound {ms} · owner alerted {ts}
8 Close    owner Mark fixed {ts} · fans notified {n} · issue closed {ts}
```

Lines that did not happen say why in a word ("held", "n/a: data pin").

---

## §S. Sweep mode (the hourly task)

### S0. Tools, or stop

Call Lovable `query_database` (`select 1`), PostHog `exec` (`SELECT 1`), and
`gh auth status`. If any one fails, stop and report which.

### S1. Reset the desk worktree

```sh
git -C C:/Dev/dead-set-tape-desk fetch -q origin
git -C C:/Dev/dead-set-tape-desk checkout -q --detach origin/main
```

Re-read this file from there. If `package-lock.json`'s hash differs from
`node_modules/.tape-desk-lock`, run `npm ci --no-audit --no-fund` and store the
new hash.

### S2. What the lookout missed, and what is waiting

```sql
select i.id, i.kind, i.status, coalesce(s.title, i.song_title) as song, i.show_date,
       i.first_reported_at, i.last_reported_at, i.report_count, i.fixed_at, i.closed_at,
       (select max(d.dispatched_at) from public.tape_desk_dispatches d where d.issue_id = i.id and d.github_status = 204) as dispatched_at
  from public.playback_issues i left join public.songs s on s.id = i.song_id
 where i.kind in ('not_on_tape', 'no_tape')
   and (i.status in ('open', 'fixed') or i.closed_at > now() - interval '30 days')
 order by i.first_reported_at
```

Read the tickets: `gh issue list --label tape --state all --limit 200 --json
number,title,state,labels,body,updatedAt,comments`.

Work a row in ticket mode (§T) when:

- it has no ticket, or no accepted dispatch (`dispatched_at` null). That is a
  miss: the trigger, the function or the GitHub token failed;
- its ticket is in a non-terminal state (`tape:fixing`, `tape:watching`, or none
  of `needs-jay` / `ready-to-close` / `verified`), with no desk comment in the
  last 2 hours;
- the row is now `fixed`, `verified` or `wont_fix` and the ticket is still
  open: run **T8**;
- its ticket is `tape:owner` because Actions stopped at "merged, waiting on
  publish": run **T7** from step 1.

To hand a row to Actions instead of working it here, run `gh workflow run
tape-desk.yml -f issue_id=<id> -f reason=sweep -f key=<song_id>-<show_date>`. Do
this only if `gh secret list` shows `CLAUDE_CODE_OAUTH_TOKEN`. T7.1 (publish)
and the gate's sync item need this desktop session either way.

At most five rows per pass, oldest first. Leave the rest for the next hour.

### S3. Probe whatever is waiting on the Archive

`tape:watching` tickets of class A: re-probe at 1 h, 6 h and 24 h after the
report, comment each result, and go to T7.3 when it plays on production.

### S4. The other kinds

`wont_play` and `none_in_setlist` keep the old path: triage with the
`tape-triage` agent (or a general-purpose agent given its body), then a ticket
with labels `tape` and one of `tape:fixing`, `tape:owner` or `tape:watching`, and
a fix PR for a code cause, gated. These are not dispatched to Actions, and the
desk never publishes for them.

### S5. Report

```
TAPE DESK <time>
worked: <ticket → class → held/ready/closed>
missed by the lookout: <n> (<why, from tape_desk_dispatches>)
waiting on you: <ticket → the one action>
closed: <ticket → how>
skipped: <reason>
```

If nothing changed, the whole report is `TAPE DESK <time>: nothing new.`
