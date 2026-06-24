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
- **Package manager:** Bun (`bun.lockb` is the source of truth; `package-lock.json` also present)

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

## Conventions

- **Import alias:** `@/` → `src/` (configured in `vite.config.ts`, `vitest.config.ts`, `tsconfig`, `components.json`). Always import via `@/components/...`, `@/lib/...`, etc.
- **shadcn/ui:** components live in `src/components/ui/` and are generated by the shadcn CLI (`components.json`: style `default`, base color `slate`, CSS variables on, no prefix). Treat them as project code you can edit, but expect re-generation to overwrite — prefer composition over modification.
- **Design tokens:** colors are HSL CSS variables defined in `src/index.css` and consumed via `hsl(var(--token))` in [`tailwind.config.ts`](tailwind.config.ts). The `dead.*` palette (red, blue, gold, dark, orange, cream, pink, green, purple, rose, surface, surface-hover) is the brand palette — use it instead of raw Tailwind colors for anything themed.
- **Fonts:** `font-display` (Playfair Display), `font-hand`/`font-marker` (Caveat), `font-body` (DM Sans), `font-mono` (JetBrains Mono).
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
