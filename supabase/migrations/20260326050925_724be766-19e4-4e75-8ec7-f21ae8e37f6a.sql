-- Replace public profiles SELECT with authenticated-only
DROP POLICY "Profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Profiles viewable by authenticated users"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);
