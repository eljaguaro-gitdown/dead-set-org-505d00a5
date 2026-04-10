-- Fix: collaborators SELECT policy should target authenticated only
DROP POLICY IF EXISTS "Collaborators can view their collaborations" ON public.collaborators;

CREATE POLICY "Collaborators can view their collaborations"
ON public.collaborators
FOR SELECT
TO authenticated
USING ((user_id = auth.uid()) OR is_setlist_owner(auth.uid(), setlist_id));