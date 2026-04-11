
-- Add user_id to insider tables (nullable to preserve anonymous submissions)
ALTER TABLE public.insider_wishlist ADD COLUMN user_id uuid;
ALTER TABLE public.insider_bugs ADD COLUMN user_id uuid;
ALTER TABLE public.insider_shares ADD COLUMN user_id uuid;
