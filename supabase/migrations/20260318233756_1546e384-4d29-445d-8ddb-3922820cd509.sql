
-- Chat messages for setlist collaboration
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setlist_id UUID NOT NULL REFERENCES public.setlists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Chat messages viewable by setlist owner and collaborators
CREATE POLICY "Chat viewable by setlist participants" ON public.chat_messages FOR SELECT USING (
  setlist_id IN (SELECT id FROM public.setlists WHERE creator_id = auth.uid())
  OR setlist_id IN (SELECT setlist_id FROM public.collaborators WHERE user_id = auth.uid())
);

CREATE POLICY "Chat insertable by setlist participants" ON public.chat_messages FOR INSERT WITH CHECK (
  auth.uid() = user_id AND (
    setlist_id IN (SELECT id FROM public.setlists WHERE creator_id = auth.uid())
    OR setlist_id IN (SELECT setlist_id FROM public.collaborators WHERE user_id = auth.uid())
  )
);

-- Enable realtime for chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- Also allow collaborators to update setlists they collaborate on
CREATE POLICY "Collaborators can update setlists" ON public.setlists FOR UPDATE USING (
  id IN (SELECT setlist_id FROM public.collaborators WHERE user_id = auth.uid() AND role IN ('owner', 'editor'))
);
