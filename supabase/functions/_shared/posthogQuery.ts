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
// Returns null — never throws — when the secrets are missing or the query
// fails, so a report can say "traffic unavailable" instead of dying.

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

export const queryPostHog = async <Row extends Record<string, unknown>>(
  name: string,
  sql: string,
): Promise<Row[] | null> => {
  const apiKey = Deno.env.get('POSTHOG_PERSONAL_API_KEY')
  const projectId = Deno.env.get('POSTHOG_PROJECT_ID')
  const host = (Deno.env.get('POSTHOG_API_HOST') || 'https://us.posthog.com').replace(/\/$/, '')

  if (!apiKey || !projectId) {
    console.error('PostHog read environment is missing (POSTHOG_PERSONAL_API_KEY / POSTHOG_PROJECT_ID); query skipped:', name)
    return null
  }

  try {
    const res = await fetch(`${host}/api/projects/${projectId}/query/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query: { kind: 'HogQLQuery', query: sql }, name }),
    })
    if (!res.ok) {
      console.error(`PostHog query "${name}" failed: ${res.status} ${await res.text()}`)
      return null
    }
    const body = await res.json()
    const columns: string[] = body.columns || []
    const results: unknown[][] = body.results || []
    return results.map((r) => Object.fromEntries(columns.map((c, i) => [c, r[i]])) as Row)
  } catch (e) {
    console.error(`PostHog query "${name}" threw:`, e instanceof Error ? e.message : e)
    return null
  }
}
