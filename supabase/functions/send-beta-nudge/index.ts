import { createClient } from 'npm:@supabase/supabase-js@2'
import { BETA_NUDGE_HTML } from './template.ts'

const SENDER_DOMAIN = 'notify.dead-set.org'
const FROM_ADDRESS = 'Jay at Dead Set <grateful_jaguaro@dead-set.org>'
const REPLY_TO = 'grateful_jaguaro@dead-set.org'
const SUBJECT = 'You set the tone.'
const PREHEADER = 'The features rolling out right now started as your notes.'
const TEMPLATE_NAME = 'beta_nudge'
const SEND_DELAY_MS = 200

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Personalize HTML: replace `Hey Now, {{first_name}}` with `Hey Now, [name]`
// or with just `Hey Now` (no comma, no trailing space) when first_name is missing.
function personalize(html: string, firstName: string | null | undefined): string {
  const trimmed = (firstName ?? '').trim()
  if (trimmed.length === 0) {
    return html.replaceAll('Hey Now, {{first_name}}', 'Hey Now')
  }
  return html.replaceAll('{{first_name}}', trimmed)
}

// Derive a first name from the profile's display_name (split on first space).
function deriveFirstName(displayName: string | null | undefined): string {
  if (!displayName) return ''
  const trimmed = displayName.trim()
  if (trimmed.length === 0) return ''
  return trimmed.split(/\s+/)[0]
}

// Insert a hidden preheader span right after <body> so inbox previews show it.
function injectPreheader(html: string, preheader: string): string {
  const hidden = `<div style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;max-height:0;max-width:0;">${preheader}</div>`
  return html.replace(/<body([^>]*)>/i, `<body$1>${hidden}`)
}

interface RequestBody {
  recipient_ids?: string[]
  dry_run?: boolean
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: 'Server configuration error' }, 500)
  }

  let body: RequestBody = {}
  try {
    body = (await req.json()) as RequestBody
  } catch {
    // Allow empty body — defaults apply
  }
  const dryRun = body.dry_run === true

  const supabase = createClient(supabaseUrl, serviceKey)

  // Resolve recipients: if recipient_ids omitted, fetch all profiles.
  // Beta cohort definition is curated via the admin UI's checkbox selection,
  // so this function trusts whatever IDs are passed in.
  let recipientIds = body.recipient_ids ?? []
  if (recipientIds.length === 0) {
    const { data: allProfiles, error: listError } = await supabase
      .from('profiles')
      .select('user_id')
    if (listError) {
      console.error('Failed to fetch profiles', listError)
      return jsonResponse({ error: 'Failed to fetch recipients' }, 500)
    }
    recipientIds = (allProfiles ?? []).map((p) => p.user_id)
  }

  if (recipientIds.length === 0) {
    return jsonResponse({ error: 'No recipients resolved' }, 400)
  }

  // Look up display_name + email for each recipient.
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('user_id, display_name')
    .in('user_id', recipientIds)
  if (profilesError) {
    console.error('Failed to fetch profile details', profilesError)
    return jsonResponse({ error: 'Failed to fetch profile details' }, 500)
  }

  // Get auth emails via admin API.
  const emailMap = new Map<string, string>()
  for (const userId of recipientIds) {
    const { data: userResult, error: userErr } =
      await supabase.auth.admin.getUserById(userId)
    if (userErr || !userResult?.user?.email) {
      console.warn('Could not resolve email for user', userId, userErr)
      continue
    }
    emailMap.set(userId, userResult.user.email)
  }

  const profileMap = new Map<string, string | null>()
  for (const p of profiles ?? []) {
    profileMap.set(p.user_id, p.display_name)
  }

  // DRY RUN: render for first recipient and return without sending or logging.
  if (dryRun) {
    const firstId = recipientIds[0]
    const firstName = deriveFirstName(profileMap.get(firstId) ?? '')
    const personalized = personalize(BETA_NUDGE_HTML, firstName)
    const withPreheader = injectPreheader(personalized, PREHEADER)
    return jsonResponse({
      dry_run: true,
      recipient_id: firstId,
      recipient_email: emailMap.get(firstId) ?? null,
      first_name: firstName || null,
      subject: SUBJECT,
      preheader: PREHEADER,
      html: withPreheader,
    })
  }

  // REAL SEND: enqueue one at a time, log each result, 200ms between sends.
  const results: Array<{
    user_id: string
    email: string | null
    status: 'sent' | 'failed' | 'skipped'
    error_message?: string
  }> = []

  for (const userId of recipientIds) {
    const email = emailMap.get(userId) ?? null
    const firstName = deriveFirstName(profileMap.get(userId) ?? '')

    if (!email) {
      await supabase.from('email_sends').insert({
        user_id: userId,
        template: TEMPLATE_NAME,
        status: 'skipped',
        error_message: 'No email on auth user',
      })
      results.push({ user_id: userId, email: null, status: 'skipped', error_message: 'no_email' })
      continue
    }

    try {
      const personalized = personalize(BETA_NUDGE_HTML, firstName)
      const html = injectPreheader(personalized, PREHEADER)
      const messageId = crypto.randomUUID()
      const idempotencyKey = `beta-nudge-${userId}`

      // Log pending row in shared email_send_log first
      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: TEMPLATE_NAME,
        recipient_email: email,
        status: 'pending',
      })

      const { error: enqueueError } = await supabase.rpc('enqueue_email', {
        queue_name: 'transactional_emails',
        payload: {
          message_id: messageId,
          to: email,
          from: FROM_ADDRESS,
          reply_to: REPLY_TO,
          sender_domain: SENDER_DOMAIN,
          subject: SUBJECT,
          html,
          text: PREHEADER,
          purpose: 'transactional',
          label: TEMPLATE_NAME,
          idempotency_key: idempotencyKey,
          queued_at: new Date().toISOString(),
        },
      })

      if (enqueueError) {
        await supabase.from('email_sends').insert({
          user_id: userId,
          template: TEMPLATE_NAME,
          status: 'failed',
          error_message: enqueueError.message,
        })
        results.push({
          user_id: userId,
          email,
          status: 'failed',
          error_message: enqueueError.message,
        })
      } else {
        await supabase.from('email_sends').insert({
          user_id: userId,
          template: TEMPLATE_NAME,
          status: 'sent',
        })
        results.push({ user_id: userId, email, status: 'sent' })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await supabase.from('email_sends').insert({
        user_id: userId,
        template: TEMPLATE_NAME,
        status: 'failed',
        error_message: msg,
      })
      results.push({ user_id: userId, email, status: 'failed', error_message: msg })
    }

    await new Promise((r) => setTimeout(r, SEND_DELAY_MS))
  }

  const sent = results.filter((r) => r.status === 'sent').length
  const failed = results.filter((r) => r.status === 'failed').length
  const skipped = results.filter((r) => r.status === 'skipped').length
  return jsonResponse({
    dry_run: false,
    total: results.length,
    sent,
    failed,
    skipped,
    results,
  })
})
