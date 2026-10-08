// The PostHog query call itself. queryPostHog (./posthogQuery.ts) reads the
// secrets from Deno.env and calls this; it is kept free of Deno APIs so the
// app's Vitest suite can run it rather than grep it.
//
// Returns null — never throws — when the secrets are missing, the query fails,
// or PostHog does not answer within the timeout.
//
// The timeout exists because admin-users awaits a query inside the same
// Promise.all that loads the user list. Without one, a PostHog that never
// answered held the whole admin dashboard (the user table, the relay monitor,
// the Beta Nudge recipient list) until the platform killed the function. With
// it, the fetch aborts, the catch returns null, and the traffic tiles show "—".

export const POSTHOG_QUERY_TIMEOUT_MS = 10_000

export interface PostHogQueryConfig {
  apiKey: string | undefined
  projectId: string | undefined
  /** App host, not the ingest host. Defaults to US cloud. */
  host: string | undefined
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

export const runPostHogQuery = async <Row extends Record<string, unknown>>(
  name: string,
  sql: string,
  config: PostHogQueryConfig,
): Promise<Row[] | null> => {
  const { apiKey, projectId } = config
  const host = (config.host || 'https://us.posthog.com').replace(/\/$/, '')
  const doFetch = config.fetchImpl ?? fetch

  if (!apiKey || !projectId) {
    console.error('PostHog read environment is missing (POSTHOG_PERSONAL_API_KEY / POSTHOG_PROJECT_ID); query skipped:', name)
    return null
  }

  // A controller and a timer rather than AbortSignal.timeout, which not every
  // runtime has; where it is missing, the call would throw inside the try below
  // and every query would quietly come back null. The timer runs until the body
  // has been read, because the signal aborts the response stream as well.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.timeoutMs ?? POSTHOG_QUERY_TIMEOUT_MS)

  try {
    const res = await doFetch(`${host}/api/projects/${projectId}/query/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query: { kind: 'HogQLQuery', query: sql }, name }),
      signal: controller.signal,
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
  } finally {
    clearTimeout(timer)
  }
}
