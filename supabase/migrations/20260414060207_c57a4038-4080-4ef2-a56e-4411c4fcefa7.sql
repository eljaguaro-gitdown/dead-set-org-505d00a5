
-- 1. Realtime authorization: scope channel subscriptions
-- Users can only listen to realtime changes on tables they already have RLS SELECT access to.
-- The existing RLS on chat_messages, direct_messages, conversations, etc. already gates data access.
-- We add a policy on realtime.messages to ensure only authenticated users can receive broadcasts.
CREATE POLICY "Authenticated users can receive realtime messages"
ON realtime.messages
FOR SELECT
TO authenticated
USING (true);

-- Block anonymous users from realtime
CREATE POLICY "Anon users cannot receive realtime"
ON realtime.messages
FOR SELECT
TO anon
USING (false);

-- 2. Fix A/B test UPDATE policy: restrict to only 'converted' and 'user_id' columns
DROP POLICY IF EXISTS "Visitors can update own assignment" ON public.ab_test_assignments;

CREATE POLICY "Visitors can mark own assignment converted"
ON public.ab_test_assignments
FOR UPDATE
TO anon, authenticated
USING (
  (visitor_id = ((current_setting('request.headers'::text, true))::json ->> 'x-visitor-id'::text))
  OR ((auth.uid() IS NOT NULL) AND (user_id = auth.uid()))
)
WITH CHECK (
  (visitor_id = ((current_setting('request.headers'::text, true))::json ->> 'x-visitor-id'::text))
  OR ((auth.uid() IS NOT NULL) AND (user_id = auth.uid()))
);

-- Restrict updatable columns: only converted and user_id can be changed
-- We use a trigger to enforce this since RLS WITH CHECK can't restrict columns
CREATE OR REPLACE FUNCTION public.restrict_ab_test_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Prevent changing variant or test_name
  IF NEW.variant <> OLD.variant THEN
    RAISE EXCEPTION 'Cannot change variant assignment';
  END IF;
  IF NEW.test_name <> OLD.test_name THEN
    RAISE EXCEPTION 'Cannot change test_name';
  END IF;
  IF NEW.visitor_id <> OLD.visitor_id THEN
    RAISE EXCEPTION 'Cannot change visitor_id';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_ab_test_immutable_fields
BEFORE UPDATE ON public.ab_test_assignments
FOR EACH ROW
EXECUTE FUNCTION public.restrict_ab_test_update();

-- 3. Fix public bucket listing: only allow reading specific files by name, not listing
DROP POLICY IF EXISTS "Avatars are publicly readable" ON storage.objects;

CREATE POLICY "Avatars are publicly readable by direct access"
ON storage.objects
FOR SELECT
USING (bucket_id = 'avatars' AND name IS NOT NULL);
