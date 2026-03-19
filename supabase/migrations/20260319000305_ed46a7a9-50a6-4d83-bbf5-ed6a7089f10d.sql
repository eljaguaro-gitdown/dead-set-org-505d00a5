-- Fix infinite recursion in setlists RLS policies
-- The issue: setlists SELECT checks collaborators, collaborators INSERT checks setlists

-- Create a helper function to check setlist ownership without triggering RLS
CREATE OR REPLACE FUNCTION public.is_setlist_owner(_user_id uuid, _setlist_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.setlists
    WHERE id = _setlist_id AND creator_id = _user_id
  )
$$;

-- Create a helper function to check if user is collaborator
CREATE OR REPLACE FUNCTION public.is_setlist_collaborator(_user_id uuid, _setlist_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.collaborators
    WHERE setlist_id = _setlist_id AND user_id = _user_id
  )
$$;

-- Create helper to check if setlist is public
CREATE OR REPLACE FUNCTION public.is_setlist_public(_setlist_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.setlists
    WHERE id = _setlist_id AND is_public = true
  )
$$;

-- Create helper to check if setlist has share token
CREATE OR REPLACE FUNCTION public.setlist_has_share_token(_setlist_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.setlists
    WHERE id = _setlist_id AND share_token IS NOT NULL
  )
$$;

-- Drop existing setlists policies
DROP POLICY IF EXISTS "Viewable setlists" ON public.setlists;
DROP POLICY IF EXISTS "Users can create setlists" ON public.setlists;
DROP POLICY IF EXISTS "Users can update own setlists" ON public.setlists;
DROP POLICY IF EXISTS "Users can delete own setlists" ON public.setlists;
DROP POLICY IF EXISTS "Collaborators can update setlists" ON public.setlists;

-- Recreate setlists policies using helper functions
CREATE POLICY "Viewable setlists" ON public.setlists FOR SELECT
USING (
  is_public = true
  OR creator_id = auth.uid()
  OR public.is_setlist_collaborator(auth.uid(), id)
);

CREATE POLICY "Users can create setlists" ON public.setlists FOR INSERT
WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Users can update own setlists" ON public.setlists FOR UPDATE
USING (creator_id = auth.uid());

CREATE POLICY "Users can delete own setlists" ON public.setlists FOR DELETE
USING (creator_id = auth.uid());

CREATE POLICY "Collaborators can update setlists" ON public.setlists FOR UPDATE
USING (public.is_setlist_collaborator(auth.uid(), id));

-- Drop and recreate collaborators policies using helper functions
DROP POLICY IF EXISTS "Can join shared setlists or owner can add" ON public.collaborators;
DROP POLICY IF EXISTS "Collaborators can view their collaborations" ON public.collaborators;
DROP POLICY IF EXISTS "Setlist owners can remove collaborators" ON public.collaborators;

CREATE POLICY "Can join shared setlists or owner can add" ON public.collaborators FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (
    public.setlist_has_share_token(setlist_id)
    OR public.is_setlist_owner(auth.uid(), setlist_id)
  )
);

CREATE POLICY "Collaborators can view their collaborations" ON public.collaborators FOR SELECT
USING (
  user_id = auth.uid()
  OR public.is_setlist_owner(auth.uid(), setlist_id)
);

CREATE POLICY "Setlist owners can remove collaborators" ON public.collaborators FOR DELETE
USING (public.is_setlist_owner(auth.uid(), setlist_id));

-- Fix setlist_slots policies too
DROP POLICY IF EXISTS "Slots viewable with setlist" ON public.setlist_slots;
DROP POLICY IF EXISTS "Slots editable by owner or collaborator" ON public.setlist_slots;
DROP POLICY IF EXISTS "Slots updatable by owner or collaborator" ON public.setlist_slots;
DROP POLICY IF EXISTS "Slots deletable by owner or collaborator" ON public.setlist_slots;

CREATE POLICY "Slots viewable with setlist" ON public.setlist_slots FOR SELECT
USING (
  public.is_setlist_public(setlist_id)
  OR public.is_setlist_owner(auth.uid(), setlist_id)
  OR public.is_setlist_collaborator(auth.uid(), setlist_id)
);

CREATE POLICY "Slots editable by owner or collaborator" ON public.setlist_slots FOR INSERT
WITH CHECK (
  public.is_setlist_owner(auth.uid(), setlist_id)
  OR public.is_setlist_collaborator(auth.uid(), setlist_id)
);

CREATE POLICY "Slots updatable by owner or collaborator" ON public.setlist_slots FOR UPDATE
USING (
  public.is_setlist_owner(auth.uid(), setlist_id)
  OR public.is_setlist_collaborator(auth.uid(), setlist_id)
);

CREATE POLICY "Slots deletable by owner or collaborator" ON public.setlist_slots FOR DELETE
USING (
  public.is_setlist_owner(auth.uid(), setlist_id)
  OR public.is_setlist_collaborator(auth.uid(), setlist_id)
);

-- Fix chat_messages policies too
DROP POLICY IF EXISTS "Chat viewable by setlist participants" ON public.chat_messages;
DROP POLICY IF EXISTS "Chat insertable by setlist participants" ON public.chat_messages;

CREATE POLICY "Chat viewable by setlist participants" ON public.chat_messages FOR SELECT
USING (
  public.is_setlist_owner(auth.uid(), setlist_id)
  OR public.is_setlist_collaborator(auth.uid(), setlist_id)
);

CREATE POLICY "Chat insertable by setlist participants" ON public.chat_messages FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (
    public.is_setlist_owner(auth.uid(), setlist_id)
    OR public.is_setlist_collaborator(auth.uid(), setlist_id)
  )
);