-- RLS hardening ahead of open-sourcing the repo. Once the schema is public,
-- policy shape is the only wall — these close the holes a reader could exploit.

-- 1) conversation_members: the INSERT policy's `auth.uid() = user_id` branch
--    let ANY authenticated user add themselves to ANY conversation, unlocking
--    SELECT on that thread's direct_messages. Only existing members may add
--    rows, except the very first member of a brand-new conversation. DM
--    creation uses the SECURITY DEFINER ensure_dm_conversation and is
--    unaffected.
DROP POLICY "Members can add to conversations" ON public.conversation_members;
CREATE POLICY "Members can add to conversations"
ON public.conversation_members FOR INSERT TO authenticated
WITH CHECK (
  public.is_conversation_member(auth.uid(), conversation_id)
  OR NOT EXISTS (
    SELECT 1 FROM public.conversation_members m
    WHERE m.conversation_id = conversation_members.conversation_id
  )
);

-- 2) get_admin_traffic_stats: SECURITY DEFINER granted to authenticated but
--    had no role check, exposing site-wide traffic numbers to any signed-in
--    user. Admins only.
CREATE OR REPLACE FUNCTION public.get_admin_traffic_stats()
 RETURNS TABLE(total_page_views bigint, total_unique bigint, unique_24h bigint, unique_7d bigint, unique_30d bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.admin_traffic_stats_cache WHERE id = 1) THEN
    -- First-ever call: seed synchronously so admins get real numbers.
    PERFORM public.refresh_admin_traffic_stats();
  END IF;

  RETURN QUERY
    SELECT c.total_page_views, c.total_unique, c.unique_24h, c.unique_7d, c.unique_30d
      FROM public.admin_traffic_stats_cache c
      WHERE c.id = 1;
END;
$function$;

-- 3) increment_upvote_count: blindly incremented any setlist's counter,
--    letting a user inflate activity_score and game the hero spotlight.
--    Recompute from setlist_upvotes instead — idempotent and ungameable
--    (the upvote row itself is RLS-checked).
CREATE OR REPLACE FUNCTION public.increment_upvote_count(_setlist_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE public.setlists
  SET upvote_count = (
    SELECT count(*) FROM public.setlist_upvotes
    WHERE setlist_id = _setlist_id
  )
  WHERE id = _setlist_id;
$function$;
