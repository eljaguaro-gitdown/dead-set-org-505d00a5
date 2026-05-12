-- 1) Profiles columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dispatch_opt_in BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dispatch_unsubscribe_token UUID;

UPDATE public.profiles
   SET dispatch_unsubscribe_token = gen_random_uuid()
 WHERE dispatch_unsubscribe_token IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN dispatch_unsubscribe_token SET DEFAULT gen_random_uuid();

ALTER TABLE public.profiles
  ALTER COLUMN dispatch_unsubscribe_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_dispatch_unsub_token_key
  ON public.profiles(dispatch_unsubscribe_token);

-- 2) dispatch_sends log
CREATE TABLE IF NOT EXISTS public.dispatch_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id TEXT NOT NULL,
  user_id UUID,
  email TEXT NOT NULL,
  resend_message_id TEXT,
  status TEXT NOT NULL,
  error_message TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dispatch_sends_dispatch_id_idx
  ON public.dispatch_sends(dispatch_id);
CREATE INDEX IF NOT EXISTS dispatch_sends_user_id_idx
  ON public.dispatch_sends(user_id);

ALTER TABLE public.dispatch_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read dispatch sends"
  ON public.dispatch_sends
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages dispatch sends"
  ON public.dispatch_sends
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3) dispatch_recipients view
CREATE OR REPLACE VIEW public.dispatch_recipients AS
SELECT
  u.id           AS user_id,
  u.email,
  p.display_name,
  p.dispatch_unsubscribe_token
FROM auth.users u
JOIN public.profiles p ON p.user_id = u.id
WHERE p.dispatch_opt_in = TRUE
  AND u.email_confirmed_at IS NOT NULL;

REVOKE ALL ON public.dispatch_recipients FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.dispatch_recipients TO service_role;
