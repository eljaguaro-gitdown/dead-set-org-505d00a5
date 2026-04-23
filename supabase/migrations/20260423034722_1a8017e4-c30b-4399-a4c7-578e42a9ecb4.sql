DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'setlists'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.setlists;
  END IF;
END $$;