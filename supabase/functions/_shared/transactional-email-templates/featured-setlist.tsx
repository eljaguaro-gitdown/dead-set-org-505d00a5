/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_URL = 'https://dead-set.org'
const UTM = 'utm_source=email&utm_medium=transactional&utm_campaign=featured_setlist'

const FF_SERIF = "Georgia, 'Times New Roman', serif"
const FF_MONO = "'Courier New', Courier, monospace"
const FF_SANS = "Arial, Helvetica, sans-serif"

interface FeaturedSetlistProps {
  displayName?: string
  setlistTitle?: string
  setlistId?: string
  posterImageUrl?: string
}

const FeaturedSetlistEmail = ({
  displayName,
  setlistTitle,
  setlistId,
  posterImageUrl,
}: FeaturedSetlistProps) => {
  const setlistHref = setlistId
    ? `${SITE_URL}/setlist/${setlistId}?${UTM}`
    : `${SITE_URL}/?${UTM}`
  const shareHref = `${SITE_URL}/?${UTM}&utm_content=share`
  const greeting = displayName ? `Hey now, ${displayName}!` : 'Hey now!'

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>
        Your setlist {setlistTitle ? `"${setlistTitle}" ` : ''}is today&apos;s
        featured setlist on Dead-Set.Org
      </Preview>
      <Body style={main}>
        <Container style={wrapper}>
          {/* HEADER */}
          <Section style={header}>
            <Hr style={ruleGold} />
            <Text style={siteName}>DEAD SET</Text>
            <Text style={headerTagline}>TODAY&apos;S FEATURED SETLIST</Text>
            <Hr style={ruleMuted} />
          </Section>

          {/* BODY */}
          <Section style={bodySection}>
            <Text style={eyebrow}>SPOTLIGHT</Text>
            <Text style={headline}>{greeting}</Text>
            <Text style={bodyP}>
              Your setlist
              {setlistTitle ? ` "${setlistTitle}"` : ''} has been chosen as
              today&apos;s featured setlist on dead-set.org. The whole community
              is going to be spinning it.
            </Text>

            {posterImageUrl && (
              <Section style={posterWrap}>
                <Link href={setlistHref}>
                  <Img
                    src={posterImageUrl}
                    alt={setlistTitle || 'Featured setlist poster'}
                    width="540"
                    style={posterImg}
                  />
                </Link>
              </Section>
            )}
          </Section>

          {/* CTA */}
          <Section style={ctaSection}>
            <Link href={setlistHref} style={ctaButton}>
              VIEW YOUR POSTER
            </Link>
            <Text style={shareLine}>
              Spread the word — share with your friends:
            </Text>
            <Link href={shareHref} style={secondaryButton}>
              SHARE DEAD-SET.ORG
            </Link>
          </Section>

          {/* FOOTER */}
          <Section style={footer}>
            <Hr style={ruleMuted} />
            <Text style={footerLogo}>DEAD SET · DEAD-SET.ORG</Text>
            <Text style={footerCopy}>
              You received this because your setlist was featured on the home
              page today.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: FeaturedSetlistEmail,
  subject: (data: Record<string, any>) =>
    data?.setlistTitle
      ? `"${data.setlistTitle}" is today's featured setlist on Dead-Set.Org`
      : `Your setlist is today's featured setlist on Dead-Set.Org`,
  displayName: 'Featured setlist spotlight',
  previewData: {
    displayName: 'grateful_jaguaro',
    setlistTitle: '5/8/77 Cornell',
    setlistId: '00000000-0000-0000-0000-000000000000',
    posterImageUrl: 'https://dplrumaqrdnzwzqmatqr.supabase.co/functions/v1/og-image?id=00000000-0000-0000-0000-000000000000&format=image',
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
const headline = { fontFamily: FF_SERIF, fontSize: '26px', fontWeight: '400' as const, color: '#c9a84c', lineHeight: '1.3', margin: '0 0 18px' }
const bodyP = { fontFamily: FF_SANS, fontSize: '15px', fontWeight: '300' as const, lineHeight: '1.8', color: '#b0ac9a', margin: '0 0 28px' }

const posterWrap = { margin: '0 auto', textAlign: 'center' as const }
const posterImg = { width: '100%', maxWidth: '540px', height: 'auto', display: 'block', margin: '0 auto', border: '1px solid #2a2410' }

const ctaSection = { padding: '0 40px 40px', textAlign: 'center' as const, backgroundColor: '#0d0d0d' }
const ctaButton = { display: 'inline-block', fontFamily: FF_SANS, fontSize: '13px', fontWeight: '700' as const, letterSpacing: '2px', color: '#0a0a0a', backgroundColor: '#c9a84c', padding: '14px 36px', textDecoration: 'none' }
const shareLine = { fontFamily: FF_MONO, fontSize: '12px', letterSpacing: '2px', color: '#a09880', margin: '32px 0 14px' }
const secondaryButton = { display: 'inline-block', fontFamily: FF_SANS, fontSize: '12px', fontWeight: '700' as const, letterSpacing: '2px', color: '#c9a84c', backgroundColor: 'transparent', border: '1px solid #c9a84c', padding: '12px 28px', textDecoration: 'none' }

const footer = { backgroundColor: '#080808', borderTop: '1px solid #1a1408', padding: '28px 40px', textAlign: 'center' as const }
const footerLogo = { fontFamily: FF_SERIF, fontSize: '14px', color: '#a09880', letterSpacing: '2px', margin: '0 0 10px' }
const footerCopy = { fontFamily: FF_MONO, fontSize: '12px', color: '#8a8270', letterSpacing: '1px', lineHeight: '1.8', margin: '0' }
