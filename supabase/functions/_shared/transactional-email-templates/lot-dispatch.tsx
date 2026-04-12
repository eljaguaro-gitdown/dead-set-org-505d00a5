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
  Row,
  Column,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_URL = 'https://dead-set.org'
const UTM = 'utm_source=email&utm_medium=transactional&utm_campaign=lot-dispatch'
const SITE_URL_UTM = `${SITE_URL}?${UTM}`
const BACKSTAGE_URL = `${SITE_URL}/backstage?${UTM}`

const FF_SERIF = "Georgia, 'Times New Roman', serif"
const FF_MONO = "'Courier New', Courier, monospace"
const FF_SANS = "Arial, Helvetica, sans-serif"
const FF_CURSIVE = "'Brush Script MT', 'Segoe Script', cursive"

interface HappeningItem {
  glyph: string
  title: string
  detail: string
}

interface LotDispatchProps {
  showNumber?: string
  artist?: string
  heroTagline?: string
  venue?: string
  location?: string
  date?: string
  dispatchBody?: string[]
  pullQuote?: string
  momentLabel?: string
  momentText?: string
  happenings?: HappeningItem[]
  ctaEyebrow?: string
  ctaHeadline?: string
  backstageText?: string
  signoffBody?: string
  psText?: string
}

const LotDispatchEmail = ({
  showNumber = 'Grateful Dead Night #414',
  artist = 'Stu Allen & Mars Hotel',
  heroTagline = 'Wait. Now. Discover.',
  venue = 'Ashkenaz',
  location = 'Berkeley, CA',
  date = 'Fri, Apr 10',
  dispatchBody = [
    "I was there Friday night. Ashkenaz. Show #414. Stu Allen doing what Stu Allen does — keeping Garcia's music alive, note for note, with that unmistakable commitment to making every performance its own thing. If you've never been to a Grateful Dead Night at Ashkenaz, put it on the list. It's a tradition. It's a room full of people who get it.",
    "I had a pocket full of Dead Set cards. I handed them to people I met — at the bar, near the stage, in the parking lot after. Fellow Deadheads. People mid-conversation about their favorite era, their favorite version of a song, the show they'll never forget.",
    "And now you're here. Which means either someone passed you a card that night, or the word traveled the way it always does in this community — one Deadhead to another. Either way: welcome. You found the right place.",
  ],
  pullQuote = "That's the whole point. Find the people who already speak the language — and hand them the tape.",
  momentLabel = 'The moment that started it all',
  momentText = "Dead Set wasn't built in an office. It was built because one night I heard Big Steve Parrish pull out a gem from '73 on SiriusXM and thought: what if we could find these moments ourselves? On demand. By feel? That question became this.",
  happenings = [
    { glyph: '✦', title: 'The app is live and shipping daily', detail: "New features and fixes going out multiple times a day. It's early, it's raw, and it's getting better every session." },
    { glyph: '⌁', title: 'Cosmic Charlie is your guide', detail: "Tell Cosmic Charlie your mood, your era, your vibe — and he'll build you a setlist from 2,300 real shows in the Live Music Archive. Every suggestion links to an actual recording." },
    { glyph: '◎', title: 'Beta Deadheads are shaping what ships', detail: 'This is a small founding group. Features are being built from their feedback in real time. If you want in on that, Backstage is the door.' },
    { glyph: '∿', title: 'The never-ending search', detail: '2,300 shows. 50 years of magic. The perfect version of your favorite song is in there somewhere. Dead Set is built to help you find it — by vibe, by era, by mood.' },
  ],
  ctaEyebrow = 'Start here',
  ctaHeadline = '2,300 shows. 50 years of magic.\nYours to explore.',
  backstageText = "Want to help shape what Dead Set becomes? Backstage is where the founding community builds this together. Share your wishlist, log a bug, tell us about the shows and songs that move you. All-access. No ticket queue.",
  signoffBody = "Pass this along. That's always how the best music traveled — one Deadhead to another, hand to hand. If someone you know belongs here, bring them in.",
  psText = "If you were at Ashkenaz on Friday and we talked: this is the thing I told you about. The show you're looking for is in there. Let's find it together.",
}: LotDispatchProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Dead Set · Dispatch from the Lot — {showNumber}</Preview>
    <Body style={main}>
      <Container style={wrapper}>

        {/* ── HEADER ── */}
        <Section style={header}>
          <Hr style={ruleGold} />
          <Text style={siteNameSt}>DEAD SET</Text>
          <Text style={headerMeta}>DISPATCH FROM THE LOT &nbsp;·&nbsp; {date.toUpperCase()} &nbsp;·&nbsp; {heroTagline.toUpperCase()}</Text>
          <Hr style={ruleFaint} />
        </Section>

        {/* ── SHOW HERO ── */}
        <Section style={showHero}>
          <Text style={showEyebrow}>{showNumber.toUpperCase()}</Text>
          <Text style={showTitle}>{artist}</Text>
          <Text style={showTagline}>{heroTagline.toUpperCase()}</Text>
          <Section style={metaRow}>
            <Row>
              <Column style={metaCell}>
                <Text style={metaLabel}>VENUE</Text>
                <Text style={metaValue}>{venue}</Text>
              </Column>
              <Column style={metaCellMiddle}>
                <Text style={metaLabel}>LOCATION</Text>
                <Text style={metaValue}>{location}</Text>
              </Column>
              <Column style={metaCell}>
                <Text style={metaLabel}>DATE</Text>
                <Text style={metaValue}>{date}</Text>
              </Column>
            </Row>
          </Section>
        </Section>

        {/* ── TAPE STRIP ── */}
        <Section style={tapeStrip}>
          <Text style={tapeText}>Please copy and share freely &nbsp;·&nbsp; Trade only &nbsp;·&nbsp; dead-set.org</Text>
        </Section>

        {/* ── BODY ── */}
        <Section style={bodySection}>
          <Text style={dispatchLabel}>DISPATCH &nbsp;·&nbsp; FROM THE FLOOR</Text>
          <Text style={salutation}>Hey Now —</Text>
          {dispatchBody.map((p, i) => (
            <Text key={i} style={bodyP}>{p}</Text>
          ))}
        </Section>

        {/* ── PULL QUOTE ── */}
        {pullQuote && (
          <Section style={bodySection}>
            <Section style={pullQuoteSt}>
              <Text style={pullQuoteText}>{pullQuote}</Text>
            </Section>
          </Section>
        )}

        {/* ── MOMENT CARD ── */}
        {momentText && (
          <Section style={bodySection}>
            <Section style={momentCard}>
              <Text style={momentCardLabel}>{(momentLabel || 'A MOMENT').toUpperCase()}</Text>
              <Text style={momentCardText}>{momentText}</Text>
            </Section>
          </Section>
        )}

        {/* ── DIVIDER ── */}
        <Section style={dividerSection}>
          <Hr style={ruleDivider} />
          <Text style={dividerGlyph}>⌁</Text>
        </Section>

        {/* ── WHAT'S HAPPENING ── */}
        {happenings && happenings.length > 0 && (
          <Section style={happeningSection}>
            <Text style={happeningLabel}>WHAT'S HAPPENING AT DEAD SET</Text>
            {happenings.map((item, i) => (
              <Section key={i} style={happeningItem}>
                <Row>
                  <Column style={happeningGlyphCell}>
                    <Text style={happeningGlyphSt}>{item.glyph}</Text>
                  </Column>
                  <Column style={happeningTextCell}>
                    <Text style={happeningTitleSt}>{item.title}</Text>
                    <Text style={happeningDetailSt}>{item.detail}</Text>
                  </Column>
                </Row>
              </Section>
            ))}
          </Section>
        )}

        {/* ── DIVIDER ── */}
        <Section style={dividerSection}>
          <Hr style={ruleDivider} />
          <Text style={dividerGlyph}>⌂</Text>
        </Section>

        {/* ── CTA ── */}
        <Section style={ctaSection}>
          <Text style={ctaEyebrowSt}>{ctaEyebrow.toUpperCase()}</Text>
          <Text style={ctaHeadlineSt}>{ctaHeadline}</Text>
          <Link href={SITE_URL_UTM} style={ctaButton}>OPEN DEAD SET</Link>
          <Text style={ctaSub}>dead-set.org &nbsp;·&nbsp; Free, always</Text>
        </Section>

        {/* ── BACKSTAGE BOX ── */}
        <Section style={backstageBox}>
          <Text style={backstageBadge}>Backstage</Text>
          <Text style={backstageBodySt}>{backstageText}</Text>
          <Text style={backstagePillRow}>
            <Link href={BACKSTAGE_URL} style={backstagePill}>✦&nbsp;&nbsp;Wish List</Link>
            {' '}
            <Link href={BACKSTAGE_URL} style={backstagePill}>⌁&nbsp;&nbsp;Bug Log</Link>
            {' '}
            <Link href={BACKSTAGE_URL} style={backstagePill}>◎&nbsp;&nbsp;Share Your Set</Link>
          </Text>
          <Link href={BACKSTAGE_URL} style={backstageCta}>Go Backstage&nbsp;&nbsp;↗</Link>
        </Section>

        {/* ── SIGN-OFF ── */}
        <Section style={signoff}>
          <Text style={signoffText}>{signoffBody}</Text>
          <Text style={signoffClosing}>Gratefully yours,</Text>
          <Text style={signoffName}>grateful_jaguaro</Text>
          <Text style={signoffTitleSt}>FOUNDER · DEAD SET · DEAD-SET.ORG</Text>
        </Section>

        {/* ── PS ── */}
        {psText && (
          <Section style={psSection}>
            <Text style={psTextSt}>
              <strong style={gold}>P.S.</strong> — {psText}
            </Text>
          </Section>
        )}

        {/* ── FOOTER ── */}
        <Section style={footer}>
          <Hr style={ruleFaint} />
          <Text style={footerLogo}>DEAD SET · DEAD-SET.ORG</Text>
          <Text style={footerCopy}>
            Sent from{' '}
            <Link href="mailto:noreply@notify.dead-set.org" style={footerLink}>noreply@dead-set.org</Link>
            <br />
            By the community, for the community.
            <br />
            Please copy and share freely &nbsp;·&nbsp; Trade only
            <br />
            <Link href={SITE_URL_UTM} style={footerLink}>Open Dead Set</Link>
          </Text>
          <Text style={footerTapeLabel}>SBD {'>'} MR · NON-COMMERCIAL · THE MUSIC NEVER STOPS</Text>
        </Section>

      </Container>
    </Body>
  </Html>
)

export const template = {
  component: LotDispatchEmail,
  subject: (data: Record<string, any>) =>
    `Dead Set · Dispatch from the Lot — ${data.artist || 'A Night to Remember'}`,
  displayName: 'Dispatch from the Lot',
  previewData: {},
} satisfies TemplateEntry

// ── STYLES (Gmail-safe: inline only, web-safe fonts) ──

const gold = { color: '#c9a84c', fontWeight: '500' as const }
const main = { backgroundColor: '#0a0a0a', fontFamily: FF_SANS, color: '#c8c4b0' } as React.CSSProperties
const wrapper = { maxWidth: '620px', margin: '0 auto', backgroundColor: '#0d0d0d', padding: '0' } as React.CSSProperties

const ruleGold = { borderColor: '#c9a84c', borderTop: '1px solid #c9a84c', margin: '0 0 20px' } as React.CSSProperties
const ruleFaint = { borderColor: '#2a2410', borderTop: '1px solid #2a2410', margin: '0' } as React.CSSProperties
const ruleDivider = { borderColor: '#2a2410', borderTop: '1px solid #2a2410', margin: '0' } as React.CSSProperties

// Header
const header = { backgroundColor: '#0a0a0a', borderBottom: '1px solid #2a2410', padding: '28px 40px 24px', textAlign: 'center' as const } as React.CSSProperties
const siteNameSt = { fontFamily: FF_SERIF, fontSize: '22px', fontWeight: '700' as const, color: '#c9a84c', letterSpacing: '0.08em', textTransform: 'uppercase' as const, margin: '0 0 8px' } as React.CSSProperties
const headerMeta = { fontFamily: FF_MONO, fontSize: '12px', letterSpacing: '0.18em', color: '#b09e78', textTransform: 'uppercase' as const, margin: '0 0 20px' } as React.CSSProperties

// Show hero
const showHero = { backgroundColor: '#0a0a0a', padding: '40px 40px 0', textAlign: 'center' as const, borderBottom: '1px solid #1e1c10' } as React.CSSProperties
const showEyebrow = { fontFamily: FF_MONO, fontSize: '11px', letterSpacing: '0.28em', color: '#b09e78', textTransform: 'uppercase' as const, margin: '0 0 16px' } as React.CSSProperties
const showTitle = { fontFamily: FF_SERIF, fontSize: '36px', fontWeight: '400' as const, fontStyle: 'italic' as const, color: '#c9a84c', lineHeight: '1.15', margin: '0 0 20px' } as React.CSSProperties
const showTagline = { fontFamily: FF_MONO, fontSize: '12px', letterSpacing: '0.28em', color: '#b09e78', textTransform: 'uppercase' as const, margin: '0 0 4px' } as React.CSSProperties
const metaRow = { marginTop: '20px' } as React.CSSProperties
const metaCell = { padding: '14px 8px', textAlign: 'center' as const, width: '33.33%' } as React.CSSProperties
const metaCellMiddle = { ...metaCell, borderLeft: '1px solid #2a2410', borderRight: '1px solid #2a2410' } as React.CSSProperties
const metaLabel = { fontFamily: FF_MONO, fontSize: '9px', letterSpacing: '0.22em', color: '#6b6450', textTransform: 'uppercase' as const, margin: '0 0 5px' } as React.CSSProperties
const metaValue = { fontFamily: FF_MONO, fontSize: '12px', color: '#c8c4b0', letterSpacing: '0.08em', margin: '0' } as React.CSSProperties

// Tape strip
const tapeStrip = { backgroundColor: '#0f0e08', borderTop: '1px solid #2a2410', borderBottom: '1px solid #2a2410', padding: '10px 40px', textAlign: 'center' as const } as React.CSSProperties
const tapeText = { fontFamily: FF_MONO, fontSize: '10px', letterSpacing: '0.22em', color: '#4a4535', textTransform: 'uppercase' as const, margin: '0' } as React.CSSProperties

// Body
const bodySection = { padding: '32px 48px 0', backgroundColor: '#0d0d0d' } as React.CSSProperties
const dispatchLabel = { fontFamily: FF_MONO, fontSize: '11px', letterSpacing: '0.28em', color: '#b09e78', textTransform: 'uppercase' as const, margin: '0 0 20px', paddingBottom: '12px', borderBottom: '1px solid #1e1c10' } as React.CSSProperties
const salutation = { fontFamily: FF_CURSIVE, fontSize: '22px', color: '#c9a84c', margin: '0 0 24px' } as React.CSSProperties
const bodyP = { fontFamily: FF_SANS, fontSize: '15px', fontWeight: '300' as const, lineHeight: '1.85', color: '#b0ac9a', margin: '0 0 20px' } as React.CSSProperties

// Pull quote
const pullQuoteSt = { borderLeft: '2px solid #c9a84c', margin: '8px 0 20px', padding: '4px 0 4px 20px' } as React.CSSProperties
const pullQuoteText = { fontFamily: FF_SERIF, fontSize: '19px', fontStyle: 'italic' as const, color: '#c9a84c', lineHeight: '1.5', margin: '0' } as React.CSSProperties

// Moment card
const momentCard = { backgroundColor: '#0f0e08', border: '1px solid #2a2410', borderLeft: '3px solid #c9a84c', padding: '20px 22px', margin: '0 0 20px' } as React.CSSProperties
const momentCardLabel = { fontFamily: FF_MONO, fontSize: '10px', letterSpacing: '0.18em', color: '#b09e78', textTransform: 'uppercase' as const, margin: '0 0 10px' } as React.CSSProperties
const momentCardText = { fontFamily: FF_CURSIVE, fontSize: '19px', color: '#c8c4b0', lineHeight: '1.6', margin: '0' } as React.CSSProperties

// Divider
const dividerSection = { padding: '0 40px', margin: '0', textAlign: 'center' as const } as React.CSSProperties
const dividerGlyph = { display: 'inline-block', backgroundColor: '#0d0d0d', padding: '0 12px', color: '#c9a84c', fontSize: '13px', margin: '-8px 0 0' } as React.CSSProperties

// Happening section
const happeningSection = { padding: '36px 48px 32px', backgroundColor: '#0a0a0a', borderTop: '1px solid #1e1c10', borderBottom: '1px solid #1e1c10' } as React.CSSProperties
const happeningLabel = { fontFamily: FF_MONO, fontSize: '11px', letterSpacing: '0.28em', color: '#b09e78', textTransform: 'uppercase' as const, margin: '0 0 20px', paddingBottom: '12px', borderBottom: '1px solid #1e1c10' } as React.CSSProperties
const happeningItem = { padding: '12px 0', borderBottom: '1px solid #161610' } as React.CSSProperties
const happeningGlyphCell = { width: '36px', verticalAlign: 'top' as const, paddingTop: '2px' } as React.CSSProperties
const happeningGlyphSt = { fontFamily: FF_MONO, fontSize: '14px', color: '#c9a84c', margin: '0' } as React.CSSProperties
const happeningTextCell = { verticalAlign: 'top' as const } as React.CSSProperties
const happeningTitleSt = { fontFamily: FF_SANS, fontSize: '14px', fontWeight: '500' as const, color: '#c8c4b0', lineHeight: '1.4', margin: '0 0 3px' } as React.CSSProperties
const happeningDetailSt = { fontFamily: FF_SANS, fontSize: '13px', fontWeight: '300' as const, color: '#7a7660', lineHeight: '1.6', margin: '0' } as React.CSSProperties

// CTA
const ctaSection = { padding: '40px 48px 44px', textAlign: 'center' as const, backgroundColor: '#0d0d0d' } as React.CSSProperties
const ctaEyebrowSt = { fontFamily: FF_MONO, fontSize: '11px', letterSpacing: '0.22em', color: '#a09880', textTransform: 'uppercase' as const, margin: '0 0 14px' } as React.CSSProperties
const ctaHeadlineSt = { fontFamily: FF_SERIF, fontSize: '24px', fontStyle: 'italic' as const, color: '#c9a84c', margin: '0 0 20px', lineHeight: '1.3', whiteSpace: 'pre-line' as const } as React.CSSProperties
const ctaButton = { display: 'inline-block', fontFamily: FF_SANS, fontSize: '13px', fontWeight: '500' as const, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: '#0a0a0a', backgroundColor: '#c9a84c', padding: '14px 36px', textDecoration: 'none' } as React.CSSProperties
const ctaSub = { fontFamily: FF_SANS, fontSize: '13px', color: '#a09880', margin: '12px 0 0' } as React.CSSProperties

// Backstage box
const backstageBox = { backgroundColor: '#0f0e08', border: '1px solid #2a2410', borderLeft: '3px solid #c9a84c', padding: '20px 22px', margin: '0 48px 28px' } as React.CSSProperties
const backstageBadge = { fontFamily: FF_SANS, fontSize: '13px', fontWeight: '500' as const, color: '#0a0a0a', backgroundColor: '#c9a84c', padding: '5px 14px', margin: '0 0 14px', display: 'inline-block' } as React.CSSProperties
const backstageBodySt = { fontFamily: FF_SANS, fontSize: '14px', fontWeight: '300' as const, color: '#b0ac9a', lineHeight: '1.7', margin: '14px 0' } as React.CSSProperties
const backstagePillRow = { margin: '14px 0' } as React.CSSProperties
const backstagePill = { display: 'inline-block', fontFamily: FF_MONO, fontSize: '11px', letterSpacing: '0.10em', textTransform: 'uppercase' as const, color: '#c9a84c', backgroundColor: '#1a1408', border: '1px solid #4a3a18', padding: '5px 12px', margin: '4px 6px 4px 0', textDecoration: 'none' } as React.CSSProperties
const backstageCta = { display: 'inline-block', fontFamily: FF_MONO, fontSize: '13px', fontWeight: '500' as const, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#0a0a0a', backgroundColor: '#c9a84c', padding: '10px 22px', textDecoration: 'none', marginTop: '4px' } as React.CSSProperties

// Sign-off
const signoff = { padding: '8px 48px 36px', backgroundColor: '#0d0d0d' } as React.CSSProperties
const signoffText = { fontFamily: FF_SANS, fontSize: '15px', fontWeight: '300' as const, lineHeight: '1.85', color: '#b0ac9a', margin: '0 0 20px' } as React.CSSProperties
const signoffClosing = { fontFamily: FF_CURSIVE, fontSize: '16px', color: '#a09880', margin: '0 0 4px' } as React.CSSProperties
const signoffName = { fontFamily: FF_CURSIVE, fontSize: '28px', color: '#c9a84c', margin: '0 0 2px' } as React.CSSProperties
const signoffTitleSt = { fontFamily: FF_MONO, fontSize: '11px', color: '#a09880', letterSpacing: '0.14em', textTransform: 'uppercase' as const, margin: '0' } as React.CSSProperties

// PS
const psSection = { padding: '20px 48px 28px', borderTop: '1px solid #1a1a12', backgroundColor: '#0d0d0d' } as React.CSSProperties
const psTextSt = { fontFamily: FF_SERIF, fontSize: '15px', fontStyle: 'italic' as const, color: '#a09880', lineHeight: '1.7', margin: '0' } as React.CSSProperties

// Footer
const footer = { backgroundColor: '#080808', borderTop: '1px solid #1a1408', padding: '24px 40px', textAlign: 'center' as const } as React.CSSProperties
const footerLogo = { fontFamily: FF_SERIF, fontSize: '13px', color: '#a09880', letterSpacing: '0.1em', textTransform: 'uppercase' as const, margin: '0 0 8px' } as React.CSSProperties
const footerCopy = { fontFamily: FF_MONO, fontSize: '11px', color: '#8a8270', letterSpacing: '0.12em', textTransform: 'uppercase' as const, lineHeight: '1.9', margin: '0' } as React.CSSProperties
const footerLink = { color: '#a09880', textDecoration: 'underline' }
const footerTapeLabel = { fontFamily: FF_MONO, fontSize: '11px', color: '#6b6450', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #2a2820' } as React.CSSProperties
