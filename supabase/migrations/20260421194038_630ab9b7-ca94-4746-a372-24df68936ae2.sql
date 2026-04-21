-- 1. Notifications table
CREATE TABLE public.comment_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_user_id UUID NOT NULL,
  setlist_id UUID NOT NULL REFERENCES public.setlists(id) ON DELETE CASCADE,
  comment_id UUID NOT NULL REFERENCES public.setlist_comments(id) ON DELETE CASCADE,
  commenter_user_id UUID NOT NULL,
  commenter_name TEXT,
  setlist_title TEXT,
  preview TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_comment_notifications_recipient ON public.comment_notifications(recipient_user_id, created_at DESC);

ALTER TABLE public.comment_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recipients view own notifications"
  ON public.comment_notifications FOR SELECT TO authenticated
  USING (recipient_user_id = auth.uid());

CREATE POLICY "Recipients update own notifications"
  ON public.comment_notifications FOR UPDATE TO authenticated
  USING (recipient_user_id = auth.uid());

CREATE POLICY "Recipients delete own notifications"
  ON public.comment_notifications FOR DELETE TO authenticated
  USING (recipient_user_id = auth.uid());

-- 2. Trigger: auto-create notification on new comment
CREATE OR REPLACE FUNCTION public.handle_new_setlist_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_title TEXT;
  v_commenter_name TEXT;
BEGIN
  SELECT creator_id, title INTO v_owner_id, v_title
  FROM public.setlists WHERE id = NEW.setlist_id;

  -- Don't notify owner of their own comments
  IF v_owner_id IS NULL OR v_owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT display_name INTO v_commenter_name
  FROM public.profiles WHERE user_id = NEW.user_id;

  INSERT INTO public.comment_notifications (
    recipient_user_id, setlist_id, comment_id,
    commenter_user_id, commenter_name, setlist_title, preview
  ) VALUES (
    v_owner_id, NEW.setlist_id, NEW.id,
    NEW.user_id, COALESCE(v_commenter_name, 'A Deadhead'),
    COALESCE(v_title, 'your setlist'),
    LEFT(NEW.content, 200)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_setlist_comment
AFTER INSERT ON public.setlist_comments
FOR EACH ROW EXECUTE FUNCTION public.handle_new_setlist_comment();

-- 3. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_notifications;