-- Lovable security scan finding: the insider_* INSERT policies used
-- WITH CHECK (true), letting any caller attribute a bug report, share, or
-- wishlist submission to an arbitrary user's UUID. Submissions must be
-- anonymous (user_id IS NULL) or self-attributed. The Backstage client
-- already inserts user_id = auth.uid() or null, so nothing breaks.

DROP POLICY "Anyone can submit a bug" ON public.insider_bugs;
CREATE POLICY "Anyone can submit a bug"
ON public.insider_bugs FOR INSERT TO anon, authenticated
WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

DROP POLICY "Anyone can submit a share" ON public.insider_shares;
CREATE POLICY "Anyone can submit a share"
ON public.insider_shares FOR INSERT TO anon, authenticated
WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

DROP POLICY "Anyone can submit a wish" ON public.insider_wishlist;
CREATE POLICY "Anyone can submit a wish"
ON public.insider_wishlist FOR INSERT TO anon, authenticated
WITH CHECK (user_id IS NULL OR auth.uid() = user_id);
