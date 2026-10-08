import { createClient } from 'npm:@supabase/supabase-js@2'

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

  let body: { recipientUserId: string; senderName: string; messagePreview: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { recipientUserId, senderName, messagePreview } = body
  if (!recipientUserId || !senderName) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Look up recipient email using admin API
  const { data: { user: recipient }, error: userError } = await supabase.auth.admin.getUserById(recipientUserId)
  if (userError || !recipient?.email) {
    console.error('Could not find recipient', { recipientUserId, userError })
    return new Response(JSON.stringify({ error: 'Recipient not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Don't email yourself
  if (recipientUserId === caller.id) {
    return new Response(JSON.stringify({ success: true, skipped: 'self' }), {
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
      idempotencyKey: `dm-notify-${recipientUserId}-${Date.now()}`,
      templateData: {
        senderName,
        messagePreview: messagePreview?.slice(0, 200) || '',
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
