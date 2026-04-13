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
    const supabase = createClient(supabaseUrl, serviceKey)

    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 86400000).toISOString()
    const sevenDaysAgo = new Date(now.getTime() - 604800000).toISOString()
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

    // Traffic
    const { count: totalPageViews } = await supabase
      .from('page_visits')
      .select('*', { count: 'exact', head: true })

    const { data: visitors24h } = await supabase
      .from('page_visits')
      .select('visitor_id')
      .gte('created_at', oneDayAgo)
    const unique24h = new Set((visitors24h || []).map(v => v.visitor_id)).size

    const { data: visitors7d } = await supabase
      .from('page_visits')
      .select('visitor_id')
      .gte('created_at', sevenDaysAgo)
    const unique7d = new Set((visitors7d || []).map(v => v.visitor_id)).size

    // Send via transactional email
    const { error } = await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'daily-user-report',
        recipientEmail: 'eljaguaro@gmail.com',
        idempotencyKey: `daily-report-${reportDate}`,
        templateData: {
          totalUsers,
          newUsersToday,
          newUserNames,
          totalSetlists: totalSetlists || 0,
          newSetlistsToday: newSetlistsToday || 0,
          unique24h,
          unique7d,
          totalPageViews: totalPageViews || 0,
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
