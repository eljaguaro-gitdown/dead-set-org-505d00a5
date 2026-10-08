// Read-side PostHog access for server reports.
//
// Capture (write) uses the public project token in ./posthog.ts. Reading needs
// a *personal* API key with the "Query: Read" scope — the project token cannot
// read anything. Both are separate secrets on purpose.
//
//   POSTHOG_PERSONAL_API_KEY  personal API key, Query: Read only
//   POSTHOG_PROJECT_ID        numeric project id (Dead-Set.Org = 617063)
//   POSTHOG_API_HOST          app host, not the ingest host; defaults to US cloud
//
// Returns null — never throws — when the secrets are missing, the query
// fails, or PostHog does not answer within 10 seconds, so a report can say
// "traffic unavailable" instead of dying.

import { runPostHogQuery } from './runPostHogQuery.ts'

// Filters every traffic number in a report should share. page_visits could not
// apply them, which is why it is no longer the traffic source: it counted
// Lovable editor/preview reloads and admin sessions as visitors (Sep 23, 2026:
// ~25 of 35 "visitors" in the spike window were preview reloads).
//
//   - production host only (excludes id-preview--*.lovable.app and localhost)
//   - PostHog's "Internal / Test users" cohort (id 579554) excluded
//   - PostHog-detected bots excluded
export const POSTHOG_EXTERNAL_TRAFFIC_WHERE = `
  properties.$host IN ('dead-set.org', 'www.dead-set.org')
  AND person_id NOT IN COHORT 579554
  AND NOT coalesce(properties.$virt_is_bot, false)`

// The call itself, with its timeout, lives in ./runPostHogQuery.ts so the
// Vitest suite can run it; this only supplies the secrets.
export const queryPostHog = <Row extends Record<string, unknown>>(
  name: string,
  sql: string,
): Promise<Row[] | null> =>
  runPostHogQuery<Row>(name, sql, {
    apiKey: Deno.env.get('POSTHOG_PERSONAL_API_KEY'),
    projectId: Deno.env.get('POSTHOG_PROJECT_ID'),
    host: Deno.env.get('POSTHOG_API_HOST'),
  })
