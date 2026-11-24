# The tape desk

When a fan taps a song that won't play, the app apologises, offers a tape we
know plays, and files a row in `playback_issues`. Signed-in fans are told
"we'll let you know as soon as it's fixed". The tape desk is what makes that
promise true without waiting for someone to notice the admin card.

There are two ways in.

- **The lookout (since 2026-11-24).** A report that the song is not on the tape
  (`not_on_tape`, `no_tape`) fires the `tape_desk_lookout` trigger. It posts to
  the `tape-desk` edge function, which starts the
  [Tape desk workflow](../.github/workflows/tape-desk.yml) on that one ticket.
  The workflow runs [`/tape-desk issue=<id>`](../.claude/commands/tape-desk.md):
  scan, cause, options, pick, fix, verify, publish, verify on production. Then
  it hands the ticket to the owner, whose **Mark fixed** is the only thing that
  emails the fans waiting. The decisions behind it are in
  [`tape-desk/DECISIONS.md`](tape-desk/DECISIONS.md), and the running log is
  [`tape-desk/LOG.md`](tape-desk/LOG.md).
- **The hourly sweep.** While the Claude desktop app is open, a scheduled task
  runs plain `/tape-desk`. It works whatever the lookout missed, publishes what
  the workflow couldn't (it has no Lovable), finishes tickets the owner has
  closed, and triages the other kinds (`wont_play`, `none_in_setlist`) the old
  way.

The desk stops where the owner's judgement starts. It never presses the admin
card's buttons. It never edits night data (setlists, guides, `songs`'
first/last played). It holds anything that would change fan-facing copy or give
the fan something other than the song and night they tapped.

## Roles

| Role | Who | Does | Never |
|---|---|---|---|
| **QA (triage)** | [`tape-triage`](../.claude/agents/tape-triage.md) subagent, read-only | Reproduces the report against the Archive with [`scripts/tape-desk/probe.ts`](../scripts/tape-desk/probe.ts), reads the fan's own error from PostHog, returns a verdict with evidence | Edits code, writes to the database, opens tickets |
| **Product** | the `/tape-desk` run | Maps the verdict to a disposition (table below), writes what the fan should hear after the fix, drafts the internal fix note | Promises a fix that has not shipped |
| **Engineering** | the `/tape-desk` run, in its own worktree | One PR per *cause*, verified the way CLAUDE.md requires, mutation-tested on a committed tree. For an in-scope ticket with a PASS gate: merges and publishes, as the owner's brief of 2026-11-24 asks (see DECISIONS.md on this machine refusing the first merge). Writes `tape_index` pins with provenance through the `tape-desk` function | Presses the admin card's buttons, edits night data, emails a fan, applies SQL by hand |
| **QA (gate)** | `qa-release` subagent | Gates the fix PR's head before it merges | Edits code |
| **Owner** | Jay | Presses Mark fixed / Verified / No tape exists, decides every held ticket, edits night data, owns the credentials the lookout runs on | |

Separation of duties holds as everywhere else in this repo: the build step never
grades its own work.

## The ticket

One public GitHub issue per `playback_issues` row, labelled `tape`. The repo is
public, so a ticket carries the song, the night, the track and the diagnosis,
and **never the reporter**: no user id, no PostHog distinct id, no name, no
email. Credit belongs on Build Notes, with the fan's yes, not in a ticket.

The first line of the body is a marker the desk uses to find it again:

```
<!-- tape-desk:issue=<playback_issues.id> -->
```

State lives in one label beside `tape`:

| Label | Meaning |
|---|---|
| `tape:fixing` | Engineering is under way. Another run leaves it alone for 6 hours. |
| `tape:owner` | Waiting on the owner: a PR to merge, a publish, a data fix, or a button on the admin card. |
| `tape:watching` | Nothing to build. Waiting for the Archive to recover, or for a play to verify it. |

In-scope tickets (`not_on_tape`, `no_tape`) end in one of three labels in place
of `tape:owner`:

| Label | Meaning |
|---|---|
| `needs-jay` | Held after step 4: class N, a fix that changes what the fan hears or reads, a repeat failure, or the kill switch off. The report names the reason. |
| `ready-to-close` | The exact song from the exact night plays on dead-set.org, and the owner was alerted. Waiting on Mark fixed. |
| `verified` | The owner pressed Mark fixed and the desk closed the ticket. |

The kill switch is the repository variable `TAPE_DESK_AUTOFIX` (`gh variable
set TAPE_DESK_AUTOFIX --body off`). Off, the desk still scans, classifies and
reports, and changes nothing.

The ticket closes when its row reaches `verified` or `wont_fix`. Never before:
the fan was promised a word when it is fixed, and the row is what sends it.

## Verdicts and dispositions

The verdict comes from [`classify.ts`](../scripts/tape-desk/classify.ts), whose
tests pin every branch. The probe sees the Archive **now**. An intermittent
failure that has since cleared reads as `plays_now`, so the fan's own error from
PostHog (`audio_error`, with its message, OS and browser) is read beside it.

| Verdict | What it means | Disposition |
|---|---|---|
| `mirror_failure` | archive.org routed the file to a mirror that fails some or all byte ranges, and the item's own servers serve it | **Code**: the player fails over to the item's own servers. This is a class fix: link the open failover PR rather than opening another. |
| `plays_now` | Every host serves it today | Read PostHog. A `code 4` or network error at report time is a delivery failure that has cleared, so treat it as `mirror_failure`'s class. A `code 3` (decode) or anything device-specific goes to `needs_human`. |
| `tape_unservable` | No server serves the file | Archive-side. Re-probe once a day. After 72 hours, the owner decides between waiting and No tape exists. Build nothing. |
| `track_missing` | The url points at a file or item the Archive does not have | **Engineering** finds where the url came from. A `notable_versions` row gets a repoint proposed as SQL in the ticket. A resolver pick gets a code fix. |
| `wrong_track` | The player's resolver now picks a different file from the one the fan got | Usually fixed by a resolver change since the report's build. Probe the new file. If it plays, ask the owner to Mark fixed. |
| `song_not_on_tape` | The resolver says the song is not on that recording | **Engineering**: either the catalog points at the wrong recording (SQL repoint) or the matcher misses a title variant (code). |
| `song_on_other_tape` | Not on the named recording, but another tape of the night has it | **Engineering**: the by-night heal should have found it. Find out why (code), or repoint the row (SQL). |
| `resolver_found_tape` | The resolver finds it today | It was transient at report time, or fixed since. Probe it. If it plays, ask the owner to Mark fixed. |
| `no_tape_of_night` | The Archive lists no Grateful Dead recording of that date | Owner: No tape exists. Product: check whether the night came from Cosmic Charlie or the catalog with a wrong date. |
| `song_not_on_night` | Recordings of the date exist, and none carries the song | The band likely did not play it that night (a wrong date in the catalog or a pick), or the matcher misses a title variant. Engineering checks the setlist and the matcher. |
| `tape_dark` | The Archive has restricted the item | **Engineering**: propose a SQL repoint to another recording of the night. |
| `archive_unreachable` | The Archive did not answer | No verdict yet. Retry next run. Do not open a ticket on this alone. |
| `needs_human` | The evidence does not decide it | Owner. |

## What the fan was promised, and when to keep it

The oops card told a signed-in fan "we'll let you know as soon as it's fixed".
**Mark fixed** after the fix is live on the surface the fan used, and not before:

- a web publish for a web report;
- an iOS build for a report from the native app.

PostHog's `$lib` and `$host` on the fan's `audio_error` say which surface it was. A
fixed row then becomes `verified` on the next signed-in 20-second play of that
night, or by hand, and that is what emails the fans who asked. Marking fixed early
sends a promise the app cannot keep.

## Engineering rules for the desk

- **One PR per cause, not per report.** Before building, search open PRs labelled
  `tape` for the cause marker `<!-- tape-desk:cause=<verdict> -->`. If one exists,
  link it from the ticket and stop.
- **One build at a time.** If another ticket is `tape:fixing` and younger than 6
  hours, triage and ticket only. An older one with no PR is reported to the owner
  as stalled.
- **Own worktree, own branch** (`tape/<verdict>-<short id>`), cut from `origin/main`.
  Never work in the shared checkout. Confirm the branch before pushing.
- **CLAUDE.md applies in full**:
  - run `npx tsc --noEmit -p tsconfig.app.json`, `npx vitest run --exclude
    'src/test/anonDraftRls.test.ts'` (with `$?` on its own line, and grep `Errors`)
    and `npx vite build`;
  - put a rejection test beside every null-result test;
  - mutation-test on a committed tree.
- **The PR says `Refs #<ticket>`, not `Fixes`.** Merging ships nothing. The ticket
  closes when the row is verified.
- **Then gate it.** Run `qa-release` on the PR head and post its verdict on the
  ticket. A BLOCK goes back to engineering in the next run, no differently from any
  other gate.

## Stewardship

The probe makes about 30 small requests per report, all for one file. It runs
once per report at triage, and again only for `tape_unservable` (daily) or
`archive_unreachable` (next run). The desk exists to send fans *to* the Archive.
It must never be the thing that hammers it.

## Running it by hand

```sh
npx vite-node --config vitest.config.ts scripts/tape-desk/probe.ts -- \
  --song "Jack Straw" --date 1971-10-19 \
  --track https://archive.org/download/gd71-10-19.orefm.clugston.3301.sbeok.shnf/gd71-10-19d1t09.mp3
```

Or run `/tape-desk` in a session that has the Lovable, PostHog and GitHub tools.

## Where it runs

The scheduled task `tape-desk-hourly` lives in the Claude desktop app, not in
this repo. It runs while the app is open, catches up when the app next opens,
and works from its own long-lived worktree at `C:\Dev\dead-set-tape-desk`. That
worktree is reset to `origin/main` at the start of every run and has its own
`node_modules`.

The lookout runs in GitHub Actions (`.github/workflows/tape-desk.yml`), on the
owner's Claude subscription, not a billed API key. It needs two credentials only
the owner can create:

- `CLAUDE_CODE_OAUTH_TOKEN`: a repository secret, from `claude setup-token`.
- `TAPE_DESK_GITHUB_TOKEN`: a Lovable Cloud secret, a fine-grained token with
  Contents read and write on this repository only, so the `tape-desk` function
  can send `repository_dispatch`.

Without either one nothing is lost: `tape_desk_dispatches` records why a ticket
was not sent, and the hourly sweep works it. The workflow reaches the database
through the `tape-desk` function with its own GitHub OIDC token, so no database
key is stored in GitHub.
