-- The setlists/setlist_slots RLS policies call is_setlist_public, is_setlist_owner,
-- and is_setlist_collaborator from policies applied to the PUBLIC role. Anonymous
-- users currently don't have EXECUTE on these functions, which causes the entire
-- USING expression to fail with "permission denied for function ..." — even when
-- the setlist is public. Granting EXECUTE to anon (and re-affirming to authenticated)
-- lets the policy evaluate correctly and fall through to the is_public branch.

GRANT EXECUTE ON FUNCTION public.is_setlist_public(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_setlist_owner(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_setlist_collaborator(uuid, uuid) TO anon, authenticated;