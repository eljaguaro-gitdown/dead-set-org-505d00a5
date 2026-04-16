
CREATE OR REPLACE FUNCTION public.mark_ab_conversion(p_visitor_id text, p_user_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.ab_test_assignments
  SET converted = true, user_id = COALESCE(p_user_id, user_id)
  WHERE visitor_id = p_visitor_id
    AND test_name = 'landing_vs_autostart'
    AND converted = false;
END;
$$;
