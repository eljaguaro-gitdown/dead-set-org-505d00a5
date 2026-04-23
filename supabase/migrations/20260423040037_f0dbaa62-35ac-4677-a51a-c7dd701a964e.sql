DROP POLICY IF EXISTS "Users can view own favorite songs" ON public.favorite_songs;
DROP POLICY IF EXISTS "Users can add own favorite songs" ON public.favorite_songs;
DROP POLICY IF EXISTS "Users can delete own favorite songs" ON public.favorite_songs;
DROP POLICY IF EXISTS "Users can update own favorite songs" ON public.favorite_songs;

CREATE POLICY "Users can view own favorite songs"
ON public.favorite_songs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can add own favorite songs"
ON public.favorite_songs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own favorite songs"
ON public.favorite_songs
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorite songs"
ON public.favorite_songs
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own favorite song setlist link" ON public.favorite_song_setlists;
DROP POLICY IF EXISTS "Users can add own favorite song setlist link" ON public.favorite_song_setlists;
DROP POLICY IF EXISTS "Users can delete own favorite song setlist link" ON public.favorite_song_setlists;
DROP POLICY IF EXISTS "Users can update own favorite song setlist link" ON public.favorite_song_setlists;

CREATE POLICY "Users can view own favorite song setlist link"
ON public.favorite_song_setlists
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can add own favorite song setlist link"
ON public.favorite_song_setlists
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own favorite song setlist link"
ON public.favorite_song_setlists
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorite song setlist link"
ON public.favorite_song_setlists
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);