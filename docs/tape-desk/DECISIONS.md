# Tape desk: decisions log

Each entry says what was decided, why, and what would reverse it. Newest at the
bottom. The playbook is [`../tape-desk.md`](../tape-desk.md); the runbook is
[`/tape-desk`](../../.claude/commands/tape-desk.md).

## 2026-11-24: The desk never stopped ticketing. It stopped closing.

**Finding.** The brief said `/tape-desk` "was not ticketing" and only #137 had
ever been filed. That was true on 2026-11-06. Since then the hourly task
(`tape-desk-hourly`, last run 07:18 UTC today) has ticketed every report:
#139–#154, one per `playback_issues` row, each within an hour or so of the
report (the 2026-11-10 one took 7 h, overnight with the app closed). Nothing
needs fixing in the ticketing.

What stalled is the close. Every open ticket in scope ended in `tape:owner` with
"check a setlist source, then apply this SQL". The desk could not check a
setlist itself, and it is forbidden to write data, so four tickets waited a
combined 30 days for one lookup each.

**Decision.** Build the setlist check (`scripts/tape-desk/night.ts`, two sources
compared with the player's matcher), so a ticket ends in a class and a decision
instead of a chore.

**Reverse it:** a ticket the night check cannot settle, which goes to the
owner as before.

## 2026-11-24: Scope is not_on_tape and no_tape, not no_tape alone

**Decision.** The brief defines the desk's trigger as "the song is not on the
tape we found (`kind = 'no_tape'`)". In the schema, that sentence is
`not_on_tape`'s label (`playback-issue-alert.tsx`); `no_tape` is "no tape of the
night turned up". The seed case (Bird Song 1972-04-08) is `not_on_tape`, and the
November Slipknot! pattern the brief cites is `no_tape`. Both are "the music
is not where we looked", and they share every step of the runbook. So the
lookout dispatches both (`IN_SCOPE_KINDS` in `supabase/functions/tape-desk/logic.ts`).
`wont_play` and `none_in_setlist` stay with the hourly triage.

**Reverse it:** the owner meant `no_tape` alone. Remove `not_on_tape` from
`IN_SCOPE_KINDS` and from the trigger's `kind in (...)`.

**Extending to `wont_play` would take:**

- PostHog in the workflow. A personal API key is a new secret, and read-only
  access to `audio_error` / `play_failed` is what triage reads.
- The probe's delivery leg, run in CI. Mirror failures are intermittent, so a
  re-probe schedule like class A's.
- Fixes are almost always player code (failover, gesture, stall), so every one
  needs the full TapeBench and a web publish.
- Not built.

## 2026-11-24: Relisten is read through v2, not v3

The brief names `api.relisten.net/api/v3/`. On 2026-11-24, `/api/v3/artists/
grateful-dead/shows/<date>` and `/years/<y>` return 404, while v2 answers both.
`night.ts` reads v2. Only Relisten's public JSON is read, never its code
(AGPL).

**Reverse it:** v3 gains those routes, or v2 goes away.

## 2026-11-24: The second setlist source is JerryBase

**Decision.**

- setlist.fm answered 202 with an empty body to an unauthenticated request; its API needs a key.
- JerryBase serves each event as a public page with the performed setlist.
- Its title names the act, so a Jerry Garcia Band show on the same date is skipped.

Checked against controls:

| Night | JerryBase | Relisten | Result |
|---|---|---|---|
| Bird Song 1971-02-19 | played | on 4 tapes | agree |
| Bird Song 1995-06-30 | played | on 8 tapes | agree |

**Reverse it:** JerryBase blocks automated reads, or disagrees with a
first-hand source on a night that matters. Then swap in setlist.fm with a free
key, which is a secret, not a spend.

## 2026-11-24: The hourly tape-index refresh has never worked (#155)

**Finding.** Isolating the seed case meant asking why the fan wasn't told
"no tape of it from this night" before the tap. The night had no index row
until the fan's own tap wrote one, 17 s before the report.

The `tape-index-refresh` cron has been refused with 401 on every run since it
deployed. It proves itself with a hash of the vault's service key, and
`index-tapes` compared that with a hash of its own key. Those are different
service-role keys (#102).

`tape_index` holds 700 rows from the 2026-11-07 seed and 6 since, all from
fans' taps. 500+ keys are waiting. This is the failure CLAUDE.md banked after
#113: an auth gate is verified only by running every real caller through it
after the deploy.

**Decision.** Fix it in its own PR (#156), separate from the lookout: it is one
cause, it matters to every un-indexed night, and it should not wait on the
lookout's review.

**Reverse it:** nothing to reverse. If the bearer path is ever unwanted, the
header alone can work again, once the vault holds the function's own key.

## 2026-11-24: Event-driven lookout, sweep as backstop. GitHub OIDC instead of a shared secret

**Decision.**

- **Trigger.** A trigger on `playback_issues` (`tape_desk_lookout`) posts to a
  new edge function, `tape-desk`, through pg_net with the vault's service key.
  That is the delivery the email triggers already use, and the function proves
  the key with Supabase.
- **Dispatch.** The function sends a GitHub `repository_dispatch`, and
  `.github/workflows/tape-desk.yml` runs the runbook on that ticket with
  `concurrency: tape-desk-<song_id>-<show_date>`.
- **The way back.** The workflow reaches the database through the same
  function, authenticated by its own GitHub OIDC token. The function checks
  GitHub's signature, then repository, workflow file, `refs/heads/main`,
  audience and expiry.

**Why OIDC.** A shared secret would be one more value for the owner to create
and paste into two places and keep in step. OIDC needs nothing stored. A
pull request, a fork, another workflow, or this workflow on a branch can't get
a token the function accepts.

**What the owner must still create** (the desk must never create credentials):

- `CLAUDE_CODE_OAUTH_TOKEN`: a repository secret from `claude setup-token`, so
  the run uses the subscription, not a billed API key.
- `TAPE_DESK_GITHUB_TOKEN`: a Lovable Cloud secret holding a fine-grained token
  with Contents read and write on this repo only. That is the permission
  `repository_dispatch` needs.

Without them nothing is lost: the function logs `no TAPE_DESK_GITHUB_TOKEN` in
`tape_desk_dispatches`, and the hourly sweep works the ticket.

**Reverse it:** if GitHub OIDC becomes unavailable, use a shared secret
checked the same way. If report volume stays at about one a day, drop the
trigger and keep the sweep.

## 2026-11-24: Who runs which step, and why the desktop still matters

**Decision.** The workflow has no Lovable and no PostHog, so it can't publish,
apply a migration, or read `/admin`'s badge. It runs T0–T6, and T7 for data
pins, which need no publish. For a code fix it stops at "merged, waiting on
publish" with `tape:owner`. The desktop sweep, which has Lovable, publishes and
verifies.

The `qa-release` gate's sync item needs Lovable, so in Actions it is
NEEDS-VERIFICATION by construction (CLAUDE.md). The gate on a code fix runs
from the desktop.

Also: a pull request opened with the workflow's `GITHUB_TOKEN` does not start
`ci.yml`, a GitHub rule against workflow loops. The runbook runs the CI
commands itself.

**Reverse it:** Lovable exposes an API the workflow can call with a token.

## 2026-11-24: Labels

**Decision.** The brief's three labels replace `tape:owner` for in-scope
tickets: `needs-jay` (held), `ready-to-close` (plays on production, waiting
on Mark fixed), and `verified` (closed after it). `tape:fixing` and
`tape:watching` stay as in-progress labels, and out-of-scope kinds keep the old
set. Ticket state lives in labels. The report's state lives only in
`playback_issues.status`, which only the owner's buttons change.

## 2026-11-24: The four open tickets are all class N, and all held

All four are night data: the band didn't play the song on the night named.

- **Bird Song 1972-04-08 (#153), the seed case**, and **Bird Song 1971-03-24
  (#154)**: both nights come from the community Songbook issue `/songbook/bird-song`.
- **Viola Lee Blues 1970-02-14 (#151)**: from `songs.last_played`. The real
  last performance is 1970-10-31.
- **Ramble On Rose 1980-10-14 (#149)**: a Cosmic Charlie pick in a fan's guide.

For each, JerryBase has no performance, and no Relisten source of the night has
the song by the player's matcher.

The hold rule says the desk never edits night data. Each ticket carries a
recommended repoint to a night that was played and is on tape, verified with
the same two sources.

## 2026-11-24: The pattern behind class N is the catalog's own first/last dates

**Finding.** Blast radius over every `no_match`/`no_tape` default in
`tape_index` (114 keys, `night.ts --keys`):

| Class | Keys | Notes |
|---|---|---|
| N | 110 | |
| possible G | 3 | 1966-07-03; only an untitled "Jam" |
| sources disagree | 1 | Lost Sailor 1991-10-04: two tapes title a track "Lost Sailor >"; JerryBase doesn't list it, and the index says `no_match` |

Counted in production: **93 of the 114** are a song's own `songs.first_played`
or `last_played`. 22 come from setlist slots, and those overlap the 93.

So the main source of "not on the tape" reports is not guides. It is the
catalog's first/last dates, which the version picker and the Songbook put
above the fold as "First time played" / "Last time played".

**Decision.** Held: canonical night data, the owner's call.

The pattern fix is an audit of `songs.first_played/last_played` against
JerryBase, with the correction proposed per song for review. A diff built by
`night.ts` is the cheap first step.

## 2026-11-24: This session's own permissions refused the merge

**What happened.** #156 passed `qa-release` (PASS WITH NOTES on `0fe684a`). Its
one real note, an unpinned probe, was fixed and mutation-tested in `0c98102`,
and CI went green. Then the merge was refused by this session's
permission classifier.

The brief says gate-passed fixes publish without owner review, as decided on
2026-11-06. That decision is not written down anywhere in the repo, and the
settings on the owner's machine disagree with it. The desk did not work
around the refusal.

**Owner decision needed:** either allow `gh pr merge` (and `deploy_project`)
for the desk, or change T7 to stop at "gated, waiting on your merge". Until
then the runbook says merge, and every merge will wait on the owner.
