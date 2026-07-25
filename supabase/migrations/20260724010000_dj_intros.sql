-- ============================================================
-- DJ Cosmic Charlie & Cherise — Phase 2 backend
-- See docs/features/dj-cosmic-charlie.md
--
-- Adds:
--   1. `setlist_intros` table — one row per (setlist, intro_source_hash)
--      caching a generated duet intro's per-line audio URLs and script.
--   2. `dj-intros` public storage bucket — holds the per-line MP3s.
--      Service-role writes only; public reads.
--   3. Two new columns on `profiles` for user preference toggles.
-- ============================================================

-- ── 1. setlist_intros ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.setlist_intros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setlist_id uuid NOT NULL REFERENCES public.setlists(id) ON DELETE CASCADE,
  -- Deterministic hash of the intro-relevant fields (title, era_id,
  -- description, ordered song_ids, ordered segues). Changes when the
  -- setlist meaningfully changes; unchanged for cosmetic edits.
  intro_source_hash text NOT NULL,
  -- Ordered array of per-line audio references. Each element is:
  -- { speaker: 'charlie' | 'cherise' | 'both', path: string, duration_ms: int }
  -- Client plays them sequentially, then plays the signoff asset.
  lines jsonb NOT NULL,
  -- The raw duet script the LLM produced. Retained for audit + potential
  -- reuse in the future song-overlay feature.
  script_json jsonb NOT NULL,
  total_duration_ms int NOT NULL,
  voice_provider text NOT NULL DEFAULT 'openai',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (setlist_id, intro_source_hash)
);
CREATE INDEX IF NOT EXISTS idx_setlist_intros_setlist_id
  ON public.setlist_intros(setlist_id);

-- RLS: intros are public (any user, guest or authed, can play a setlist
-- and needs to fetch the intro). Only service-role can write.
ALTER TABLE public.setlist_intros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read setlist intros"
  ON public.setlist_intros
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- No INSERT/UPDATE/DELETE policies for anon/authenticated — service role
-- bypasses RLS, which is exactly what the edge function uses.

-- ── 2. dj-intros storage bucket ────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('dj-intros', 'dj-intros', true)
ON CONFLICT (id) DO NOTHING;

-- Public read; no user write policies (service role writes via edge function).
CREATE POLICY "DJ intros are publicly readable"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'dj-intros');

-- ── 3. profile preference toggles ──────────────────────────────
-- Two independent user-level opt-outs. Default ON so the feature is
-- discovered organically; users who prefer pure music can flip either off.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dj_intro_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS song_overlay_enabled boolean NOT NULL DEFAULT true;
