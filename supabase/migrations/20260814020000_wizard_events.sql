-- Cosmic Charlie wizard funnel telemetry.
-- Answers questions like "how many people opened the wizard today",
-- "which priorities got picked", "what % who opened it made it to generate".
-- Mirrors the pattern used by auth_events (see 20260807...) and share_events:
-- anon INSERTs allowed with a visitor_id or user_id; no SELECT policy means
-- only service-role reads (analytics). Never blocks UX — client wraps in try/catch.

create table if not exists public.wizard_events (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  event_name   text not null check (event_name in (
                 'wizard_opened',
                 'priority_selected',
                 'generate_clicked'
               )),
  mode         text check (mode in ('build', 'improve', 'explore')),
  priority_id  text,
  vibe_ids     text[],
  visitor_id   text,
  user_id      uuid references auth.users(id) on delete set null,
  metadata     jsonb
);

create index if not exists idx_wizard_events_created_at
  on public.wizard_events (created_at desc);
create index if not exists idx_wizard_events_event_created
  on public.wizard_events (event_name, created_at desc);
create index if not exists idx_wizard_events_priority
  on public.wizard_events (priority_id)
  where priority_id is not null;

alter table public.wizard_events enable row level security;

create policy "wizard_events_insert_anyone"
  on public.wizard_events for insert
  to anon, authenticated
  with check (true);
