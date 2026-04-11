
-- Create enum for changelog tags
CREATE TYPE public.changelog_tag AS ENUM ('fix', 'new', 'improved', 'beta');

-- Create changelog_entries table
CREATE TABLE public.changelog_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_number INTEGER NOT NULL,
  week_label TEXT NOT NULL,
  edition_title TEXT NOT NULL DEFAULT '',
  tag public.changelog_tag NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  credit TEXT,
  set_number INTEGER NOT NULL DEFAULT 1,
  encore_note TEXT,
  next_week_teaser TEXT,
  published BOOLEAN NOT NULL DEFAULT false,
  week_stats_updates INTEGER NOT NULL DEFAULT 0,
  week_stats_feedback INTEGER NOT NULL DEFAULT 0,
  week_stats_bugs INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.changelog_entries ENABLE ROW LEVEL SECURITY;

-- Public can view published entries
CREATE POLICY "Published changelog entries are viewable by everyone"
  ON public.changelog_entries
  FOR SELECT
  USING (published = true);

-- Admins can view all entries (including drafts)
CREATE POLICY "Admins can view all changelog entries"
  ON public.changelog_entries
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can insert
CREATE POLICY "Admins can insert changelog entries"
  ON public.changelog_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admins can update
CREATE POLICY "Admins can update changelog entries"
  ON public.changelog_entries
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can delete
CREATE POLICY "Admins can delete changelog entries"
  ON public.changelog_entries
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Index for fast public queries
CREATE INDEX idx_changelog_entries_published_week ON public.changelog_entries (published, week_number DESC);
