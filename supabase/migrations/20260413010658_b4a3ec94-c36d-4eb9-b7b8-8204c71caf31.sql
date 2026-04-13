
CREATE TABLE public.share_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  visitor_id TEXT,
  share_type TEXT NOT NULL,
  channel TEXT NOT NULL,
  setlist_id UUID REFERENCES public.setlists(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.share_events ENABLE ROW LEVEL SECURITY;

-- Anyone can log a share event (including anonymous)
CREATE POLICY "Anyone can log share events"
  ON public.share_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only admins can read share events
CREATE POLICY "Admins can view share events"
  ON public.share_events
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for analytics queries
CREATE INDEX idx_share_events_created_at ON public.share_events (created_at DESC);
CREATE INDEX idx_share_events_user_id ON public.share_events (user_id);
CREATE INDEX idx_share_events_channel ON public.share_events (channel);
