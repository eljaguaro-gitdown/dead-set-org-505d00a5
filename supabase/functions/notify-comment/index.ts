import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceKey)

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

  let body: {
    setlistId: string
    commentId: string
    commenterName: string
    preview: string
  }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { setlistId, commentId, commenterName, preview } = body
  if (!setlistId || !commentId) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Look up setlist owner + title
  const { data: setlist, error: setlistError } = await supabase
    .from('setlists')
    .select('creator_id, title')
    .eq('id', setlistId)
    .maybeSingle()

  if (setlistError || !setlist) {
    return new Response(JSON.stringify({ error: 'Setlist not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Don't notify yourself
  if (setlist.creator_id === caller.id) {
    return new Response(JSON.stringify({ success: true, skipped: 'self' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: { user: recipient }, error: userError } =
    await supabase.auth.admin.getUserById(setlist.creator_id)
  if (userError || !recipient?.email) {
    return new Response(JSON.stringify({ error: 'Recipient not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { error: invokeError } = await supabase.functions.invoke('send-transactional-email', {
    body: {
      templateName: 'comment-notification',
      recipientEmail: recipient.email,
      idempotencyKey: `comment-notify-${commentId}`,
      templateData: {
        commenterName: commenterName || 'A Deadhead',
        setlistTitle: setlist.title || 'your setlist',
        preview: (preview || '').slice(0, 200),
        setlistId,
      },
    },
  })

  if (invokeError) {
    console.error('Failed to send comment notification', invokeError)
    return new Response(JSON.stringify({ error: 'Failed to send notification' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
