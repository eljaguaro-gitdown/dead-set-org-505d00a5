
CREATE TABLE public.play_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  visitor_id TEXT,
  setlist_id UUID,
  slot_id UUID,
  song_id UUID,
  archive_url TEXT,
  song_title TEXT,
  show_date TEXT,
  venue TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_played_ms INTEGER NOT NULL DEFAULT 0,
  track_duration_ms INTEGER,
  completed BOOLEAN NOT NULL DEFAULT false,
  ended_reason TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (ended_reason IN ('in_progress','finished','skipped','paused','navigated_away','error')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_play_events_user ON public.play_events(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_play_events_visitor ON public.play_events(visitor_id) WHERE visitor_id IS NOT NULL;
CREATE INDEX idx_play_events_setlist ON public.play_events(setlist_id);
CREATE INDEX idx_play_events_song ON public.play_events(song_id);
CREATE INDEX idx_play_events_started_at ON public.play_events(started_at DESC);

ALTER TABLE public.play_events ENABLE ROW LEVEL SECURITY;

-- Anyone can record their own play start (signed-in or anonymous)
CREATE POLICY "Anyone can record play events"
ON public.play_events FOR INSERT
TO anon, authenticated
WITH CHECK (
  (auth.uid() IS NOT NULL AND user_id = auth.uid())
  OR (auth.uid() IS NULL AND user_id IS NULL AND visitor_id IS NOT NULL)
);

-- Listener can update their own event to record end state
CREATE POLICY "Listeners can update own play events"
ON public.play_events FOR UPDATE
TO anon, authenticated
USING (
  (auth.uid() IS NOT NULL AND user_id = auth.uid())
  OR (
    auth.uid() IS NULL
    AND user_id IS NULL
    AND visitor_id IS NOT NULL
    AND visitor_id = ((current_setting('request.headers', true))::json ->> 'x-visitor-id')
  )
)
WITH CHECK (
  (auth.uid() IS NOT NULL AND user_id = auth.uid())
  OR (
    auth.uid() IS NULL
    AND user_id IS NULL
    AND visitor_id IS NOT NULL
    AND visitor_id = ((current_setting('request.headers', true))::json ->> 'x-visitor-id')
  )
);

-- Admins can read all events for reporting
CREATE POLICY "Admins can read play events"
ON public.play_events FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
