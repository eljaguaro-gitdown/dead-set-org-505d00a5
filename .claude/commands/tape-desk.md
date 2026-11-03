---
description: Work the tape desk — triage new playback reports, ticket them, fix the code causes, gate the fixes (docs/tape-desk.md)
---

Run one pass of the tape desk. The playbook is `docs/tape-desk.md`, and it wins
over anything here that disagrees with it. Read it first, from the desk worktree
below once step 1 has reset it.

**Fixed facts**

- Repo: `eljaguaro-gitdown/dead-set-org-505d00a5`. The main checkout is at
  `C:\Dev\dead-set-org-505d00a5`. Never work in it, and never change its branch.
- Desk worktree: `C:\Dev\dead-set-tape-desk` (detached, has its own `node_modules`).
- Lovable project id: `276b1692-bb17-4817-a9c6-aeb43f8b06a0`. Read the database with
  its `query_database` tool. **Read-only: this pass never writes to the database.**
- PostHog: project 617063, through its `exec` tool (`call execute-sql`).
- GitHub: the `gh` CLI.

Extra context for this pass, if any: $ARGUMENTS

## 0. Confirm the tools, or stop

Call each once: Lovable `query_database` with `select 1`, PostHog `exec`
(`call execute-sql` with `SELECT 1`), and `gh auth status`. If any one is missing or
fails, stop. Report which tool, and do nothing else. A pass that cannot read the
reports must not open tickets, and a pass that cannot read PostHog must not issue
verdicts.

## 1. Reset the desk worktree

```sh
git -C C:/Dev/dead-set-tape-desk fetch -q origin
git -C C:/Dev/dead-set-tape-desk checkout -q --detach origin/main
```

If `package-lock.json` differs from the hash stored in
`C:/Dev/dead-set-tape-desk/node_modules/.tape-desk-lock`, or that file is missing,
run `npm ci --no-audit --no-fund` there and write the new hash. If `npm ci` fails,
report it verbatim and stop.

## 2. Read the reports

```sql
select i.id, i.kind, i.status, s.title as song_title, i.show_date, i.archive_url, i.track_url,
       i.first_reported_at, i.last_reported_at, i.report_count, i.last_build_sha,
       i.fixed_at, i.verified_at, i.closed_at, i.verified_via
  from public.playback_issues i
  left join public.songs s on s.id = i.song_id
 where i.status in ('open', 'fixed') or i.closed_at > now() - interval '30 days'
 order by i.first_reported_at
```

Never select from `playback_issue_reporters`. Who reported is not the desk's business.

## 3. Read the tickets

```sh
gh issue list --repo eljaguaro-gitdown/dead-set-org-505d00a5 --label tape --state all \
  --limit 200 --json number,title,state,labels,body,updatedAt
```

Match tickets to rows by the body marker `<!-- tape-desk:issue=<id> -->`. A row
with an `open` or `fixed` status and no ticket is **new**.

## 4. Each new report

Work through new reports oldest first, at most five per pass. Leave the rest for
the next hour, and say so in the pass report.

**a. The fan's own error.** Query PostHog for the minutes around the report.
Never select `distinct_id` or any person property:

```sql
SELECT timestamp, event, properties.message AS message, properties.track_url AS track_url,
       properties.$os AS os, properties.$browser AS browser, properties.$lib AS lib,
       properties.$host AS host, properties.$pathname AS path, properties.build_sha AS sha
  FROM events
 WHERE event = 'audio_error'
   AND timestamp > toDateTime('<first_reported_at>') - INTERVAL 15 MINUTE
   AND timestamp < toDateTime('<first_reported_at>') + INTERVAL 5 MINUTE
 ORDER BY timestamp LIMIT 20
```

When the row has a `track_url`, keep only events for that url. Otherwise keep the
ones nearest `first_reported_at`.

**b. Triage (QA).** Dispatch the `tape-triage` subagent with the row, the PostHog
rows, and the worktree path `C:/Dev/dead-set-tape-desk`. If no `tape-triage` agent
type is available in this session, dispatch a general-purpose agent instead. Its
prompt is the body of `C:/Dev/dead-set-tape-desk/.claude/agents/tape-triage.md`
(below the front matter), followed by the facts. Tell it what to try, never what
tools it has. Keep its `TRIAGE` block. If it reports `archive_unreachable`, open no
ticket for this report. It will be picked up next hour.

**c. Product.** From `docs/tape-desk.md`'s table, take the disposition for the
triage `reading`, then write:

- **What the fan hears after the fix**: one plain sentence, e.g. "Tapping Jack
  Straw on /versions/jack-straw plays the 10/19/71 Northrop tape, even when the
  Archive routes to a failing mirror."
- **When to Mark fixed**: the surface (web publish or iOS build) the fix must be
  live on first, taken from triage's `surface`.
- **Draft fix note**: the internal line the owner pastes when pressing Mark fixed.
  It is kept with the issue and never emailed.
- **Owner actions**: a checklist in the order they happen.

**d. Ticket.** Open the issue with the body below, with labels `tape` plus one state
label: `tape:fixing` if step (e) will build now, `tape:watching` if nothing needs
building, or `tape:owner` otherwise. Create a missing label with `gh label create`.

```
<!-- tape-desk:issue=<id> -->
**<song_title> · <show_date or "no night named">** · <kind label> · first reported <date> · <report_count> report(s) · build <last_build_sha short>

Track: <track_url or "none found"> · Recording: <archive_url or "none named">

## QA: what happened
<the TRIAGE block's evidence and why, plus the PostHog message, OS and browser; never who>
Probe run on <worktree sha> at <time>. Verdict `<probe_verdict>`, read as `<reading>`.

## Product: what the fan gets
- Disposition: <from the table>
- After the fix: <the sentence>
- Mark fixed when: <surface> is live with the fix
- Draft fix note: <line>

## Engineering
<the PR link, the class-fix PR it joins, "nothing to build", or a SQL proposal in a sql block, marked NOT APPLIED>

## Gate
<qa-release verdict on <sha>, or "not yet">

## Owner
- [ ] <actions>
```

The kind labels are the admin card's: `not_on_tape` "song not on the tape",
`no_tape` "no tape found", `wont_play` "tape won't spin", `none_in_setlist`
"nothing in the setlist played".

**e. Engineering (code dispositions only).** Follow docs/tape-desk.md's engineering
rules exactly:

1. **Class fix.** Search open PRs for `<!-- tape-desk:cause=<reading> -->`. If one
   exists, add "Joins #<pr>" to the ticket, set `tape:owner`, and stop here.
2. **One build at a time.** If any ticket is `tape:fixing` and its label is
   younger than 6 hours, triage and ticket only.
3. **Build.** Run `git -C C:/Dev/dead-set-org-505d00a5 worktree add -b
   tape/<reading>-<id8> C:/Dev/dead-set-tape-<id8> origin/main`, then `npm ci` there.
   Read CLAUDE.md in full before writing code, fix the cause, and verify exactly as
   it requires.
4. **Commit, mutate, push.** Commit first, then mutation-test. Confirm
   `git branch --show-current`, then push.
5. **PR.** Open it with `Refs #<ticket>`, the cause marker, the mutation table and
   the label `tape`. Never write `Fixes`.
6. **Gate.** Dispatch `qa-release` (or a general-purpose agent with the body of
   `.claude/agents/qa-release.md`) on the PR head. Hand it, as asserted facts, what
   this pass read itself: the PR head sha and Lovable `get_project`'s
   `latest_commit_sha`. Post its verdict on the ticket. On PASS, set `tape:owner`.
   On BLOCK, leave `tape:fixing` and note what blocked, so the next pass picks it up.

Data fixes go into the ticket as SQL, marked NOT APPLIED. The owner applies them.

## 5. Keep existing tickets honest

For each ticket matched in step 3:

- **Row is `verified` or `wont_fix`**: comment "Verified <how>, <when>" (or "No tape
  exists"), then close the ticket.
- **Row was reported again** (`last_reported_at` is later than the ticket's last
  desk comment): comment the new count. A report on a `fixed` row reopens it, so
  say plainly that the fix did not hold.
- **A linked PR merged since the last pass**: comment that it is merged and is
  waiting on the publish or build named in "Mark fixed when". Set `tape:owner`.
- **Verdict is `tape_unservable` and the last probe is over 24h old**: re-probe once,
  and comment the result.
- **`tape:fixing` for over 6 hours with no PR**: comment that it has stalled, and set
  `tape:owner`.

Comment only when something changed. A ticket that gets "no change" every hour is
noise that buries the change that matters.

## 6. Report

End with a short report for the owner, nothing else:

```
TAPE DESK <time>
new: <n> (<song · night → reading → ticket #>)
building: <ticket → branch/PR, gate verdict>
waiting on you: <ticket → the one action>
closed: <ticket → how>
skipped: <reason, e.g. "3 more new reports, next pass">
```

If nothing changed, the whole report is `TAPE DESK <time>: nothing new.`

## Never

- Merge, publish, `deploy_project`, or trigger an iOS build.
- Write to the database, including through RPCs: no status changes, no Mark
  fixed. Those buttons email fans, and they are the owner's.
- Name, describe or link a reporter in a ticket, PR, commit or report.
- Work in `C:\Dev\dead-set-org-505d00a5` itself, or switch its branch.
- Probe a report more than the playbook allows.
