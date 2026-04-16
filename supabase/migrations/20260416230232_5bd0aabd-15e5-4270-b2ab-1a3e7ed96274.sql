DROP POLICY IF EXISTS "Authenticated users can receive realtime messages" ON realtime.messages;

CREATE POLICY "Users receive realtime for their conversations and setlists"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Direct message conversations: topic format "dm-<conversation_id>"
  (
    realtime.topic() LIKE 'dm-%'
    AND public.is_conversation_member(
      substring(realtime.topic() from 4)::uuid,
      (SELECT auth.uid())
    )
  )
  OR
  -- Chat channels: topic format "chat-<setlist_id>"
  (
    realtime.topic() LIKE 'chat-%'
    AND (
      public.is_setlist_collaborator(substring(realtime.topic() from 6)::uuid, (SELECT auth.uid()))
      OR public.is_setlist_owner(substring(realtime.topic() from 6)::uuid, (SELECT auth.uid()))
      OR public.is_setlist_public(substring(realtime.topic() from 6)::uuid)
    )
  )
  OR
  -- Setlist collaboration channels: topic format "setlist-<setlist_id>"
  (
    realtime.topic() LIKE 'setlist-%'
    AND (
      public.is_setlist_collaborator(substring(realtime.topic() from 9)::uuid, (SELECT auth.uid()))
      OR public.is_setlist_owner(substring(realtime.topic() from 9)::uuid, (SELECT auth.uid()))
      OR public.is_setlist_public(substring(realtime.topic() from 9)::uuid)
    )
  )
  OR
  -- Presence/visitor tracking channels (non-sensitive): explicit allowlist
  realtime.topic() IN ('online-visitors', 'admin-presence', 'presence')
  OR realtime.topic() LIKE 'presence-%'
);