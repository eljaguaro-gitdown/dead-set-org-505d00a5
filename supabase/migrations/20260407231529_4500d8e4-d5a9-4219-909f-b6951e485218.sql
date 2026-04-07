
-- Conversations between two users
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_one UUID NOT NULL,
  user_two UUID NOT NULL,
  last_message_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_one, user_two),
  CONSTRAINT users_ordered CHECK (user_one < user_two)
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
  ON public.conversations FOR SELECT
  USING (auth.uid() = user_one OR auth.uid() = user_two);

CREATE POLICY "Users can create conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() = user_one OR auth.uid() = user_two);

CREATE POLICY "Users can update own conversations"
  ON public.conversations FOR UPDATE
  USING (auth.uid() = user_one OR auth.uid() = user_two);

-- Direct messages
CREATE TABLE public.direct_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Helper function to check conversation membership
CREATE OR REPLACE FUNCTION public.is_conversation_member(_user_id UUID, _conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations
    WHERE id = _conversation_id
      AND (_user_id = user_one OR _user_id = user_two)
  )
$$;

CREATE POLICY "Users can view messages in own conversations"
  ON public.direct_messages FOR SELECT
  USING (is_conversation_member(auth.uid(), conversation_id));

CREATE POLICY "Users can send messages in own conversations"
  ON public.direct_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id AND is_conversation_member(auth.uid(), conversation_id));

CREATE POLICY "Users can mark messages as read"
  ON public.direct_messages FOR UPDATE
  USING (is_conversation_member(auth.uid(), conversation_id) AND sender_id != auth.uid())
  WITH CHECK (is_conversation_member(auth.uid(), conversation_id) AND sender_id != auth.uid());

-- Index for fast message loading
CREATE INDEX idx_direct_messages_conversation ON public.direct_messages(conversation_id, created_at);
CREATE INDEX idx_conversations_users ON public.conversations(user_one, user_two);

-- Enable realtime for direct messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
