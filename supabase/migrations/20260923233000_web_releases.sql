-- ============================================================================
-- web_releases — one row per web publish of dead-set.org.
--
-- The landing footer says "Updated N times this week". It used to count Build
-- Notes entries, which stopped in April, so the claim either lied (counting an
-- April week as "this week") or vanished. A release is the thing fans actually
-- receive, so the footer now counts these rows.
--
-- Rows are written by whoever runs the release pass, after confirming the live
-- site serves the commit (docs/RELEASING.md, "Record it"). Merges are not
-- releases: nothing is written on merge.
-- ============================================================================

create table if not exists public.web_releases (
  id           uuid primary key default gen_random_uuid(),
  commit_sha   text not null check (commit_sha ~ '^[0-9a-f]{40}$'),
  published_at timestamptz not null default now(),
  note         text
);

comment on table public.web_releases is
  'One row per web publish, recorded after the live site is confirmed to serve commit_sha. Read by the landing footer.';

create index if not exists web_releases_published_at_idx
  on public.web_releases (published_at desc);

alter table public.web_releases enable row level security;

drop policy if exists "Web releases are viewable by everyone" on public.web_releases;
create policy "Web releases are viewable by everyone"
  on public.web_releases
  for select
  using (true);

drop policy if exists "Admins can record web releases" on public.web_releases;
create policy "Admins can record web releases"
  on public.web_releases
  for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

-- The three publishes of 2026-09-23, each confirmed live by the sha stamped
-- in the served bundle. Times are when each was first observed live, not the
-- moment Publish was pressed. Earlier publishes left no record.
insert into public.web_releases (commit_sha, published_at, note)
select * from (values
  ('0353397036573753545ee58a2dc268b58f583a23', timestamptz '2026-09-23 23:01:26+00', 'Caught the web up to TestFlight build 27'),
  ('2a94e45de837419b9b331502a3303a6610ee3293', timestamptz '2026-09-23 23:17:06+00', 'Collaborator link fix; build-sha fallback'),
  ('f89a90bfe63c6883d87d3d4af32dae9d3ac6dd4c', timestamptz '2026-09-23 23:22:36+00', 'Footer badge no longer counts an April week')
) as seed(commit_sha, published_at, note)
where not exists (select 1 from public.web_releases);
