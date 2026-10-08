import { createClient } from 'npm:@supabase/supabase-js@2'
import { resolveDmNotification } from './resolve.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-visitor-id',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Validate caller is authenticated
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  // Verify the caller's JWT
  const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user: caller } } = await anonClient.auth.getUser()
  if (!caller) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // The request names the recipient. The name and preview it also carries are
  // ignored: they come from the stored message and the caller's profile (#114).
  let body: { recipientUserId?: unknown }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { recipientUserId } = body
  if (!recipientUserId) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Don't email yourself
  if (recipientUserId === caller.id) {
    return new Response(JSON.stringify({ success: true, skipped: 'self' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // The recipient must share a conversation with the caller, who must have
  // written in it in the last few minutes. See ./resolve.ts. Every lookup is a
  // plain .eq/.in filter: recipientUserId comes from the request.
  const notice = await resolveDmNotification(caller, recipientUserId, {
    conversationIdsOf: async (userId, within) => {
      const ids = new Set<string>()
      let members = supabase.from('conversation_members').select('conversation_id').eq('user_id', userId)
      let asOne = supabase.from('conversations').select('id').eq('user_one', userId)
      let asTwo = supabase.from('conversations').select('id').eq('user_two', userId)
      if (within) {
        members = members.in('conversation_id', within)
        asOne = asOne.in('id', within)
        asTwo = asTwo.in('id', within)
      }
      const [m, one, two] = await Promise.all([members, asOne, asTwo])
      for (const r of m.data ?? []) ids.add(r.conversation_id)
      for (const r of one.data ?? []) ids.add(r.id)
      for (const r of two.data ?? []) ids.add(r.id)
      return [...ids]
    },
    latestMessageFrom: async (senderId, conversationIds, sinceIso) => {
      const { data } = await supabase
        .from('direct_messages')
        .select('id, content')
        .eq('sender_id', senderId)
        .in('conversation_id', conversationIds)
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return data ?? null
    },
    displayName: async (userId) => {
      const { data } = await supabase.from('profiles').select('display_name').eq('user_id', userId).maybeSingle()
      return data?.display_name ?? null
    },
  })
  if (!notice.ok) {
    return new Response(JSON.stringify({ error: notice.error }), {
      status: notice.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Look up recipient email using admin API
  const { data: { user: recipient }, error: userError } = await supabase.auth.admin.getUserById(recipientUserId as string)
  if (userError || !recipient?.email) {
    console.error('Could not find recipient', { recipientUserId, userError })
    return new Response(JSON.stringify({ error: 'Recipient not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Send as the service role, through the same client call the daily and
  // weekly reports use. send-transactional-email lets only the service role
  // and admins send this template (#101), and this function has already
  // checked the caller and looked up the recipient itself.
  const { error: sendError } = await supabase.functions.invoke('send-transactional-email', {
    body: {
      templateName: 'dm-notification',
      recipientEmail: recipient.email,
      idempotencyKey: notice.idempotencyKey,
      templateData: {
        senderName: notice.senderName,
        messagePreview: notice.messagePreview,
      },
    },
  })

  if (sendError) {
    console.error('Failed to send DM notification', sendError)
    return new Response(JSON.stringify({ error: 'Failed to send notification' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
