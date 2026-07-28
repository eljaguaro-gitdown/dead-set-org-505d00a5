CREATE TABLE public.podcast_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name1 text NOT NULL,
  name2 text NOT NULL,
  email text NOT NULL,
  handles text,
  location text,
  experience text,
  demo text,
  why text NOT NULL,
  source text,
  status text NOT NULL DEFAULT 'new',
  user_agent text,
  notes text
);

GRANT SELECT, UPDATE ON public.podcast_applications TO authenticated;
GRANT ALL ON public.podcast_applications TO service_role;

ALTER TABLE public.podcast_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view podcast applications"
  ON public.podcast_applications
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update podcast applications"
  ON public.podcast_applications
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX podcast_applications_created_at_idx
  ON public.podcast_applications (created_at DESC);