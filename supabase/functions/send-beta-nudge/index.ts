import { createClient } from 'npm:@supabase/supabase-js@2'
import { BETA_NUDGE_HTML } from './template.ts'

// SENDER_DOMAIN must match the verified subdomain delegated to Lovable's nameservers.
// Sending from the root dead-set.org would be rejected ("No email domain record found").
const SENDER_DOMAIN = 'notify.dead-set.org'
// From address must use the verified subdomain. Reply-To routes responses to Jay's inbox.
const FROM_ADDRESS = 'Grateful Jaguaro at Dead Set <noreply@notify.dead-set.org>'
const REPLY_TO = 'grateful_jaguaro@dead-set.org'
const SUBJECT = 'Build notes from the lab — what shipped this week'
const PREHEADER = 'Two weeks of shipping. Here is what got built.'
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

// Build a real plain-text alternative. Mailbox providers (Apple, Gmail) penalize
// emails with a thin or missing text/plain part.
function buildPlainText(firstName: string, unsubscribeUrl: string): string {
  const greeting = firstName ? `Hey now, ${firstName}.` : 'Hey now.'
  return [
    greeting,
    '',
    'The features rolling out right now started as your notes.',
    '',
    "You've been in the app — building setlists, hitting favorites, leaving feedback. What you're doing isn't beta testing. It's co-authorship.",
    '',
    "Two weeks of shipping, daily. Here's what got built — a lot of it because of you.",
    '',
    'SET I — UNDER THE HOOD',
    '• 100% song match rate — fuzzy matching now handles apostrophes, abbreviations, and alternate spellings.',
    '• Signup alerts — we know the moment someone gets on the bus.',
    '',
    'SET II — NEW & BETTER',
    '• Setlist Builder — drag to reorder, mark segues, pull live versions from the Song Vault.',
    "• Liner notes that sound like Lemieux on SiriusXM — Charlie's descriptions now name the structural arc of the night.",
    '• The Aha Moment — every Charlie setlist contains one placement that makes a veteran Deadhead say "wait — did they actually do that?"',
    '• Vibe is now a real atmosphere — pick Dark & Heavy and party songs disappear.',
    '• Show Score (beta) — paste any setlist and get a read on how legendary that night was.',
    '',
    'ENCORE',
    "You're the first set. Everything that comes after carries your fingerprints. Keep telling me what's broken, what's missing, what would make you come back tomorrow.",
    '',
    'Go Backstage: https://dead-set.org/backstage',
    '',
    'Gratefully. Always.',
    '— Grateful Jaguaro',
    '',
    '---',
    'Dead Set · The music never stops.',
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join('\n')
}

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Reuse an unused unsubscribe token for this email, or create one. Returns null on failure.
async function getOrCreateUnsubscribeToken(
  supabase: any,
  email: string,
): Promise<string | null> {
  const normalized = email.toLowerCase()
  const { data: existing } = await supabase
    .from('email_unsubscribe_tokens')
    .select('token, used_at')
    .eq('email', normalized)
    .maybeSingle()

  if (existing && !existing.used_at) return existing.token as string
  if (existing && existing.used_at) return null // already used = effectively suppressed

  const token = generateToken()
  await supabase
    .from('email_unsubscribe_tokens')
    .upsert({ token, email: normalized }, { onConflict: 'email', ignoreDuplicates: true })

  const { data: stored } = await supabase
    .from('email_unsubscribe_tokens')
    .select('token')
    .eq('email', normalized)
    .maybeSingle()
  return (stored?.token as string) ?? null
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
      // Suppression check (fail-closed)
      const { data: suppressed } = await supabase
        .from('suppressed_emails')
        .select('id')
        .eq('email', email.toLowerCase())
        .maybeSingle()
      if (suppressed) {
        await supabase.from('email_sends').insert({
          user_id: userId,
          template: TEMPLATE_NAME,
          status: 'skipped',
          error_message: 'suppressed',
        })
        results.push({ user_id: userId, email, status: 'skipped', error_message: 'suppressed' })
        await new Promise((r) => setTimeout(r, SEND_DELAY_MS))
        continue
      }

      const unsubscribeToken = await getOrCreateUnsubscribeToken(supabase, email)
      if (!unsubscribeToken) {
        await supabase.from('email_sends').insert({
          user_id: userId,
          template: TEMPLATE_NAME,
          status: 'skipped',
          error_message: 'unsubscribe token unavailable (already unsubscribed?)',
        })
        results.push({ user_id: userId, email, status: 'skipped', error_message: 'no_unsub_token' })
        await new Promise((r) => setTimeout(r, SEND_DELAY_MS))
        continue
      }

      const personalized = personalize(BETA_NUDGE_HTML, firstName)
      const html = injectPreheader(personalized, PREHEADER)
      const unsubscribeUrl = `https://dead-set.org/unsubscribe?token=${unsubscribeToken}`
      const text = buildPlainText(firstName, unsubscribeUrl)
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
          text,
          purpose: 'transactional',
          label: TEMPLATE_NAME,
          idempotency_key: idempotencyKey,
          unsubscribe_token: unsubscribeToken,
          // RFC 8058 one-click unsubscribe headers — Apple/Gmail give a measurable
          // deliverability boost when these are present.
          headers: {
            'List-Unsubscribe': `<${unsubscribeUrl}>, <mailto:unsubscribe@notify.dead-set.org?subject=unsubscribe-${unsubscribeToken}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
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
