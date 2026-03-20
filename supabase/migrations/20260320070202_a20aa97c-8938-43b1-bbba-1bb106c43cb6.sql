
-- Upvotes table: one permanent vote per user per setlist
CREATE TABLE public.setlist_upvotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setlist_id uuid NOT NULL REFERENCES public.setlists(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (setlist_id, user_id)
);

-- Enable RLS
ALTER TABLE public.setlist_upvotes ENABLE ROW LEVEL SECURITY;

-- Anyone can see upvotes on public setlists
CREATE POLICY "Upvotes viewable on public setlists"
  ON public.setlist_upvotes FOR SELECT
  USING (is_setlist_public(setlist_id));

-- Authenticated users can upvote
CREATE POLICY "Authenticated users can upvote"
  ON public.setlist_upvotes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_setlist_public(setlist_id));

-- Users can see their own upvotes (even on non-public setlists for UI state)
CREATE POLICY "Users can see own upvotes"
  ON public.setlist_upvotes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Add upvote_count to setlists for fast reads
ALTER TABLE public.setlists ADD COLUMN upvote_count integer NOT NULL DEFAULT 0;

-- Function to get upvote count (fallback)
CREATE OR REPLACE FUNCTION public.increment_upvote_count(_setlist_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  UPDATE public.setlists
  SET upvote_count = upvote_count + 1
  WHERE id = _setlist_id;
$$;
