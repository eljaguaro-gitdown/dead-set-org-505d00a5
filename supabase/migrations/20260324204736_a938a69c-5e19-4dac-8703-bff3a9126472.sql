-- Fix: Prevent collaborators from changing creator_id (ownership hijack)
DROP POLICY IF EXISTS "Collaborators can update setlists" ON public.setlists;

CREATE POLICY "Collaborators can update setlists" ON public.setlists
  FOR UPDATE TO authenticated
  USING (is_setlist_collaborator(auth.uid(), id))
  WITH CHECK (
    is_setlist_collaborator(auth.uid(), id)
    AND creator_id = (SELECT s.creator_id FROM public.setlists s WHERE s.id = setlists.id)
  );