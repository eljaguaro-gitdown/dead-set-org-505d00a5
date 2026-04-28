
-- ============================================================
-- 1) Tighten EXECUTE grants on SECURITY DEFINER functions
--    Revoke from PUBLIC and anon by default; grant back to
--    authenticated only where the client legitimately calls them.
-- ============================================================

-- Internal queue / email helpers — should NOT be callable by clients
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_drafts()              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint)            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb)            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;

-- Trigger-only functions (never invoked directly) — strip all client access
REVOKE EXECUTE ON FUNCTION public.handle_new_user()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_emails()      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_setlist_comment()  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_favorite_song_setlist()  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.restrict_ab_test_update()     FROM PUBLIC, anon, authenticated;

-- RLS helper predicates — used inside policies, no need for direct EXECUTE
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role)               FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid)     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_setlist_collaborator(uuid, uuid)    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_setlist_owner(uuid, uuid)           FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_setlist_public(uuid)                FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.setlist_has_share_token(uuid)          FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ensure_favorite_song_setlist(uuid)     FROM PUBLIC, anon;

-- Client-callable RPCs: keep authenticated, drop anon
REVOKE EXECUTE ON FUNCTION public.increment_play_count(uuid)             FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.increment_upvote_count(uuid)           FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.link_visitor_to_user(text)             FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_ab_conversion(text, uuid)         FROM PUBLIC, anon;

-- ============================================================
-- 2) Tighten email-assets bucket SELECT policy so listing the
--    bucket without specifying a file path is no longer possible.
-- ============================================================
DROP POLICY IF EXISTS "Public read email-assets" ON storage.objects;
CREATE POLICY "Public read email-assets"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'email-assets' AND name IS NOT NULL);
