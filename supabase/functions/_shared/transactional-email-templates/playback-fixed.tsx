/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

// "We'll let you know as soon as it's fixed." Sent by the notify_playback_fixed
// trigger the moment a tape a fan flagged is verified playing again — either by
// the first real play of that night after the fix, or by hand from /admin.
// One per fan per issue (idempotency key playback-fixed-<issue>-<user>).

const SITE_URL = 'https://dead-set.org'
const UTM = 'utm_source=email&utm_medium=transactional&utm_campaign=playback_fixed'

const FF_SERIF = "Georgia, 'Times New Roman', serif"
const FF_MONO = "'Courier New', Courier, monospace"
const FF_SANS = "Arial, Helvetica, sans-serif"

interface PlaybackFixedProps {
  songTitle?: string
  showDate?: string | null
  songId?: string | null
  credited?: boolean
}

/** "1979-08-04" → "8/4/79". String surgery: a Date would shift a day west of UTC. */
const shortDate = (raw?: string | null) => {
  const m = raw?.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${Number(m[2])}/${Number(m[3])}/${m[1].slice(2)}` : null
}

const PlaybackFixedEmail = ({ songTitle = 'That song', showDate = null, songId = null, credited = false }: PlaybackFixedProps) => {
  const date = shortDate(showDate)
  const name = date ? `${songTitle} · ${date}` : songTitle
  const ctaHref = songId ? `${SITE_URL}/song/${songId}?${UTM}` : `${SITE_URL}/?${UTM}`

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{name} plays again. You flagged it; it's fixed and checked.</Preview>
      <Body style={main}>
        <Container style={wrapper}>
          <Section style={header}>
            <Hr style={ruleGold} />
            <Text style={siteName}>DEAD SET</Text>
            <Text style={headerTagline}>DEAD-SET.ORG</Text>
            <Hr style={ruleMuted} />
          </Section>

          <Section style={bodySection}>
            <Text style={eyebrow}>HEY NOW · IT'S FIXED</Text>
            <Text style={headline}>{name} plays again.</Text>
            <Text style={bodyP}>
              You tapped it, it wouldn't spin, and you let it be noted. We dug in, fixed it, and it's been
              checked: it plays.
            </Text>
            <Text style={bodyP}>
              Thanks. This is a community project, and it gets better exactly this way.
              {credited ? ' Your name is on Build Notes beside the fix.' : ''}
            </Text>
            <Text style={creditP}>
              The music is on the Internet Archive because tapers rolled and traders kept it alive. We just
              help you find it.
            </Text>
          </Section>

          <Section style={ctaSection}>
            <Link href={ctaHref} style={ctaButton}>
              SPIN IT
            </Link>
          </Section>

          <Section style={footer}>
            <Hr style={ruleMuted} />
            <Text style={footerLogo}>DEAD SET · DEAD-SET.ORG</Text>
            <Text style={footerCopy}>
              You received this because a tape wouldn't play for you and you asked to hear when it was fixed.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: PlaybackFixedEmail,
  subject: (data: Record<string, any>) => {
    const date = shortDate(data?.showDate)
    return `Hey Now: ${data?.songTitle || 'your tape'}${date ? ` (${date})` : ''} plays again`
  },
  displayName: 'Playback fixed',
  previewData: {
    songTitle: 'Althea',
    showDate: '1979-08-04',
    songId: '00000000-0000-0000-0000-000000000000',
    credited: true,
  },
} satisfies TemplateEntry

// ── STYLES (shared look with comment-notification) ──
const main = { backgroundColor: '#0a0a0a', fontFamily: FF_SANS, color: '#c8c4b0' }
const wrapper = { maxWidth: '620px', margin: '0 auto', backgroundColor: '#0d0d0d', padding: '0' }
const ruleGold = { borderColor: '#c9a84c', borderTop: '1px solid #c9a84c', margin: '0 0 24px' }
const ruleMuted = { borderColor: '#2a2410', borderTop: '1px solid #2a2410', margin: '0' }
const header = { backgroundColor: '#0a0a0a', borderBottom: '1px solid #2a2410', padding: '32px 40px 28px', textAlign: 'center' as const }
const siteName = { fontFamily: FF_SERIF, fontSize: '26px', fontWeight: '700' as const, color: '#c9a84c', letterSpacing: '3px', margin: '0 0 10px' }
const headerTagline = { fontFamily: FF_MONO, fontSize: '12px', letterSpacing: '2px', color: '#b09e78', margin: '0' }
const bodySection = { padding: '40px 40px', backgroundColor: '#0d0d0d', textAlign: 'center' as const }
const eyebrow = { fontFamily: FF_MONO, fontSize: '12px', letterSpacing: '3px', color: '#a09880', margin: '0 0 16px' }
const headline = { fontFamily: FF_SERIF, fontSize: '24px', fontWeight: '400' as const, color: '#c9a84c', lineHeight: '1.3', margin: '0 0 24px' }
const bodyP = { fontFamily: FF_SANS, fontSize: '15px', fontWeight: '300' as const, lineHeight: '1.8', color: '#b0ac9a', margin: '0 0 18px' }
const creditP = { fontFamily: FF_SERIF, fontSize: '14px', fontStyle: 'italic' as const, lineHeight: '1.7', color: '#c8c4b0', margin: '8px 0 0' }
const ctaSection = { padding: '0 40px 40px', textAlign: 'center' as const, backgroundColor: '#0d0d0d' }
const ctaButton = { display: 'inline-block', fontFamily: FF_SANS, fontSize: '13px', fontWeight: '700' as const, letterSpacing: '2px', color: '#0a0a0a', backgroundColor: '#c9a84c', padding: '14px 36px', textDecoration: 'none' }
const footer = { backgroundColor: '#080808', borderTop: '1px solid #1a1408', padding: '28px 40px', textAlign: 'center' as const }
const footerLogo = { fontFamily: FF_SERIF, fontSize: '14px', color: '#a09880', letterSpacing: '2px', margin: '0 0 10px' }
const footerCopy = { fontFamily: FF_MONO, fontSize: '12px', color: '#8a8270', letterSpacing: '1px', lineHeight: '1.8', margin: '0' }
