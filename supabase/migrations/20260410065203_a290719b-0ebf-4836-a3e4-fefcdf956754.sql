
CREATE TABLE public.setlist_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setlist_id UUID NOT NULL REFERENCES public.setlists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_setlist_comments_setlist_id ON public.setlist_comments(setlist_id);
CREATE INDEX idx_setlist_comments_created_at ON public.setlist_comments(created_at);

ALTER TABLE public.setlist_comments ENABLE ROW LEVEL SECURITY;

-- Anyone can view comments on public setlists
CREATE POLICY "Comments viewable on public setlists"
  ON public.setlist_comments FOR SELECT
  USING (is_setlist_public(setlist_id));

-- Authenticated users can add comments to public setlists
CREATE POLICY "Authenticated users can comment on public setlists"
  ON public.setlist_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_setlist_public(setlist_id));

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments"
  ON public.setlist_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can delete any comment
CREATE POLICY "Admins can delete any comment"
  ON public.setlist_comments FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));
