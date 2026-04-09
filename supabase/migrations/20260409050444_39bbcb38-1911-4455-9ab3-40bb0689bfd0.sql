
-- Fix conversations: change all policies from public to authenticated
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations"
  ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK ((auth.uid() = user_one) OR (auth.uid() = user_two));

DROP POLICY IF EXISTS "Users can update own conversations" ON public.conversations;
CREATE POLICY "Users can update own conversations"
  ON public.conversations FOR UPDATE
  TO authenticated
  USING ((auth.uid() = user_one) OR (auth.uid() = user_two));

DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
CREATE POLICY "Users can view own conversations"
  ON public.conversations FOR SELECT
  TO authenticated
  USING ((auth.uid() = user_one) OR (auth.uid() = user_two));

-- Fix direct_messages: change all policies from public to authenticated
DROP POLICY IF EXISTS "Users can view messages in own conversations" ON public.direct_messages;
CREATE POLICY "Users can view messages in own conversations"
  ON public.direct_messages FOR SELECT
  TO authenticated
  USING (is_conversation_member(auth.uid(), conversation_id));

DROP POLICY IF EXISTS "Users can send messages in own conversations" ON public.direct_messages;
CREATE POLICY "Users can send messages in own conversations"
  ON public.direct_messages FOR INSERT
  TO authenticated
  WITH CHECK ((auth.uid() = sender_id) AND is_conversation_member(auth.uid(), conversation_id));

DROP POLICY IF EXISTS "Users can mark messages as read" ON public.direct_messages;
CREATE POLICY "Users can mark messages as read"
  ON public.direct_messages FOR UPDATE
  TO authenticated
  USING (is_conversation_member(auth.uid(), conversation_id) AND (sender_id <> auth.uid()))
  WITH CHECK (is_conversation_member(auth.uid(), conversation_id) AND (sender_id <> auth.uid()));
