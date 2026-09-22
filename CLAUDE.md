# Dead Set

A web + iOS app for building, sharing, and browsing Grateful Dead setlists. Originally scaffolded by [Lovable](https://lovable.dev/) (`vite_react_shadcn_ts`), backed by Supabase, wrapped for iOS via Capacitor.

## Product & voice grounding — read before writing ANY user-facing copy

The canonical internal grounding document is [`dead-set-field-guide.md`](dead-set-field-guide.md) ("The Tape Box"). Read it before touching landing copy, the share/viewer surfaces, dispatch email, changelog entries, or anything Cosmic Charlie "says." It covers the mission, Charlie's voice model, the recommendation engine, conversion strategy, beta learnings, and the brand system. **The guide is internal** — it describes the technical machinery freely *because it's for builders*; that language must not leak into user-facing surfaces.

**Non-negotiable rules (from the guide — internalize these):**

- **The word "AI" never appears in any user-facing surface.** Cosmic Charlie is a *fan character* — never a "tool," "algorithm," "model," "AI," or "feature." Deep crates and strong opinions, not a pipeline.
- **Internal machinery stays internal.** Gemini, the function-calling pipeline, Lovable, PostHog, "recommendation engine" — none of that language reaches the room where fans are.
- **Voice is taper culture, not media-player generic.** Describe music structurally/energetically (jamminess, length, intensity, transitions, era, lineup) — never genre adjectives. Recordings "circulate" / are "on tape" (this is why [`/setlist/:id`](src/pages/SetlistPoster.tsx) says "on tape," not "have audio").
- **Community is the hero** — not the app, not the founder. Lead with feeling, not feature: "We are finding each other," never "our matching engine."
- **Fixed signals:** tagline **"Wake. Now. Discover."** (W-A-K-E, never "Wait"); salutation **"Hey Now"**; handle **`grateful_jaguaro`** (lowercase); dispatches structured **Set I / Set II / Encore**; subject lines carry no emojis; the **Internet Archive / tapers / traders credit is prominent, never buried**.
- **Stewardship posture:** Dead Set is **additive** to the fan ecosystem (headyversion, Relisten, the Archive itself) — never competitive. Point back to them with respect.

A setlist is a *reconstructed night with an arc*, not a song playlist — and every reconstruction carries at least one rare-placement "aha moment." See §2 and §4 of the guide.

## Stack

- **Frontend:** React 18 + TypeScript, Vite 5 (SWC), React Router 6, TanStack Query 5
- **UI:** Tailwind CSS 3 + shadcn/ui (Radix primitives), `lucide-react`, `framer-motion`, `sonner` toasts, `next-themes`
- **Forms / validation:** `react-hook-form` + `zod` (`@hookform/resolvers`)
- **Drag & drop:** `@dnd-kit/*` (setlist reordering)
- **Charts:** `recharts`
- **Auth & data:** Supabase (`@supabase/supabase-js`) + Lovable OAuth wrapper (`@lovable.dev/cloud-auth-js`) for Google/Apple/Microsoft sign-in
- **Mobile:** Capacitor 8 (iOS + Android scaffolds; iOS is the active target)
- **Testing:** Vitest + Testing Library (jsdom) for unit/integration; Playwright (via `lovable-agent-playwright-config`) for E2E
- **Lint:** ESLint 9 (flat config) + `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
- **Package manager:** Bun — **`bun.lock`** (text) is the live lockfile; `package-lock.json` is also maintained. `bun.lockb` is a vestigial binary lockfile from the 2025 scaffold, untouched since, and consulting it will mislead you (see the correction below).

## Key folders

```
src/
  App.tsx                 Route table + global providers (QueryClient, Tooltip, AudioPlayer, Toasters)
  main.tsx                React root
  index.css               Tailwind layers + design tokens (HSL CSS vars consumed by tailwind.config.ts)
  pages/                  Route-level components (Index, Auth, Builder, MySetlists, Browse, Song, Admin*, …)
  components/             Feature components
    ui/                   shadcn/ui primitives — generated, edit with care
    builder/              Setlist builder pieces (e.g. ScoreShowByDate)
    landing/              Landing page sections
  hooks/                  Reusable hooks (useAuth, useSetlist, useSongs, useFavorites, usePresence, …)
  contexts/               React context providers (AudioPlayerContext is the main one)
  integrations/
    supabase/client.ts    Singleton Supabase client; reads VITE_ env vars
    supabase/types.ts     AUTO-GENERATED Database types — do not edit by hand
    lovable/index.ts      AUTO-GENERATED Lovable OAuth wrapper — do not edit by hand
  lib/                    Pure utilities (abTest, anonSession, songSearch, trackShare, presenceChannel, shareSong, instagramShare, …)
    charlie/              Cosmic Charlie helpers (e.g. tasteLexicon); has a __tests__/ subdir
  test/setup.ts           Vitest setup (jest-dom + matchMedia shim)
  assets/                 Imported static assets

supabase/
  config.toml             Supabase project id + per-function `verify_jwt` config
  functions/              Deno edge functions (admin-users, ai-deadhead, send-dispatch, og-image, …)
  migrations/             SQL migrations, timestamped — 90+ files, append-only

ios/                      Capacitor iOS scaffold (open ios/App in Xcode)
public/                   Static assets, manifest.json, sw.js (PWA), audio/
docs/qa/                  Manual QA notes
```

## Data model (Supabase `public` schema)

Source of truth lives in `supabase/migrations/`; mirrored as TS types in [`src/integrations/supabase/types.ts`](src/integrations/supabase/types.ts).

**Core setlist domain**
- `setlists` — owned by `creator_id`, flags for `is_public` / `is_collaborative`, `share_token`, counters (`play_count`, `upvote_count`, `playable_slot_count`), optional `era_id`
- `setlist_slots` — ordered songs in a setlist; `(set_number, position)`, plus optional `notable_version_id`, `segue_to_next`, `notes`
- `setlist_upvotes`, `setlist_comments`, `collaborators` (role enum: owner/editor/viewer)
- `draft_setlists` — anonymous/guest in-progress setlists
- `songs` — Grateful Dead song catalog (title, tags, play stats, `typical_set_position` enum: opener/early/mid/late/closer/encore, `is_jam_vehicle`)
- `notable_versions` — flagged specific performances of a song
- `eras` — band era taxonomy
- `setlist_slot_playability` — precomputed audio availability per slot (see `precompute-slot-playability` function)

**Users / social**
- `profiles` — user-facing profile (handle, etc.); referenced by `useAuth` / `PickHandleModal`
- `user_roles` — RBAC (`app_role` enum: admin/moderator/user), checked via `has_role` RPC
- `favorites`, `favorite_songs`, `favorite_song_setlists`
- `conversations`, `conversation_members`, `direct_messages`, `chat_messages`
- `comment_notifications`

**Engagement / analytics**
- `page_visits`, `visitor_attribution`, `share_events`, `play_events`, `auth_events`
- `ab_test_assignments` (+ `mark_ab_conversion` RPC)
- `admin_traffic_stats_cache` (+ `refresh_admin_traffic_stats`, `get_admin_traffic_stats` RPCs)
- `hero_spotlights`, `announcements`, `announcement_reads`, `changelog_entries`

**Email pipeline**
- `email_sends`, `email_send_log`, `email_send_state`, `email_unsubscribe_tokens`, `suppressed_emails`
- `dispatch_sends` (+ `dispatch_recipients` view)
- RPCs: `enqueue_email`, `read_email_batch`, `move_to_dlq`, `delete_email`

**Cosmic Charlie (AI assistant)**
- `cosmic_charlie_history` (+ `cosmic_charlie_song_frequency` view), driven by the `ai-deadhead` edge function

**Misc:** `insider_bugs`, `insider_shares`, `insider_wishlist`

**Enums:** `app_role`, `changelog_tag`, `collaborator_role`, `set_position`.

Edge functions worth knowing about: `og-image` (renders share-card OG images, called directly from the client by URL), `track-visit` (anonymous visit logging, JWT-free), `join-setlist` (token redemption), `ai-deadhead` (Cosmic Charlie chat), `resolve-song-share` (fuzzy-matches an Archive.org track title back to a `songs` row for the song-share deep-link flow), the email/dispatch family, and the admin-only `admin-users` / `daily-user-report` / `weekly-insights-report`.

## Environment variables (names only)

Client (Vite — must be prefixed `VITE_`, exposed in the bundle):

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase anon/publishable key

Used directly via `import.meta.env` in [`src/integrations/supabase/client.ts`](src/integrations/supabase/client.ts), [`src/lib/anonSession.ts`](src/lib/anonSession.ts), and several pages that hit edge functions by URL (`Admin.tsx`, `Unsubscribe.tsx`, `SetlistPoster.tsx`, `SaveCelebration.tsx`, `SetlistMessageCard.tsx`).

Server-side secrets (Supabase edge functions) are configured in the Supabase dashboard, not in this repo — check the function source under `supabase/functions/<name>/` for what each one reads from `Deno.env`.

## Running the dev server

```sh
bun install            # or: npm install
bun run dev            # vite on http://localhost:8080  (host "::", HMR overlay disabled)
```

Other scripts (`package.json`):

- `bun run build` — production build to `dist/`
- `bun run build:dev` — build in development mode (source maps / unminified)
- `bun run preview` — serve the built `dist/` locally
- `bun run lint` — ESLint over the repo

## Running tests

```sh
bun run test           # vitest run — unit/integration, jsdom, includes src/**/*.{test,spec}.{ts,tsx}
bun run test:watch     # vitest in watch mode
```

Test setup lives at [`src/test/setup.ts`](src/test/setup.ts) (loads `@testing-library/jest-dom`, shims `matchMedia`). Tests are colocated next to source (e.g. `AudioPlayerContext.test.tsx`, `songSearch.test.ts`).

The Supabase RLS smoke test [`src/test/anonDraftRls.test.ts`](src/test/anonDraftRls.test.ts) requires real `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` to be set, otherwise it throws.

End-to-end via Playwright is configured in [`playwright.config.ts`](playwright.config.ts) through `lovable-agent-playwright-config`. Run with `bunx playwright test` (no npm script alias).

## Building for iOS via Capacitor

Capacitor config: [`capacitor.config.ts`](capacitor.config.ts) — `appId: org.deadset.app`, `appName: Dead Set`, `webDir: dist`.

```sh
bun run build                  # produce dist/
bunx cap sync ios              # copy web assets + native deps into ios/
bunx cap open ios              # opens ios/App in Xcode
# In Xcode: select scheme "App", pick a device/simulator, Run.
```

**Critical for App Store builds:** the `server` block in [`capacitor.config.ts`](capacitor.config.ts) (commented out by default) points at the Lovable preview URL for hot-reload. It MUST stay commented out for any App Store submission — Apple requires bundled web assets, not a remote URL. See the comment at the top of that file.

iOS privacy manifest lives at [`ios/App/App/PrivacyInfo.xcprivacy`](ios/App/App/PrivacyInfo.xcprivacy); notes in `PrivacyInfo.README.md`.

**Before any work toward the App Store submission, read
[`docs/appstore/SUBMISSION-STATE.md`](docs/appstore/SUBMISSION-STATE.md).** Most
of the submission's state lives outside this repo — App Store Connect, Lovable
Cloud, the Supabase auth config — and a repo-only read produces confident wrong
answers about it. That doc records what is actually done, what is left, and
which decisions are still open.

## Releasing

One `main`, three deploy surfaces, no link between them: the web publishes from
Lovable, iOS builds from `.github/workflows/ios-testflight.yml`, and edge
functions deploy only when the Lovable agent is asked. Merging ships nothing.
**[`docs/RELEASING.md`](docs/RELEASING.md) has the order, the verification for
each surface, and the failure modes** — read it before shipping anything.

## Conventions

- **Import alias:** `@/` → `src/` (configured in `vite.config.ts`, `vitest.config.ts`, `tsconfig`, `components.json`). Always import via `@/components/...`, `@/lib/...`, etc.
- **shadcn/ui:** components live in `src/components/ui/` and are generated by the shadcn CLI (`components.json`: style `default`, base color `slate`, CSS variables on, no prefix). Treat them as project code you can edit, but expect re-generation to overwrite — prefer composition over modification.
- **Design tokens:** colors are HSL CSS variables defined in `src/index.css` and consumed via `hsl(var(--token))` in [`tailwind.config.ts`](tailwind.config.ts). The `dead.*` palette (red, blue, gold, dark, orange, cream, pink, green, purple, rose, surface, surface-hover) is the brand palette — use it instead of raw Tailwind colors for anything themed.
- **Fonts:** the "Deadhead Archives" stack, defined in [`tailwind.config.ts`](tailwind.config.ts) and rationalized in [`DESIGN.md`](DESIGN.md) §2 — `font-title` (UnifrakturMaguntia: hero titles, logos, playlist names), `font-header` (Sancreek: era/section dividers), `font-ticket` (Special Elite → Courier Prime: anything representing a physical record, ticket, or archive document), `font-display` (Sancreek, falling back to Playfair Display), `font-hand`/`font-marker` (Caveat), `font-body` (DM Sans), `font-mono` (IBM Plex Mono: functional UI — search, lists, nav). **`DESIGN.md` governs the visual system and explicitly supersedes the older brand guidance in `dead-set-field-guide.md`** — when a UI decision and DESIGN.md disagree, DESIGN.md wins. The field guide still governs *voice and copy*.
- **Routing:** `react-router-dom` with `BrowserRouter`. The landing page (`Index`) is eager-loaded; every other route is `lazy()` in [`src/App.tsx`](src/App.tsx) inside a `<Suspense fallback={null}>`. New routes must go ABOVE the `*` catch-all.
- **Data fetching:** TanStack Query (single `QueryClient` in `App.tsx`). The Supabase client in [`src/integrations/supabase/client.ts`](src/integrations/supabase/client.ts) is a singleton with `persistSession` + `autoRefreshToken` on localStorage — never instantiate a second client.
- **Auto-generated files — do not hand-edit:**
  - [`src/integrations/supabase/types.ts`](src/integrations/supabase/types.ts) (regenerate via Supabase CLI when schema changes)
  - [`src/integrations/lovable/index.ts`](src/integrations/lovable/index.ts) (Lovable OAuth wrapper)
- **Supabase migrations:** append-only, timestamped `YYYYMMDDHHMMSS_<uuid>.sql`. Never rewrite a merged migration; add a new one. After applying schema changes, regenerate `src/integrations/supabase/types.ts`.
- **Edge functions:** per-function `verify_jwt` is configured in [`supabase/config.toml`](supabase/config.toml). Public endpoints (`track-visit`, `og-image`, unsubscribe handlers, `ai-deadhead`, `admin-users`) set `verify_jwt = false` and must validate auth themselves. Authenticated endpoints (`process-email-queue`, `send-transactional-email`, `send-beta-nudge`, `send-dispatch`) rely on Supabase to enforce JWT.
- **Anonymous users:** the app supports anonymous setlist drafts — see [`src/lib/anonSession.ts`](src/lib/anonSession.ts) and the `draft_setlists` table. Don't assume `auth.uid()` is non-null on the client.
- **ESLint:** `@typescript-eslint/no-unused-vars` is intentionally OFF; `react-refresh/only-export-components` is a warning. Don't reintroduce unused-vars as an error without a reason.
- **Test files:** colocated with source as `*.test.ts(x)` / `*.spec.ts(x)` under `src/`, or grouped in a `__tests__/` subdirectory next to the code under test (see `src/lib/charlie/__tests__/`). Either pattern is accepted — the Vitest glob `src/**/*.{test,spec}.{ts,tsx}` picks both up. The Vitest config does not pick up tests outside `src/`.
- **TypeScript:** `strict` mode per the standard Vite React template; project references split into `tsconfig.app.json` (app) and `tsconfig.node.json` (build tooling).
- **PWA:** service worker at [`public/sw.js`](public/sw.js), manifest at [`public/manifest.json`](public/manifest.json), install prompt handled by [`src/components/PwaInstallBanner.tsx`](src/components/PwaInstallBanner.tsx).

---

## Agent team & routing

Three subagents live in .claude/agents/. Dispatch rules:

- **growth-analyst** — anything involving PostHog, funnels, conversion, or "why did this number move." Runs weekly via /growth-weekly (Mondays). Also dispatch proactively after shipping changes to landing, builder entry, auth, or share surfaces. Read-only on src/; writes only to reports/growth/.
- **community-steward** — anything community-facing: backstage updates, Founding Deadhead emails/replies, Instagram briefs, tasteLexicon proposals. Invoke via /steward. Drafts only — a human (Jay or the Community Steward) sends everything. The human steward's operating plan is docs/community-steward-playbook.md.
- **qa-release** — MANDATORY before any Lovable publish or App Store build. Invoke via /pre-release. No session may trigger deploy_project without a current PASS verdict from qa-release. A BLOCK verdict stops the release — no exceptions, no "small fix" bypasses.

Separation of duties: analysts and gates never edit app code; build sessions never grade their own release. When qa-release or growth-analyst surfaces a repeated mistake, add the correction to this file (compounding engineering).

Parallel work: run qa-release in its own git worktree so verification never collides with an active build session.

### Corrections (banked from gate findings)

- **Verify commits by sha, never by branch name.** When a release context cites a PR/commit/branch, run `git cat-file -t <sha>` against this repo before trusting it — identical branch names exist on both the orphaned `dead-set-org` repo and this repo (`dead-set-org-505d00a5`) with entirely different commit histories, and a PR was once opened against the wrong remote because of it.
- **qa-release must confirm tool access at session start.** A gate session needs Lovable MCP access (`get_diff`/`list_edits`) for the sync check and live-URL reachability (browser through the session's network policy) for the browser items. If either is unavailable, those items are NEEDS-VERIFICATION by construction and the overall verdict cannot be PASS — run the gate from an environment that has both.
- **Lovable "Publish" does NOT deploy edge functions from GitHub-synced commits.** deploy_project ships the frontend only; functions under supabase/functions/ deploy only when the Lovable agent runs supabase--deploy_edge_functions (ask it via send_message: "deploy all edge functions unchanged — zero code changes"). After any merged change to supabase/functions/, request that deploy and VERIFY it landed by probing the live function (pg_net http_get from the production DB works; check a header or behavior that the change altered). The signup-email fix sat merged-but-undeployed for two days because of this.
- **Brand sweep must cover edge-function error strings.** Grep `supabase/functions/*/index.ts` error strings and their `toast.error(e.message)` surfacing sites, not just .tsx JSX text — Cosmic Charlie edge-function error copy ("AI credits exhausted") reaches users verbatim and slips past a JSX-only scan.
- **Brand sweep must match against extracted string literals, not raw grep output.** Pull the quoted string content out first, then test it for banned words. Matching whole `grep -rn` lines lets paths like `ai-deadhead/index.ts` and `generate-setlist-description/index.ts` false-positive on `ai\b` / `generat` — a wall of filename noise that a real user-facing hit hides inside.
- **Static verification silently conflates "defined" with "wired."** Code that looks instrumented can be dead or depend on infrastructure invisible to a repo-only sweep. Two live examples found by one gate: every `window.posthog?.capture(...)` call site is optional-chained, and nothing in the repo ever loads or `.init()`s the SDK — so those events may be no-ops in production; and the `draft_setlists` + RLS anonymous-draft architecture has no caller outside its own test, while the shipping mechanism is session-scoped `sessionStorage`. When a checklist item names a mechanism, grep for **callers**, not definitions, and report "defined but never called" as its own finding — distinct from "unobservable because no browser."
- **Check BOTH the Actions run history and App Store Connect before claiming anything about builds.** This correction has now been wrong in both directions. First a session saw no run history, concluded the TestFlight pipeline "had never run green," and reported it as a submission risk — twice, in writing — while App Store Connect held **19 completed uploads**, all Ready to Submit. The fix banked here then over-rotated and asserted builds 13–19 "went up from Xcode, which leaves no trace here." Also false: `mcp__github__actions_list` shows **19 successful `workflow_dispatch` runs** of `ios-testflight.yml` between 2026-08-07 and 2026-08-21, each ending in `Upload succeeded`, and run 19's date matches build 19's exactly. The trace was here the whole time; nobody listed the runs. Neither source alone is authoritative: ASC knows what exists, the run history knows what put it there. To map one to the other, compare timestamps — an ASC build's creation time is one workflow-duration (3–4 min) after its run's start time, which pins run N to build N without guessing.
- **Derive the CI build number from the run history, not from a story about it.** `ios-testflight.yml` sets `CURRENT_PROJECT_VERSION` from `github.run_number + BUILD_NUMBER_OFFSET`. An offset of **20** was committed on the reasoning that builds 1–19 predated the workflow — but the workflow *made* builds 1–19, at run_number with no offset, so the next run (run 20) would have uploaded build **40**. The offset is now **1**: run 20 + 1 = build 21. The near-miss is the lesson, not the arithmetic — the offset was set to defend against a collision that could not happen, and an ASC build number is permanent once burned. Before touching the offset, list the workflow runs and read the last one's build number out of its own log.
- **`bun install` only works where the private registry is reachable.** `bun.lock` resolves through `europe-west4-npm.pkg.dev` (Lovable's cache). CI reaches it; an external sandbox gets 403 on every package. So **adding an npm dependency has a real cost** — the lockfile cannot be regenerated outside that environment, and a patch that changes `package.json` without `bun.lock` builds locally and silently ships without the dependency in CI. This is why `DeepLinkPlugin.swift` is hand-written instead of using `@capacitor/app`: ~40 lines of Swift beat a dependency that could not be locked.
- **Supabase auth config is in Lovable Cloud, not supabase.com.** This project uses Lovable Cloud, so its Supabase project is provisioned and owned by Lovable — it does **not** appear in the account owner's own Supabase org, and a direct dashboard link 403s. Redirect URLs, Site URL, providers and the anonymous-users toggle are at **Lovable → project → Cloud → Users → Auth settings**. Lovable's own docs say auth settings "live in your Supabase project, not in Lovable", which is true for a *connected* project and wrong for Cloud.
- **An RLS policy is not the whole access story — check column grants too.** `profiles` carries `SELECT USING (true)` for `public`, which reads like every column is world-readable. It is not: column-level grants to `anon`/`authenticated` cover only `avatar_url, created_at, display_name, home_state, id, user_id`, and `dispatch_unsubscribe_token` and the preference flags are already revoked. Reading the policy alone produced a false "exposed unsubscribe token" alarm and a proposed migration that would have changed nothing. Query `information_schema.column_privileges` before concluding a column is exposed.
- **Count every character-limited App Store field; never trust the heading.** `metadata.md` labelled its promotional text "170 chars" and the string was 175 — Apple would have rejected the paste. The verified counts now live next to each field in that file. Same class of error as the screenshot spec, which said 6.7"/6.9" while the actual listing asks for 6.5" only: when a document describes an external system's constraint, check the system.
- **When a commit deletes a feature, sweep beyond `src/` for dangling references.** Check `scripts/`, `public/` (including `sw.js` precache lists), `index.html`, `manifest.json`, and any other non-bundled tooling. A `src/`-scoped sweep looks clean while dev scripts and precached asset paths still point at deleted files — that's how `scripts/generate-signoff.mjs` survived the DJ intro removal and had to be cleaned up in a follow-up commit.
- **`npm ci` failing is its own checklist finding, not a build-tool inconvenience.** When it fails on lockfile drift, do not quietly fall back to `npm install` and mark the build item green — CI runs `npm ci` and will fail exactly where the gate would have caught it. Report the failure verbatim with the commit that introduced the drift. Found when `@lovable.dev/vite-plugin-dev-server-bridge` and `-hmr-gate` sat in `package.json` from `6b8dbd1` but never reached `package-lock.json`; `npm install` worked, which is what hid it.
- **Run the gate against the commit being shipped, not whatever the worktree has checked out.** A gate session reported "2 TypeScript errors, pre-existing, unrelated to this release" while `origin/main` actually had **18**. It was correct about its own working tree — a branch based one commit before the bot commits — and that tree was not what was shipping. `git checkout` the target sha (or `git -c ... --work-tree`) before running `tsc`, `vitest` or a build, and state in the report which sha the numbers came from. A verdict that does not name its commit is not a verdict.
- **Regenerating `types.ts` is a code change and needs a typecheck, not just a commit.** The songbook migration added 7 columns to `notable_versions`; the regenerated Row type then broke **16 call sites across 11 files** that build synthetic versions (an Archive.org recording reconstructed as a `NotableVersion`) from object literals. The bot commit that regenerated it shipped straight to `main` with no PR and no build. Synthetic-version literals now spread `SYNTHETIC_VERSION_DEFAULTS` from [`src/lib/syntheticVersion.ts`](src/lib/syntheticVersion.ts), so the next added column breaks one file instead of eleven — put new synthetic versions through it rather than spelling the columns out inline.
- **`bun.lock` is the live lockfile; `bun.lockb` is a fossil.** Bun moved from the binary `bun.lockb` to the text `bun.lock`, and this repo carries both: `bun.lock` is current, `bun.lockb` has not been touched since the 2025 scaffold commit `3c8d08c`. A gate verifier compared `bun.lockb` against `package.json`, found two devDependencies "missing", and reported a lockfile-drift finding against a release that had none — the packages were in `bun.lock` the whole time. Read `bun.lock`; treat `bun.lockb` as deletable dead weight. Nothing in CI references it.
- **When a diff adds a field to an encode/decode pair, grep for every re-declaration of that function, not just the exported one.** The slot-notes blob had two encoders: the exported `encodeArchiveNotes` in [`src/hooks/useSetlist.ts`](src/hooks/useSetlist.ts) and a private copy in `Builder.tsx`. Adding Charlie's per-version note updated only the export, so the autosave path saved the note and the guest-save path silently dropped it — both "working", disagreeing. A round-trip test on the exported function cannot catch this, because the copy is what runs; the invariant worth asserting is that there is only one definition, which [`encodeArchiveNotesSingleSource.test.ts`](src/hooks/__tests__/encodeArchiveNotesSingleSource.test.ts) now does. Same class as the synthetic-version defaults above: a second copy of a shared format is a silent divergence, not a duplication smell.
- **A subagent's tool access is whatever its own definition grants — never what the dispatching prompt claims.** A `/pre-release` run was dispatched with "Lovable MCP: AVAILABLE — already established this session," written by a session for which that was true. It was false for the gate: `.claude/agents/qa-release.md` grants **Read, Grep, Glob, Bash, Task** and no MCP at all, so `list_edits`/`get_diff`/`query_database` did not exist in its schema. The gate reported the discrepancy instead of fabricating a sync check — correct behaviour, and the right thing to imitate — but the run cost four minutes and came back BLOCK on an item that the dispatching session could have answered itself in one call. Two rules follow. When dispatching: state what the subagent should *try*, never what it will *have*; tool grants live in the agent definition, and asserting availability on another agent's behalf is asserting something you cannot see. When running as a gate: confirm access by calling the tool, not by reading a claim in your prompt — and if a checklist item depends on a tool you do not have, that item is NEEDS-VERIFICATION by construction, which is a different finding from a defect and must not be collapsed into one.
- **The deployed sha is readable from the app itself — stop inferring it.** Two sessions have now tried to establish which commit is serving `dead-set.org` by indirect means: Lovable's `latest_commit_sha` (which reports the project's code, not the published deployment — there is no `published_commit_sha`), and the shape of `auth_events` rows. Both are inference. The app already answers it directly: [`vite.config.ts`](vite.config.ts) bakes `__BUILD_SHA__` into the bundle via `define` at build time, [`src/components/GitHubSyncBadge.tsx`](src/components/GitHubSyncBadge.tsx) reads it and compares against `origin/main` through the public GitHub compare API, and [`src/pages/Admin.tsx`](src/pages/Admin.tsx) mounts it. Loading `/admin` in a browser returns in-sync / ahead / behind / diverged **and the exact sha**, needing neither Supabase nor Lovable reachability — only the deployed page. Check the badge before reasoning about whether a fix is live.
