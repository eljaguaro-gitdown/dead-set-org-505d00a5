
-- Allow anyone authenticated to join a setlist that has a share_token (collaborative)
-- by letting them insert into collaborators if the setlist has a share_token
DROP POLICY "Setlist owners can add collaborators" ON public.collaborators;
CREATE POLICY "Can join shared setlists or owner can add" ON public.collaborators FOR INSERT WITH CHECK (
  auth.uid() = user_id AND (
    setlist_id IN (SELECT id FROM public.setlists WHERE share_token IS NOT NULL)
    OR setlist_id IN (SELECT id FROM public.setlists WHERE creator_id = auth.uid())
  )
);
