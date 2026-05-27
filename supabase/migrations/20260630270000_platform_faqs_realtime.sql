-- Let open contact pages refresh automatically when admins update FAQs.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'platform_faqs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_faqs;
  END IF;
END;
$$;
