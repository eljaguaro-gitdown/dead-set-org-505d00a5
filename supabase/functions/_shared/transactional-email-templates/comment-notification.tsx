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

const SITE_URL = 'https://dead-set.org'
const UTM = 'utm_source=email&utm_medium=transactional&utm_campaign=comment_notification'

const FF_SERIF = "Georgia, 'Times New Roman', serif"
const FF_MONO = "'Courier New', Courier, monospace"
const FF_SANS = "Arial, Helvetica, sans-serif"

interface CommentNotificationProps {
  commenterName?: string
  setlistTitle?: string
  preview?: string
  setlistId?: string
}

const CommentNotificationEmail = ({
  commenterName,
  setlistTitle,
  preview,
  setlistId,
}: CommentNotificationProps) => {
  const ctaHref = setlistId
    ? `${SITE_URL}/setlist/${setlistId}?${UTM}`
    : `${SITE_URL}/?${UTM}`

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>
        {(commenterName || 'A Deadhead')} left a note on{' '}
        {setlistTitle || 'your setlist'}
      </Preview>
      <Body style={main}>
        <Container style={wrapper}>
          {/* HEADER */}
          <Section style={header}>
            <Hr style={ruleGold} />
            <Text style={siteName}>DEAD SET</Text>
            <Text style={headerTagline}>DEAD-SET.ORG</Text>
            <Hr style={ruleMuted} />
          </Section>

          {/* BODY */}
          <Section style={bodySection}>
            <Text style={eyebrow}>NEW COMMUNITY NOTE</Text>
            <Text style={headline}>
              {commenterName || 'A fellow Deadhead'} left a note on{' '}
              {setlistTitle ? `"${setlistTitle}"` : 'your setlist'}
            </Text>

            {preview && (
              <Section style={messageBox}>
                <Text style={messageText}>"{preview}"</Text>
              </Section>
            )}

            <Text style={bodyP}>
              Head back to your poster to read it and join the conversation.
            </Text>
          </Section>

          {/* CTA */}
          <Section style={ctaSection}>
            <Link href={ctaHref} style={ctaButton}>
              VIEW THE POSTER
            </Link>
          </Section>

          {/* FOOTER */}
          <Section style={footer}>
            <Hr style={ruleMuted} />
            <Text style={footerLogo}>DEAD SET · DEAD-SET.ORG</Text>
            <Text style={footerCopy}>
              You received this because someone commented on your setlist.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: CommentNotificationEmail,
  subject: (data: Record<string, any>) =>
    `${data?.commenterName || 'Someone'} commented on ${
      data?.setlistTitle ? `"${data.setlistTitle}"` : 'your setlist'
    }`,
  displayName: 'Comment notification',
  previewData: {
    commenterName: 'grateful_jaguaro',
    setlistTitle: '9/12/81 Greek Theatre',
    preview: 'The Birdsong is sublime at 4:30!!! nice find!',
    setlistId: '00000000-0000-0000-0000-000000000000',
  },
} satisfies TemplateEntry

// ── STYLES ──
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

const messageBox = { backgroundColor: '#0f0e08', border: '1px solid #2a2410', borderLeft: '3px solid #c9a84c', padding: '16px 20px', margin: '0 0 24px', textAlign: 'left' as const }
const messageText = { fontFamily: FF_SERIF, fontSize: '15px', fontStyle: 'italic' as const, color: '#c8c4b0', lineHeight: '1.6', margin: '0' }

const ctaSection = { padding: '0 40px 40px', textAlign: 'center' as const, backgroundColor: '#0d0d0d' }
const ctaButton = { display: 'inline-block', fontFamily: FF_SANS, fontSize: '13px', fontWeight: '700' as const, letterSpacing: '2px', color: '#0a0a0a', backgroundColor: '#c9a84c', padding: '14px 36px', textDecoration: 'none' }

const footer = { backgroundColor: '#080808', borderTop: '1px solid #1a1408', padding: '28px 40px', textAlign: 'center' as const }
const footerLogo = { fontFamily: FF_SERIF, fontSize: '14px', color: '#a09880', letterSpacing: '2px', margin: '0 0 10px' }
const footerCopy = { fontFamily: FF_MONO, fontSize: '12px', color: '#8a8270', letterSpacing: '1px', lineHeight: '1.8', margin: '0' }
