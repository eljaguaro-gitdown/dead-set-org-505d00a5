# Contributing to Dead Set

Hey Now — glad you're here.

## Ground rules

1. **Read [`dead-set-field-guide.md`](dead-set-field-guide.md) before touching any user-facing copy.** The voice rules there are non-negotiable (short version: Cosmic Charlie is a fan, not a feature; taper vernacular, not media-player generic; the Archive credit is never buried).
2. **Non-commercial is structural.** PRs that add advertising, paywalls, or anything that monetizes the music will be declined — see the Grateful Dead policy posted at [dead-set.org/about](https://dead-set.org/about).
3. **Be kind.** This project exists because a community spent fifty years sharing tapes with strangers.

## How the repo works

- `main` is production. Every merge syncs to the hosted build environment; deploys are cut from there manually after a QA gate. Don't be surprised that there's no CI deploy on merge.
- Branch → PR → review → merge. No direct commits to `main`.
- Supabase migrations are **append-only** (`supabase/migrations/`). Never edit a merged migration; add a new one, then regenerate `src/integrations/supabase/types.ts`.
- Auto-generated files (`src/integrations/supabase/types.ts`, `src/integrations/lovable/index.ts`) are not hand-edited.
- Conventions (import alias, design tokens, testing patterns) are documented in [CLAUDE.md](CLAUDE.md).

## Getting set up

```sh
bun install
cp .env.example .env   # fill in your own Supabase project values
bun run dev
bun run test
bun run lint
```

Edge-function secrets live in the Supabase dashboard, never in this repo.

## What we'd love help with

Bug fixes, mobile polish, accessibility, performance, era/song data corrections, and iOS/Capacitor expertise. For bigger ideas, open an issue first so we can talk it through before you build.
