-- Enforce the email idempotency contract that every producer already assumed.
--
-- APPLIED MANUALLY on 2026-10-05 via the Lovable query_database tool against
-- the production database. Recorded here for provenance and for a future
-- rebuild; it is idempotent (IF NOT EXISTS / OR REPLACE) and safe to replay.
--
-- WHY
-- Every email producer in this codebase passes an `idempotencyKey`, and until
-- now NOTHING ever checked one. `send-transactional-email` read the key,
-- copied it into the queue payload, and forwarded it to the send API as inert
-- metadata. No SELECT, no unique constraint, no dedupe — the key was
-- decorative. Four flows depend on the guarantee it implies:
--     welcome-<user_id>
--     new-signup-notify-<user_id>-<admin_address>
--     featured-setlist-<date>-<setlist_id>
--     moderation-report-<report_id>-<admin_address>
--
-- The signup path fires from three independent places ON PURPOSE -- the
-- handle_new_user_emails trigger, the useAuth client backfill, and AuthModal
-- -- so that a missing vault secret or a pg_net hiccup cannot leave a new
-- Deadhead with no welcome and no admin ping. That redundancy is correct and
-- deliberate; useAuth.ts says so in a comment ("trigger succeeded -> this is
-- a no-op"). The no-op was never implemented.
--
-- Observed 2026-10-05 19:15: one signup produced two welcome emails to the
-- new user and three signup notifications to the admin list, each with a
-- distinct provider message id, two batches four seconds apart.
--
-- DESIGN
-- The claim is one atomic INSERT ... ON CONFLICT DO NOTHING. Two paths racing
-- -- four seconds apart here, but simultaneous is possible -- cannot both
-- win, because the primary key arbitrates in postgres rather than in the
-- application. A claim returns true exactly once per key, ever.

create table if not exists public.email_idempotency (
  idempotency_key text primary key,
  claimed_at      timestamptz not null default now(),
  template_name   text,
  recipient_email text
);

comment on table public.email_idempotency is
  'One row per email claimed for sending. Written only by claim_email_idempotency() before enqueue. A key already present means another path already sent this exact message and the caller must skip.';

alter table public.email_idempotency enable row level security;

-- Deliberately no RLS policies. This table is written only by the
-- SECURITY DEFINER function below and read by nobody; the service role
-- bypasses RLS. Policy-less + RLS-on means anon/authenticated see nothing.

create index if not exists email_idempotency_claimed_at_idx
  on public.email_idempotency (claimed_at desc);

create or replace function public.claim_email_idempotency(
  _key             text,
  _template_name   text default null,
  _recipient_email text default null
) returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- No key means the caller is not asking for dedupe. Always allow, and do
  -- not store a row -- otherwise every keyless email would leave litter.
  if _key is null or length(_key) = 0 then
    return true;
  end if;

  insert into public.email_idempotency (idempotency_key, template_name, recipient_email)
  values (_key, _template_name, _recipient_email)
  on conflict (idempotency_key) do nothing;

  -- FOUND is false when ON CONFLICT swallowed the insert, which means another
  -- caller already holds this key. True means this caller claimed it and is
  -- the one allowed to send.
  return found;
end;
$function$;

revoke all on function public.claim_email_idempotency(text, text, text) from public;
revoke all on function public.claim_email_idempotency(text, text, text) from anon;
revoke all on function public.claim_email_idempotency(text, text, text) from authenticated;
grant execute on function public.claim_email_idempotency(text, text, text) to service_role;
