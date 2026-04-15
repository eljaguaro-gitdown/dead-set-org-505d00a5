ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS users_ordered;
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_user_one_user_two_key;

ALTER TABLE public.conversations
ADD CONSTRAINT conversations_direct_users_ordered_check
CHECK (
  is_group = true
  OR user_one < user_two
);

CREATE UNIQUE INDEX IF NOT EXISTS conversations_direct_pair_unique_idx
ON public.conversations (user_one, user_two)
WHERE is_group = false;