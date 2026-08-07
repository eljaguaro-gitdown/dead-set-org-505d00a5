-- UGC safety kit (App Store guideline 1.2): content reporting + user blocking.

-- 1) Reports: any authenticated user can flag content; only admins read/resolve.
CREATE TABLE public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('setlist', 'comment', 'message', 'profile')),
  content_id uuid NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid
);

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can file reports"
ON public.content_reports FOR INSERT TO authenticated
WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Admins can read reports"
ON public.content_reports FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update reports"
ON public.content_reports FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) Blocks: each user manages their own block list. No SELECT for the
--    blocked party — being blocked is not discoverable.
CREATE TABLE public.blocked_users (
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own blocks"
ON public.blocked_users FOR ALL TO authenticated
USING (auth.uid() = blocker_id)
WITH CHECK (auth.uid() = blocker_id);

-- 3) Enforcement at the data layer: a blocked user cannot send a DM into a
--    conversation containing someone who blocked them (client also filters).
CREATE POLICY "Blocked senders cannot message blockers"
ON public.direct_messages AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (
  NOT EXISTS (
    SELECT 1
    FROM public.conversation_members cm
    JOIN public.blocked_users b
      ON b.blocker_id = cm.user_id AND b.blocked_id = auth.uid()
    WHERE cm.conversation_id = direct_messages.conversation_id
  )
);
