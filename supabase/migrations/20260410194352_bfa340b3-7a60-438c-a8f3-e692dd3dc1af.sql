DROP POLICY IF EXISTS "Members can view conversation members" ON public.conversation_members;
DROP POLICY IF EXISTS "Members can add to conversations" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON public.conversations;

CREATE POLICY "Members can view conversation members"
ON public.conversation_members
FOR SELECT
TO authenticated
USING (public.is_conversation_member(auth.uid(), conversation_id));

CREATE POLICY "Members can add to conversations"
ON public.conversation_members
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  OR public.is_conversation_member(auth.uid(), conversation_id)
);

CREATE POLICY "Users can view own conversations"
ON public.conversations
FOR SELECT
TO authenticated
USING (public.is_conversation_member(auth.uid(), id));

CREATE POLICY "Users can update own conversations"
ON public.conversations
FOR UPDATE
TO authenticated
USING (public.is_conversation_member(auth.uid(), id));