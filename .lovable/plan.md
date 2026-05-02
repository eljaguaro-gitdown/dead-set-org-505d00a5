# Cosmic Charlie QA: Variety + Per-User Surprise

## What I confirmed (last 7 days, ~50 setlists)

A small handful of songs dominate generations, regardless of era/vibe:

| Song | Appears in |
|---|---|
| Space | 24 |
| Morning Dew | 20 |
| Drums | 16 |
| Brokedown Palace | 15 |
| Brown Eyed Women | 14 |
| Cumberland Blues | 13 |
| The Wheel | 9 |

(Drums/Space are mandated by the prompt, so those are expected. The others are not.)

Catalog has **198 songs**, so this concentration is not catalog-limited — it's prompt-driven.

## Why it's happening

1. **The system prompt name-drops the same ~30 songs repeatedly** (Morning Dew, Wharf Rat, Brokedown Palace, Stella Blue, Sugar Magnolia, Bertha, Sugaree, Eyes of the World, etc.) across THEME_SEEDS, OPENER/CLOSER_CONSTRAINTS, VIBE_INTERPRETATION, AHA_MOMENT_REQUIREMENT. LLMs latch onto names you mention — every "for example" becomes a default.
2. **`recentSongs` only lives in a `useRef`** (`CosmicCharlieWelcome.tsx`, `CosmicCharlieDialog.tsx`). It resets on page refresh and is never persisted, so a returning user gets the same Top 10 every time.
3. **No anonymous/visitor history** — guests get zero anti-repeat signal.
4. **No server-side novelty enforcement.** "AVOID THESE" is a soft instruction; with `temperature 0.9` the model often re-uses 6+ of the same anchor titles anyway.
5. **No catalog rotation.** All 198 songs are dumped into the prompt every call. The model defaults to the most-discussed ones in the prose above.

## Plan

### 1. Persist user/visitor song history server-side
New table `cosmic_charlie_history`:
- `user_id uuid null`, `visitor_id text null`, `song_title text`, `song_id uuid null`, `generated_at timestamptz default now()`, era_id, vibe_signature
- RLS: insert allowed for own user_id or own visitor_id; admins can read
- Index on `(user_id, generated_at)`, `(visitor_id, generated_at)`

After every successful `ai-deadhead` build, the edge function inserts one row per song. On the next call, it loads the user's last 60 generated titles and feeds them in as `recentSongs` — making "surprise me each time" actually work across sessions and devices (when logged in).

### 2. Strip song-name anchors from the system prompt
Rewrite `THEME_SEEDS`, `OPENER_CONSTRAINTS`, `CLOSER_CONSTRAINTS`, `VIBE_INTERPRETATION`, `AHA_MOMENT_REQUIREMENT` to describe **structures, energy, and roles** without naming songs. Examples:
- Before: "Open with Bertha, Promised Land, or Shakedown Street"
- After: "Open with a barn-burner from the catalog — uptempo, declarative, crowd-mobilizing"

This removes the naming bias while keeping the curatorial intelligence.

### 3. Hard novelty quota (enforced post-generation)
After the LLM responds, compute overlap between suggested songs and the user's last 60. If overlap > 40% (excluding Drums/Space and canonical pair partners), re-roll once with stricter "AVOID" list and `temperature 1.0`. Log re-rolls so we can tune.

### 4. Catalog windowing
Instead of dumping all 198 songs in the prompt, send a **rotated window** of ~120 songs per call: always include canonical pair anchors (China Cat/Rider, Scarlet/Fire, Help/Slipknot/Franklin's, Drums, Space) + jam vehicles, plus a randomized 100-song sample weighted **inversely** to the user's recent history. Songs the user hasn't seen in their last 60 generations get higher inclusion probability.

### 5. Per-call seed diversity
- Pick **3** THEME_SEEDS instead of 2 (more idiosyncratic combinations).
- Add a `noveltyHint` string built from songs the user has *never* received: e.g. "Consider working in [random unfamiliar song from catalog] if it fits the arc." Three hints per call.
- Bump temperature to 0.95 and add `top_p: 0.95`.

### 6. Better client-side history fallback
Until #1 ships, persist `recentSongsRef` to `localStorage` (key per visitor_id). Fixes guests/refreshes immediately as a stopgap; the server-side table supersedes it.

### 7. Admin visibility
Add a tiny admin SQL view `cosmic_charlie_song_frequency` (top 25 songs, last 7d) so we can verify variety after the fix and watch for regressions. No new UI required — queryable from existing admin tools.

## Technical Details

**Files to edit:**
- `supabase/functions/ai-deadhead/index.ts` — rewrite seed pools, add history fetch + insert, catalog windowing, novelty re-roll
- `src/components/CosmicCharlieWelcome.tsx`, `src/components/CosmicCharlieDialog.tsx` — pass `visitor_id` header, hydrate `recentSongsRef` from localStorage on mount
- New migration: `cosmic_charlie_history` table + RLS + indexes; `cosmic_charlie_song_frequency` view

**Out of scope:** UI redesign of Cosmic Charlie wizard, era-fidelity logic (already enforced), Explore-mode versions tool (separate flow).

## Expected outcome

- Top-song frequency in last-7-day setlists drops from "20/50 contain Morning Dew" to roughly catalog-uniform (3–5/50 for any given song outside Drums/Space and canonical anchors).
- Returning users get demonstrably different setlists on repeat generations (≥60% new songs vs. their previous build).
- Guests get variety even on hard refresh.
