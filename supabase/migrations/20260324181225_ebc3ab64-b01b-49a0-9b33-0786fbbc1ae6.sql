
-- Tighten setlists write policies from public to authenticated
DROP POLICY IF EXISTS "Users can create setlists" ON public.setlists;
CREATE POLICY "Users can create setlists" ON public.setlists FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Users can update own setlists" ON public.setlists;
CREATE POLICY "Users can update own setlists" ON public.setlists FOR UPDATE TO authenticated USING (creator_id = auth.uid());

DROP POLICY IF EXISTS "Collaborators can update setlists" ON public.setlists;
CREATE POLICY "Collaborators can update setlists" ON public.setlists FOR UPDATE TO authenticated USING (is_setlist_collaborator(auth.uid(), id));

DROP POLICY IF EXISTS "Users can delete own setlists" ON public.setlists;
CREATE POLICY "Users can delete own setlists" ON public.setlists FOR DELETE TO authenticated USING (creator_id = auth.uid());

-- Tighten setlist_slots write policies
DROP POLICY IF EXISTS "Slots editable by owner or collaborator" ON public.setlist_slots;
CREATE POLICY "Slots editable by owner or collaborator" ON public.setlist_slots FOR INSERT TO authenticated WITH CHECK (is_setlist_owner(auth.uid(), setlist_id) OR is_setlist_collaborator(auth.uid(), setlist_id));

DROP POLICY IF EXISTS "Slots updatable by owner or collaborator" ON public.setlist_slots;
CREATE POLICY "Slots updatable by owner or collaborator" ON public.setlist_slots FOR UPDATE TO authenticated USING (is_setlist_owner(auth.uid(), setlist_id) OR is_setlist_collaborator(auth.uid(), setlist_id));

DROP POLICY IF EXISTS "Slots deletable by owner or collaborator" ON public.setlist_slots;
CREATE POLICY "Slots deletable by owner or collaborator" ON public.setlist_slots FOR DELETE TO authenticated USING (is_setlist_owner(auth.uid(), setlist_id) OR is_setlist_collaborator(auth.uid(), setlist_id));

-- Tighten collaborators write policies
DROP POLICY IF EXISTS "Can join shared setlists or owner can add" ON public.collaborators;
CREATE POLICY "Can join shared setlists or owner can add" ON public.collaborators FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id) AND (setlist_has_share_token(setlist_id) OR is_setlist_owner(auth.uid(), setlist_id)));

DROP POLICY IF EXISTS "Setlist owners can remove collaborators" ON public.collaborators;
CREATE POLICY "Setlist owners can remove collaborators" ON public.collaborators FOR DELETE TO authenticated USING (is_setlist_owner(auth.uid(), setlist_id));

-- Tighten chat_messages write policies
DROP POLICY IF EXISTS "Chat insertable by setlist participants" ON public.chat_messages;
CREATE POLICY "Chat insertable by setlist participants" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id) AND (is_setlist_owner(auth.uid(), setlist_id) OR is_setlist_collaborator(auth.uid(), setlist_id)));

-- Tighten profiles INSERT policy
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
