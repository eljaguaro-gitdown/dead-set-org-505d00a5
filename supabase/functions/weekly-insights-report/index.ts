import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Traffic - this week
    const { data: visitors7d } = await supabase
      .from('page_visits').select('visitor_id')
      .gte('created_at', oneWeekAgo.toISOString())
    const unique7d = new Set((visitors7d || []).map(v => v.visitor_id)).size

    // Traffic - prev week
    const { data: visitorsPrev } = await supabase
      .from('page_visits').select('visitor_id')
      .gte('created_at', twoWeeksAgo.toISOString())
      .lt('created_at', oneWeekAgo.toISOString())
    const prevWeekVisitors = new Set((visitorsPrev || []).map(v => v.visitor_id)).size

    // 30d visitors
    const { data: visitors30d } = await supabase
      .from('page_visits').select('visitor_id')
      .gte('created_at', thirtyDaysAgo.toISOString())
    const unique30d = new Set((visitors30d || []).map(v => v.visitor_id)).size

    // Total page views
    const { count: totalPageViews } = await supabase
      .from('page_visits').select('*', { count: 'exact', head: true })

    // Top pages this week
    const { data: pageVisits7d } = await supabase
      .from('page_visits').select('page_path')
      .gte('created_at', oneWeekAgo.toISOString())
    const pathCounts = new Map<string, number>()
    for (const v of (pageVisits7d || [])) {
      pathCounts.set(v.page_path, (pathCounts.get(v.page_path) || 0) + 1)
    }
    const topPages = [...pathCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([path, count]) => ({ path, count }))

    // Auth provider breakdown
    const providerCounts = new Map<string, number>()
    for (const u of allUsers) {
      const p = u.app_metadata?.provider || 'email'
      providerCounts.set(p, (providerCounts.get(p) || 0) + 1)
    }
    const providerBreakdown = [...providerCounts.entries()]
      .map(([provider, count]) => `${provider}: ${count}`)
      .join(', ')

    // Shares this week
    const { count: sharesThisWeek } = await supabase
      .from('share_events').select('*', { count: 'exact', head: true })
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
      unique7d,
      prevWeekVisitors,
      unique30d,
      totalPageViews: totalPageViews || 0,
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
        recipientEmail: 'eljaguaro@gmail.com',
        idempotencyKey: `weekly-insights-${weekStart}`,
        templateData: {
          weekLabel,
          totalUsers,
          newUsersThisWeek: newThisWeek.length,
          totalSetlists: totalSetlists || 0,
          newSetlistsThisWeek: newSetlistsThisWeek || 0,
          unique7d,
          unique30d,
          totalPageViews: totalPageViews || 0,
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
