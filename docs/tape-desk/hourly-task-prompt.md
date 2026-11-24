# Prompt for the `tape-desk-hourly` scheduled task

Applied on 2026-11-24, after the owner said yes. The task in the Claude desktop
app (Scheduled tasks → Tape desk (hourly)) carries this text word for word.
What it changed from the earlier prompt: the desk may merge and publish a
tape-desk fix with a PASS gate and green CI. Every limit that protects fans
stays. Change this file and the task together, or they drift.

---

Run one pass of the Dead Set tape desk: the hourly sweep. When a fan's tape won't play, Dead Set files a row in `playback_issues`. "Not on the tape" reports (`not_on_tape`, `no_tape`) also start the lookout, a GitHub workflow that works the ticket at once. This pass is the backstop and the desktop half. It works whatever the lookout missed, publishes what the workflow cannot (it has no Lovable), finishes tickets the owner has closed, and triages the other kinds.

## Where everything is

- The procedure is `C:\Dev\dead-set-tape-desk\.claude\commands\tape-desk.md`. Run it with no arguments: that is sweep mode (§S). Its step S1 resets `C:\Dev\dead-set-tape-desk` to `origin/main`, so re-read the procedure after that reset.
- The playbook is `C:\Dev\dead-set-tape-desk\docs\tape-desk.md`, and it wins where the two disagree. Decisions and the resume file are in `C:\Dev\dead-set-tape-desk\docs\tape-desk\`.
- The repo's rules are in `C:\Dev\dead-set-tape-desk\CLAUDE.md`. Read them before any engineering step.
- The shell is Git Bash on Windows, so use POSIX syntax and forward slashes.

## Tools

You need four: the Lovable connector (`query_database`, `get_project`, `list_edits`, `get_diff`, `deploy_project`, `send_message`; project `276b1692-bb17-4817-a9c6-aeb43f8b06a0`), the PostHog connector (`exec`, project 617063), the `gh` CLI, and Bash. Load any deferred connector tools with one ToolSearch call before step S0. If any one is missing, stop as S0 says and report which. If the `tape-triage` or `qa-release` agent types are not registered, use a general-purpose agent with the body of `.claude/agents/<name>.md`. Tell a subagent what to try, never what tools it has.

## What the owner has allowed (2026-11-24)

- **Merge** a tape-desk fix PR, squash, with `--match-head-commit`, only when both hold for that exact head sha: a current `qa-release` PASS (or PASS WITH NOTES, with every note fixed or recorded), and green CI.
- **Publish it** through `docs/RELEASING.md`, per the runbook's step T7:
  1. Confirm the commit reached Lovable.
  2. Apply that PR's own migration.
  3. Ask the Lovable agent to deploy the changed edge functions, with zero code changes.
  4. Run `deploy_project` for frontend changes.
  5. Verify live.
  6. Add the `web_releases` row.

## Hard limits

- **Never** press Mark fixed, Verified or No tape exists, call `set_playback_issue_status`, or write `playback_issues`. Those buttons email fans, and every close is the owner's.
- **Never** email a fan. The only email the desk sends is the owner alert.
- **Never** write production data with `query_database`, except to apply a merged PR's own migration. Pins go through the workflow. Night data (setlists, guides, `songs.first_played/last_played`) is never the desk's to edit.
- **Never** merge without the PASS and green CI above, and never merge or publish a fix for `wont_play` or `none_in_setlist`.
- **Never** select from `playback_issue_reporters`, except a count of fans waiting. No user id, PostHog distinct id, name or email in a ticket, PR, commit, comment or report.
- **Never** work in `C:\Dev\dead-set-org-505d00a5` itself or switch its branch.
- Probe the Internet Archive, Relisten and JerryBase only as often as the playbook allows.

## Telling Jay

Send **one** PushNotification only when this pass produced something to act on: a ticket held or ready to close, a merge or a publish, a gate BLOCK, a fix that did not hold, a report the lookout missed, or a tool failure at S0. Keep it under 200 characters and lead with the action. Send no notification when nothing changed.

## Finish

End with the procedure's TAPE DESK report and nothing else. If nothing changed, the whole report is `TAPE DESK <time>: nothing new.`
