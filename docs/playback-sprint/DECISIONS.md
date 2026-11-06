# Playback sprint — decisions log

Each entry: what was decided, why, and what would reverse it. Newest at the bottom.

## 2026-11-06 — Session network: archive.org allowed, mirror hosts are not enumerable

**Decision.** Added `archive.org` (plus two placeholder `ia*.us.archive.org` names) to this
session's cloud environment so the bench, the tape probe and every live verification can
ask the Internet Archive. The Archive's `/download/` redirect lands on a per-item mirror host
(`ia8NNNNN.us.archive.org`, `dnNNNNNN.ca.archive.org`, …) and the environment allowlist
takes exact hostnames only, so the mirror leg (the bytes themselves) is reachable from this
sandbox only for whichever mirrors are listed.

**Why.** Without the API hosts nothing in Step A can be measured at all. The mirror hosts
are a Settings-level decision (wildcards are refused by the tool).

**What would reverse it.** The owner adding `*.archive.org` in the environment's Settings,
which lets the bench measure first-sound end to end from a cloud session. Until then the
bench measures the resolve chain in the sandbox and the mirror leg is probed with ranged
HEAD requests where the host is reachable; see STATUS.md for which runs had which.

## 2026-11-06 — Build attribution: a CI stamp commit, not a pre-commit hook

**Decision.** `.github/workflows/stamp-build-sha.yml` runs on every push to `main`, writes
`src/buildInfo.ts` with the sha of that push, and commits it back as `chore: stamp build <sha>
[skip ci]`. `scripts/build-sha/resolve.mjs` (used by `vite.config.ts`) and `src/lib/buildSha.ts`
(used by PostHog, the playback reports and the admin badge) both read the file when git cannot
answer, and read *through* a stamp commit to the code commit when git can, so Lovable, CI and
the iOS workflow all report the same sha for the same code. The admin sync badge no longer counts
`src/buildInfo.ts` as shipping drift, so a build of the code commit reads as in sync with a
`main` whose tip is its stamp.

**Why not a pre-commit hook.** A commit's sha is a hash of its own tree, so no file inside the
commit can carry it. A hook can only record the *parent*, which is exactly as misleading as
the stamp commit's parent relation, with none of the CI guarantees.

**Proof so far.** A copy of the tree with no `.git` directory built with the sha in the bundle
(`dist/assets/index-*.js` contains it once, as `BUILD_INFO`). Proof on a Lovable preview build
follows the first merge to `main`: the stamp workflow must run there, and the preview bundle must
carry the stamped sha. Until that is observed the fix is verified in simulation only.

**What would reverse it.** Lovable exposing the commit at build time (an env var in its builder),
which would make `VITE_BUILD_SHA` the whole answer and the stamp commits noise.
