# Releasing Dead Set

One `main`, **three** deploy surfaces, and nothing links them. Merging does not
ship anything — each surface has its own trigger, and each is easy to forget on
its own.

This file exists because on 2026-09-21 the iOS app was an hour old and the web
was **19 commits behind it**, carrying none of that day's work. Nobody decided
that; the publish step simply never happened, and the admin badge had been
saying so for a day.

---

## The three surfaces

| Surface | Trigger | Ships from | Latency |
|---|---|---|---|
| **Web** — dead-set.org | Lovable **Publish** (`deploy_project`) | Lovable's workspace, which syncs from GitHub `main` | ~1 min |
| **iOS** — TestFlight | `.github/workflows/ios-testflight.yml`, `workflow_dispatch` | the git ref you dispatch | ~4 min + ASC processing |
| **Edge functions** | the Lovable agent running `supabase--deploy_edge_functions` | Lovable's workspace | ~1 min |

**Publish ships the frontend only.** Functions under `supabase/functions/` do
not move with it. That is banked in `CLAUDE.md` because a signup-email fix sat
merged-but-undeployed for two days behind exactly this assumption.

---

## The release pass

Do these together, from the same `main` commit, or write down which you skipped.

**1. Gate it.** `/pre-release` against the sha you are shipping, not whatever a
worktree has checked out. A BLOCK stops the release; nothing else does. The
verdict must name the commit — a verdict that does not is not a verdict.

**2. Publish the web.** Lovable `deploy_project`. Requires a current pass-class
verdict from step 1.

**2a. Record it — once the live site is confirmed serving the sha** (see
*Verifying each one landed*). The landing footer's "Updated N times this week"
counts these rows, so a release that is not recorded is invisible to fans, and
one recorded before it is live is a claim about something they did not get:

```sql
insert into public.web_releases (commit_sha, note)
values ('<full 40-char sha>', '<one line: what fans got>');
```

Run it through Lovable `query_database`. A Lovable **preview** is not a
release; neither is a merge. Only a publish that went live gets a row.

**3. Dispatch the iOS build**, if the change reaches the app — which is almost
anything in `src/`, since Capacitor bundles the same web assets. Run it against
`main` unless you have a reason not to.

**4. Deploy edge functions IF `supabase/functions/` changed.** Check, don't
assume:

```sh
git diff --name-only <last-deployed-sha> origin/main -- supabase/functions
```

Empty means skip. Otherwise ask the Lovable agent, then **verify it landed** by
probing the live function for behaviour the change altered — a `pg_net`
`http_get` from the production DB works.

---

## Verifying each one landed

If `/admin` can't be opened from where you are, read the sha straight out of
the live bundle: fetch `https://dead-set.org/`, find `assets/index-*.js`, find
`assets/Admin-*.js` inside it, and grep that for a 40-hex string. A sandbox
whose proxy blocks dead-set.org can do this through `pg_net`
(`select net.http_get(url)`, then read `net._http_response`) via Lovable
`query_database`. `unknown` there means the build could not read git; see
`readGitSha()` in `vite.config.ts`.

- **Web** — open `/admin` and read the sync badge. It compares this build's
  commit to `main` through GitHub's compare API: *In sync*, *Ahead of main*,
  *Behind main* with the count of app files that differ, or *App code in sync*
  when `main` moved only in docs. The badge reports **the surface you are
  looking at**, so the same page in the iOS app answers for the app, not the web.
- **iOS** — the run log ends `Upload succeeded` / `** EXPORT SUCCEEDED **`. The
  build number is `run_number + BUILD_NUMBER_OFFSET`; the literal number appears
  nowhere in the log, because the step echo shows the arithmetic unevaluated.
  **App Store Connect is the authority.** An ASC build's creation time lands one
  workflow-duration (~3 min) after its run started, which pins run N to build N.
- **Edge functions** — probe the live function. A green Publish proves nothing
  about them.

---

## What "in sync" can and cannot mean

Continuous parity is not achievable and is not the goal. iOS has TestFlight
processing between merge and testers, and App Store review between merge and the
public. The target is **per-release parity**: every release ships every affected
surface from one commit, in one pass.

Between releases the surfaces WILL differ, and that is fine as long as it is
deliberate. The badge exists to make it visible rather than surprising.

---

## Things that have gone wrong here before

Each of these cost real time; all are banked in `CLAUDE.md` with the full story.

- **Publishing and assuming edge functions went with it.** They did not.
- **Reasoning about build numbers from a story instead of the run history.** An
  offset was once set to 20 to avoid a collision that could not happen, which
  would have burned build 40. List the runs; read the last one's number.
- **Grading a release against the wrong checkout.** A gate reported 2 type
  errors while `origin/main` had 18. Check out the target sha first.
- **Building from a branch.** Builds 23–25 came off a feature branch, so "the
  newest build is `main`" was false for a day. If you dispatch from a branch,
  say so in `docs/appstore/SUBMISSION-STATE.md` until it merges.
- **Trusting one doc.** `reviewer-notes.md` told Apple the app had no
  third-party sign-in hours after OAuth shipped, and `metadata.md` still says
  the demo account is blocked on a fix that shipped in build 21. A claim about
  code goes stale silently — grep the sibling docs for the same claim, not just
  the one you are editing.
