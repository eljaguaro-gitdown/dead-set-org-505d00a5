-- Function called from the client right after signup, with the visitor_id from localStorage
CREATE OR REPLACE FUNCTION public.link_visitor_to_user(_visitor_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  IF _visitor_id IS NULL OR length(_visitor_id) = 0 THEN
    RETURN;
  END IF;

  -- Update existing attribution row, or insert a new one tied to this user
  INSERT INTO public.visitor_attribution (visitor_id, user_id, signed_up_at, first_seen_at)
  VALUES (_visitor_id, auth.uid(), now(), now())
  ON CONFLICT (visitor_id) DO UPDATE
    SET user_id = COALESCE(public.visitor_attribution.user_id, EXCLUDED.user_id),
        signed_up_at = COALESCE(public.visitor_attribution.signed_up_at, EXCLUDED.signed_up_at);
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_visitor_to_user(text) TO authenticated;