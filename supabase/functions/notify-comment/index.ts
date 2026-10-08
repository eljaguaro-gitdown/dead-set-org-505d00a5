import { createClient } from 'npm:@supabase/supabase-js@2'
import { resolveCommentNotification } from './resolve.ts'

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

  // The request names the setlist and the comment. The name and preview it
  // also carries are ignored: they come from the stored comment and the
  // caller's profile (#114).
  let body: { setlistId?: unknown; commentId?: unknown }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { setlistId, commentId } = body
  if (!setlistId || !commentId) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // The comment must exist, be on this setlist, and be the caller's own.
  // See ./resolve.ts.
  const notice = await resolveCommentNotification(caller, setlistId, commentId, {
    getComment: async (id) => {
      const { data } = await supabase
        .from('setlist_comments')
        .select('setlist_id, user_id, content')
        .eq('id', id)
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

  // Look up setlist owner + title
  const { data: setlist, error: setlistError } = await supabase
    .from('setlists')
    .select('creator_id, title')
    .eq('id', setlistId as string)
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

  // Send as the service role, through the same client call the daily and
  // weekly reports use. send-transactional-email lets only the service role
  // and admins send this template (#101), and this function has already
  // checked the caller and looked up the recipient itself.
  const { error: sendError } = await supabase.functions.invoke('send-transactional-email', {
    body: {
      templateName: 'comment-notification',
      recipientEmail: recipient.email,
      idempotencyKey: `comment-notify-${commentId}`,
      templateData: {
        commenterName: notice.commenterName,
        setlistTitle: setlist.title || 'your setlist',
        preview: notice.preview,
        setlistId,
      },
    },
  })

  if (sendError) {
    console.error('Failed to send comment notification', sendError)
    return new Response(JSON.stringify({ error: 'Failed to send notification' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
