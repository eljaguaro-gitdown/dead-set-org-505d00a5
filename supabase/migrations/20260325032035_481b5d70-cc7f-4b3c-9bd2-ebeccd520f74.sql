-- Drop the old permissive INSERT policy that used the broken setlist_has_share_token check
DROP POLICY IF EXISTS "Can join shared setlists or owner can add" ON public.collaborators;

-- Replace with a policy that ONLY allows the setlist owner to add collaborators
-- (joining via share token now goes through the edge function with service role)
CREATE POLICY "Setlist owners can add collaborators"
ON public.collaborators
FOR INSERT
TO authenticated
WITH CHECK (
  is_setlist_owner(auth.uid(), setlist_id)
);