import { createClient } from 'npm:@supabase/supabase-js@2'
import { POSTHOG_EXTERNAL_TRAFFIC_WHERE, queryPostHog } from '../_shared/posthogQuery.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-visitor-id',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const lovableKey = Deno.env.get('LOVABLE_API_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    const now = new Date()
    const oneWeekAgo = new Date(now.getTime() - 7 * 86400000)
    const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000)

    const weekStart = oneWeekAgo.toISOString().split('T')[0]
    const weekLabel = `Week of ${oneWeekAgo.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`

    // ─── Gather Data ───

    // Users
    const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    const allUsers = users || []
    const totalUsers = allUsers.length
    const newThisWeek = allUsers.filter(u => new Date(u.created_at) >= oneWeekAgo)
    const newPrevWeek = allUsers.filter(u => {
      const d = new Date(u.created_at)
      return d >= twoWeeksAgo && d < oneWeekAgo
    })

    // Setlists
    const { count: totalSetlists } = await supabase
      .from('setlists').select('*', { count: 'exact', head: true })

    const { count: newSetlistsThisWeek } = await supabase
      .from('setlists').select('*', { count: 'exact', head: true })
      .gte('created_at', oneWeekAgo.toISOString())

    const { count: prevWeekSetlists } = await supabase
      .from('setlists').select('*', { count: 'exact', head: true })
      .gte('created_at', twoWeeksAgo.toISOString())
      .lt('created_at', oneWeekAgo.toISOString())

    // Traffic — from PostHog, not page_visits.
    //
    // page_visits has no hostname and no notion of "internal", so every Lovable
    // editor/preview reload and every admin session counted as a visitor. On
    // the Sep 23, 2026 spike that was ~25 of 35 "visitors". PostHog can filter
    // all three (preview host, internal cohort, bots) — see
    // POSTHOG_EXTERNAL_TRAFFIC_WHERE. PostHog capture started 2026-09-18, so
    // there is no history before that.
    //
    // If PostHog is unreachable the traffic fields go out as null and the
    // email says so, rather than silently falling back to the inflated table.
    const trafficRows = await queryPostHog<{
      unique7d: number; prevWeekVisitors: number; unique30d: number; pageViews7d: number
    }>('weekly-insights traffic totals', `
      SELECT
        uniqIf(person_id, timestamp >= now() - INTERVAL 7 DAY) AS unique7d,
        uniqIf(person_id, timestamp < now() - INTERVAL 7 DAY AND timestamp >= now() - INTERVAL 14 DAY) AS prevWeekVisitors,
        uniq(person_id) AS unique30d,
        countIf(timestamp >= now() - INTERVAL 7 DAY) AS pageViews7d
      FROM events
      WHERE event = '$pageview'
        AND timestamp >= now() - INTERVAL 30 DAY
        AND ${POSTHOG_EXTERNAL_TRAFFIC_WHERE}`)
    const traffic = trafficRows?.[0] ?? null

    const topPageRows = await queryPostHog<{ path: string; count: number }>('weekly-insights top pages', `
      SELECT
        replaceRegexpAll(properties.$pathname, '/[0-9a-fA-F-]{8,}.*$', '/:id') AS path,
        count() AS count
      FROM events
      WHERE event = '$pageview'
        AND timestamp >= now() - INTERVAL 7 DAY
        AND ${POSTHOG_EXTERNAL_TRAFFIC_WHERE}
      GROUP BY path
      ORDER BY count DESC
      LIMIT 5`)
    const topPages = topPageRows ?? []

    const unique7d = traffic?.unique7d ?? null
    const prevWeekVisitors = traffic?.prevWeekVisitors ?? null
    const unique30d = traffic?.unique30d ?? null
    const pageViews7d = traffic?.pageViews7d ?? null

    // Auth provider breakdown
    const providerCounts = new Map<string, number>()
    for (const u of allUsers) {
      const p = u.app_metadata?.provider || 'email'
      providerCounts.set(p, (providerCounts.get(p) || 0) + 1)
    }
    const providerBreakdown = [...providerCounts.entries()]
      .map(([provider, count]) => `${provider}: ${count}`)
      .join(', ')

    // Shares this week.
    //
    // share_events is not only shares. trackCtaClick() writes landing-page and
    // poster CTA button clicks into the same table with share_type
    // 'cta_click', and they outnumber real shares roughly 2:1 — 238 of 372
    // rows at the time of writing. Counting the table unfiltered inflated this
    // number in every weekly report since 2026-04-23, and the inflated figure
    // was also fed to the model that writes the analysis paragraph.
    //
    // Excluded by name rather than allow-listed: a genuinely new share channel
    // should start counting the day it ships, without anyone remembering to
    // add it here. A new NON-share event type is the case that needs a thought,
    // and that thought belongs at the write site.
    const { count: sharesThisWeek } = await supabase
      .from('share_events').select('*', { count: 'exact', head: true })
      .neq('share_type', 'cta_click')
      .gte('created_at', oneWeekAgo.toISOString())

    // ─── AI Analysis ───
    const dataSnapshot = {
      weekLabel,
      totalUsers,
      newUsersThisWeek: newThisWeek.length,
      prevWeekNewUsers: newPrevWeek.length,
      totalSetlists: totalSetlists || 0,
      newSetlistsThisWeek: newSetlistsThisWeek || 0,
      prevWeekSetlists: prevWeekSetlists || 0,
      trafficSource: traffic
        ? 'PostHog; production host only, internal/test accounts and bots excluded; capture began 2026-09-18'
        : 'UNAVAILABLE this week (PostHog query failed) — do not comment on traffic',
      unique7d,
      prevWeekVisitors,
      unique30d,
      pageViews7d,
      topPages,
      providerBreakdown,
      sharesThisWeek: sharesThisWeek || 0,
      setlistsPerUser: totalUsers > 0 ? ((totalSetlists || 0) / totalUsers).toFixed(1) : '0',
    }

    const aiPrompt = `You are an analytics advisor for "Dead Set," a community app where Grateful Dead fans build dream setlists. Analyze this week's data and provide:

1. A concise 2-3 sentence analysis paragraph identifying the most important trends, patterns, or changes.
2. Exactly 3 actionable product recommendations based on the data.

Data:
${JSON.stringify(dataSnapshot, null, 2)}

Respond in valid JSON format:
{
  "analysis": "Your analysis paragraph here.",
  "recommendations": ["Rec 1", "Rec 2", "Rec 3"]
}

Be specific, data-driven, and actionable. Reference actual numbers. If growth is flat, say so honestly and suggest experiments.`

    let aiAnalysis = 'AI analysis unavailable this week.'
    let aiRecommendations: string[] = []

    try {
      const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${lovableKey}`,
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: aiPrompt }],
          temperature: 0.7,
        }),
      })

      if (aiRes.ok) {
        const aiData = await aiRes.json()
        const content = aiData.choices?.[0]?.message?.content || ''
        // Extract JSON from response (may be wrapped in ```json...```)
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          aiAnalysis = parsed.analysis || aiAnalysis
          aiRecommendations = parsed.recommendations || []
        }
      }
    } catch (e) {
      console.error('AI analysis failed:', e)
    }

    // ─── Send Email ───
    const { error } = await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'weekly-insights',
        recipientEmail: Deno.env.get('ADMIN_REPORT_EMAIL'),
        idempotencyKey: `weekly-insights-${weekStart}`,
        templateData: {
          weekLabel,
          totalUsers,
          newUsersThisWeek: newThisWeek.length,
          totalSetlists: totalSetlists || 0,
          newSetlistsThisWeek: newSetlistsThisWeek || 0,
          unique7d,
          unique30d,
          pageViews7d,
          topPages,
          prevWeekUsers: newPrevWeek.length,
          prevWeekSetlists: prevWeekSetlists || 0,
          prevWeekVisitors,
          aiAnalysis,
          aiRecommendations,
        },
      },
    })

    if (error) {
      console.error('Failed to send weekly report', error)
      return new Response(JSON.stringify({ error: 'Failed to send report' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, weekLabel }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    console.error('Weekly report error:', e)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
