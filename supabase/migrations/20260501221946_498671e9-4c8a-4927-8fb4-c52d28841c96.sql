-- Auth funnel instrumentation
CREATE TABLE public.auth_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id TEXT,
  user_id UUID,
  event_name TEXT NOT NULL,
  provider TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_auth_events_created_at ON public.auth_events (created_at DESC);
CREATE INDEX idx_auth_events_visitor ON public.auth_events (visitor_id, created_at DESC);
CREATE INDEX idx_auth_events_event_name ON public.auth_events (event_name, created_at DESC);

ALTER TABLE public.auth_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log auth events"
ON public.auth_events
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admins can read auth events"
ON public.auth_events
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));