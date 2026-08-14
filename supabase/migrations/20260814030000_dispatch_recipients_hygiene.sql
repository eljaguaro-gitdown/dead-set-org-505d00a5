-- Tighten dispatch_recipients to exclude suppressed and obvious-test addresses.
--
-- Context: Dispatch 003 (2026-08-13) went to 59 recipients, 3 of which
-- bounced. All 3 were QA test artifacts sitting in the recipient list:
--   - qa-verify-race-test-0713@dead-set-org-qa.test  (RFC 2606 .test TLD)
--   - test_welcome_email_2026@dead-set.org           (nonexistent mailbox)
--   - qa-verify-auth-2026-07-13@example.com          (RFC 2606 example.com)
-- That drove the bounce rate to 5.08%, tripping the ESP's 5% advisory.
--
-- The view previously filtered only dispatch_opt_in and email_confirmed_at;
-- dispatch_opt_in defaults to TRUE at signup, so QA test users with auto-
-- confirmed emails auto-joined the dispatch list. This view now also:
--   1. Excludes anything in suppressed_emails (bounce/complaint/unsubscribe
--      webhook adds rows there — see handle-email-suppression). Also matches
--      the check send-transactional-email already performs at enqueue time.
--   2. Excludes RFC 2606 reserved test TLDs/SLDs (nothing at these accepts
--      mail; sending there is a guaranteed bounce and pure list poison).
--   3. Excludes Dead Set QA harness patterns (qa-verify-*, test_*@dead-set.org,
--      *@dead-set-org-qa.test).
--
-- send-dispatch will start seeing a smaller recipient_count on the next send —
-- that's the point. All 56 real deliveries from Dispatch 003 stand; nothing
-- about opt-in state has changed.

CREATE OR REPLACE VIEW public.dispatch_recipients AS
SELECT
  u.id                          AS user_id,
  u.email,
  p.display_name,
  p.dispatch_unsubscribe_token
FROM auth.users u
JOIN public.profiles p ON p.user_id = u.id
WHERE p.dispatch_opt_in = TRUE
  AND u.email_confirmed_at IS NOT NULL
  -- Excluded if the ESP has ever suppressed this address (bounce/complaint/
  -- unsubscribe). handle-email-suppression populates this on Resend webhook.
  AND NOT EXISTS (
    SELECT 1
    FROM public.suppressed_emails s
    WHERE lower(s.email) = lower(u.email)
  )
  -- Excluded if the address is an obvious QA/test artifact. Belt-and-suspenders
  -- for accounts that haven't bounced yet — first send to a .test TLD or
  -- example.com is a guaranteed bounce that pollutes deliverability math.
  AND NOT (
    -- RFC 2606 reserved TLDs — nothing here accepts mail
    u.email ILIKE '%.test'
    OR u.email ILIKE '%.example'
    OR u.email ILIKE '%.invalid'
    OR u.email ILIKE '%.localhost'
    -- RFC 2606 reserved SLDs
    OR u.email ILIKE '%@example.com'
    OR u.email ILIKE '%@example.org'
    OR u.email ILIKE '%@example.net'
    -- Dead Set QA harness patterns (permanent — see qa-release / auth tests)
    OR u.email ILIKE 'qa-verify-%'
    OR u.email ILIKE 'test\_%@dead-set.org' ESCAPE '\'
    OR u.email ILIKE '%@dead-set-org-qa.test'
  );

-- Re-apply the original access controls (CREATE OR REPLACE preserves grants
-- in most cases, but being explicit here matches the original migration and
-- prevents drift if that behavior ever changes).
REVOKE ALL ON public.dispatch_recipients FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.dispatch_recipients TO service_role;
