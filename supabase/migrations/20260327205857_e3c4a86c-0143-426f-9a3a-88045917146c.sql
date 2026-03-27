CREATE POLICY "Profiles viewable by everyone"
ON public.profiles
FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS "Profiles viewable by authenticated users" ON public.profiles;