REVOKE ALL ON FUNCTION public.send_featured_setlist_email_today() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_featured_setlist_email_today() TO service_role, postgres;