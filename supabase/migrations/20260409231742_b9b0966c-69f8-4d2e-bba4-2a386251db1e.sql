
-- Add group chat columns to conversations
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS name text,
ADD COLUMN IF NOT EXISTS is_group boolean NOT NULL DEFAULT false;

-- Create conversation_members table
CREATE TABLE public.conversation_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);

-- Enable RLS
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;

-- Members can view memberships of conversations they belong to
CREATE POLICY "Members can view conversation members"
ON public.conversation_members
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_members cm
    WHERE cm.conversation_id = conversation_members.conversation_id
    AND cm.user_id = auth.uid()
  )
);

-- Authenticated users can add members to conversations they belong to
CREATE POLICY "Members can add to conversations"
ON public.conversation_members
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.conversation_members cm
    WHERE cm.conversation_id = conversation_members.conversation_id
    AND cm.user_id = auth.uid()
  )
  OR
  -- Allow the creator to add the first members (including themselves)
  auth.uid() = user_id
);

-- Members can leave conversations (delete own membership)
CREATE POLICY "Members can leave conversations"
ON public.conversation_members
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Migrate existing 1-on-1 conversations to conversation_members
INSERT INTO public.conversation_members (conversation_id, user_id)
SELECT id, user_one FROM public.conversations
ON CONFLICT DO NOTHING;

INSERT INTO public.conversation_members (conversation_id, user_id)
SELECT id, user_two FROM public.conversations
ON CONFLICT DO NOTHING;

-- Update is_conversation_member to use the new members table
CREATE OR REPLACE FUNCTION public.is_conversation_member(_user_id uuid, _conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_members
    WHERE conversation_id = _conversation_id
      AND user_id = _user_id
  )
$$;

-- Update conversations RLS to use new members table
DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
CREATE POLICY "Users can view own conversations"
ON public.conversations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_members cm
    WHERE cm.conversation_id = id
    AND cm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update own conversations" ON public.conversations;
CREATE POLICY "Users can update own conversations"
ON public.conversations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_members cm
    WHERE cm.conversation_id = id
    AND cm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations"
ON public.conversations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_one OR auth.uid() = user_two);

-- Enable realtime for conversation_members
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members;

-- Index for performance
CREATE INDEX idx_conversation_members_user ON public.conversation_members(user_id);
CREATE INDEX idx_conversation_members_conv ON public.conversation_members(conversation_id);
