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
    const supabase = createClient(supabaseUrl, serviceKey)

    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 86400000).toISOString()
    const reportDate = now.toISOString().split('T')[0]

    // Total users
    const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    const totalUsers = users?.length || 0

    // New users in last 24h
    const newUsers = (users || []).filter(u => new Date(u.created_at).getTime() > now.getTime() - 86400000)
    const newUsersToday = newUsers.length

    // Get display names for new users
    const newUserIds = newUsers.map(u => u.id)
    let newUserNames: string[] = []
    if (newUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', newUserIds)
      const profileMap = new Map((profiles || []).map(p => [p.user_id, p.display_name]))
      newUserNames = newUsers.map(u => profileMap.get(u.id) || u.email?.split('@')[0] || 'Unknown')
    }

    // Total setlists
    const { count: totalSetlists } = await supabase
      .from('setlists')
      .select('*', { count: 'exact', head: true })

    // New setlists today
    const { count: newSetlistsToday } = await supabase
      .from('setlists')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneDayAgo)

    // Traffic — from PostHog, not page_visits, for the same reason as
    // weekly-insights-report: page_visits counts Lovable preview reloads and
    // admin sessions as visitors. Null (shown as "—") if PostHog is unreachable.
    const trafficRows = await queryPostHog<{
      unique24h: number; unique7d: number; pageViews24h: number
    }>('daily-user-report traffic', `
      SELECT
        uniqIf(person_id, timestamp >= now() - INTERVAL 1 DAY) AS unique24h,
        uniq(person_id) AS unique7d,
        countIf(timestamp >= now() - INTERVAL 1 DAY) AS pageViews24h
      FROM events
      WHERE event = '$pageview'
        AND timestamp >= now() - INTERVAL 7 DAY
        AND ${POSTHOG_EXTERNAL_TRAFFIC_WHERE}`)
    const traffic = trafficRows?.[0] ?? null
    const unique24h = traffic?.unique24h ?? null
    const unique7d = traffic?.unique7d ?? null
    const pageViews24h = traffic?.pageViews24h ?? null

    // Send via transactional email
    const { error } = await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'daily-user-report',
        recipientEmail: Deno.env.get('ADMIN_REPORT_EMAIL'),
        idempotencyKey: `daily-report-${reportDate}`,
        templateData: {
          totalUsers,
          newUsersToday,
          newUserNames,
          totalSetlists: totalSetlists || 0,
          newSetlistsToday: newSetlistsToday || 0,
          unique24h,
          unique7d,
          pageViews24h,
          reportDate,
        },
      },
    })

    if (error) {
      console.error('Failed to send daily report', error)
      return new Response(JSON.stringify({ error: 'Failed to send report' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, reportDate }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    console.error('Daily report error:', e)
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
