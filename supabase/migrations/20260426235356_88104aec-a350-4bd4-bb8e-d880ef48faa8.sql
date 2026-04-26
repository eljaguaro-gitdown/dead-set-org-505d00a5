CREATE TABLE IF NOT EXISTS public.email_sends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  template TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  error_message TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_sends_user_template
  ON public.email_sends (user_id, template, status);

CREATE INDEX IF NOT EXISTS idx_email_sends_sent_at
  ON public.email_sends (sent_at DESC);

ALTER TABLE public.email_sends ENABLE ROW LEVEL SECURITY;

-- Only admins can read campaign send history
CREATE POLICY "Admins can view email sends"
ON public.email_sends
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- No client-side inserts/updates/deletes — service role only (bypasses RLS)
