
-- Helper: ensure a 1-on-1 conversation between two users and return its id.
CREATE OR REPLACE FUNCTION public.ensure_dm_conversation(_user_a uuid, _user_b uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_u1 uuid;
  v_u2 uuid;
  v_conv_id uuid;
BEGIN
  IF _user_a IS NULL OR _user_b IS NULL OR _user_a = _user_b THEN
    RETURN NULL;
  END IF;

  IF _user_a < _user_b THEN
    v_u1 := _user_a; v_u2 := _user_b;
  ELSE
    v_u1 := _user_b; v_u2 := _user_a;
  END IF;

  SELECT id INTO v_conv_id
  FROM public.conversations
  WHERE user_one = v_u1 AND user_two = v_u2 AND is_group = false
  LIMIT 1;

  IF v_conv_id IS NULL THEN
    v_conv_id := gen_random_uuid();
    INSERT INTO public.conversations (id, user_one, user_two, is_group)
    VALUES (v_conv_id, v_u1, v_u2, false);
  END IF;

  INSERT INTO public.conversation_members (conversation_id, user_id)
  VALUES (v_conv_id, v_u1)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.conversation_members (conversation_id, user_id)
  VALUES (v_conv_id, v_u2)
  ON CONFLICT DO NOTHING;

  RETURN v_conv_id;
END;
$$;

-- Add unique constraint to support ON CONFLICT for conversation_members
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversation_members_conv_user_unique'
  ) THEN
    ALTER TABLE public.conversation_members
      ADD CONSTRAINT conversation_members_conv_user_unique UNIQUE (conversation_id, user_id);
  END IF;
END $$;

-- Trigger function for upvotes
CREATE OR REPLACE FUNCTION public.notify_setlist_upvote_via_dm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_title text;
  v_actor_name text;
  v_conv uuid;
BEGIN
  SELECT creator_id, title INTO v_owner, v_title
  FROM public.setlists WHERE id = NEW.setlist_id;

  IF v_owner IS NULL OR v_owner = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT display_name INTO v_actor_name
  FROM public.profiles WHERE user_id = NEW.user_id;

  v_conv := public.ensure_dm_conversation(NEW.user_id, v_owner);
  IF v_conv IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.direct_messages (conversation_id, sender_id, content)
  VALUES (
    v_conv,
    NEW.user_id,
    '⬆️ ' || COALESCE(v_actor_name, 'A Deadhead') ||
      ' upvoted your setlist "' || COALESCE(v_title, 'Untitled') || '"'
  );

  UPDATE public.conversations
  SET last_message_at = now()
  WHERE id = v_conv;

  RETURN NEW;
END;
$$;

-- Trigger function for favorites
CREATE OR REPLACE FUNCTION public.notify_setlist_favorite_via_dm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_title text;
  v_actor_name text;
  v_conv uuid;
BEGIN
  SELECT creator_id, title INTO v_owner, v_title
  FROM public.setlists WHERE id = NEW.setlist_id;

  IF v_owner IS NULL OR v_owner = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT display_name INTO v_actor_name
  FROM public.profiles WHERE user_id = NEW.user_id;

  v_conv := public.ensure_dm_conversation(NEW.user_id, v_owner);
  IF v_conv IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.direct_messages (conversation_id, sender_id, content)
  VALUES (
    v_conv,
    NEW.user_id,
    '❤️ ' || COALESCE(v_actor_name, 'A Deadhead') ||
      ' favorited your setlist "' || COALESCE(v_title, 'Untitled') || '"'
  );

  UPDATE public.conversations
  SET last_message_at = now()
  WHERE id = v_conv;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_setlist_upvote_dm ON public.setlist_upvotes;
CREATE TRIGGER trg_notify_setlist_upvote_dm
AFTER INSERT ON public.setlist_upvotes
FOR EACH ROW EXECUTE FUNCTION public.notify_setlist_upvote_via_dm();

DROP TRIGGER IF EXISTS trg_notify_setlist_favorite_dm ON public.favorites;
CREATE TRIGGER trg_notify_setlist_favorite_dm
AFTER INSERT ON public.favorites
FOR EACH ROW EXECUTE FUNCTION public.notify_setlist_favorite_via_dm();
