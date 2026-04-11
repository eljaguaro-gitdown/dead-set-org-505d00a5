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
const UTM = 'utm_source=email&utm_medium=transactional&utm_campaign=build-notes'
const UPDATES_URL = `${SITE_URL}/updates?${UTM}`

const FF_SERIF = "Georgia, 'Times New Roman', serif"
const FF_MONO = "'Courier New', Courier, monospace"
const FF_SANS = "Arial, Helvetica, sans-serif"
const FF_CURSIVE = "'Brush Script MT', 'Segoe Script', cursive"

interface ChangeItem {
  tag: 'fix' | 'new' | 'improved' | 'beta'
  title: string
  detail?: string
  credit?: string
}

interface BuildNotesEmailProps {
  weekNumber?: number
  weekLabel?: string
  editionTitle?: string
  statsUpdates?: number
  statsFeedback?: number
  statsBugs?: number
  set1?: ChangeItem[]
  set2?: ChangeItem[]
  encoreNote?: string
  nextWeekTeaser?: string
  betaNote?: string
}

const TAG_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  fix: { text: '#7ab87a', bg: '#0f1a0f', border: '#2a4a2a' },
  new: { text: '#c9a84c', bg: '#1a1408', border: '#4a3a18' },
  improved: { text: '#7aa8c9', bg: '#0f141a', border: '#1e3a4a' },
  beta: { text: '#c97aa8', bg: '#1a0f14', border: '#4a1e30' },
}

const TAG_LABELS: Record<string, string> = {
  fix: 'Fix',
  new: 'New',
  improved: 'Better',
  beta: 'Beta',
}

const BuildNotesEmail = ({
  weekNumber = 1,
  weekLabel = 'This week',
  editionTitle = 'What Got Better This Week',
  statsUpdates = 0,
  statsFeedback = 0,
  statsBugs = 0,
  set1 = [],
  set2 = [],
  encoreNote,
  nextWeekTeaser,
  betaNote,
}: BuildNotesEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Dead Set Build Notes — Week {weekNumber}: {editionTitle}</Preview>
    <Body style={main}>
      <Container style={wrapper}>

        {/* ── HEADER ── */}
        <Section style={header}>
          <Hr style={ruleGold} />
          <Text style={siteName}>DEAD SET</Text>
          <Text style={headerMeta}>BUILD NOTES · WEEK {weekNumber} · {weekLabel.toUpperCase()}</Text>
          <Hr style={ruleFaint} />
        </Section>

        {/* ── SHOW HEADER ── */}
        <Section style={showHeader}>
          <Text style={showNumber}>BETA · EDITION {String(weekNumber).padStart(3, '0')}</Text>
          <Text style={showTitle}>{editionTitle}</Text>
          <Text style={heroTaglineSt}>WAIT. NOW. DISCOVER.</Text>
          <Text style={showVenue}>DEAD SET LAB · SAN FRANCISCO, CA · BETA SEASON</Text>
        </Section>

        {/* ── STATS ROW ── */}
        <Section style={statRow}>
          <Row>
            <Column style={statCell}>
              <Text style={statNumber}>{statsUpdates}</Text>
              <Text style={statLabel}>Updates shipped</Text>
            </Column>
            <Column style={statCellMiddle}>
              <Text style={statNumber}>{statsFeedback}</Text>
              <Text style={statLabel}>From your feedback</Text>
            </Column>
            <Column style={statCell}>
              <Text style={statNumber}>{statsBugs}</Text>
              <Text style={statLabel}>Bugs squashed</Text>
            </Column>
          </Row>
        </Section>

        {/* ── BETA COMMUNITY BLOCK ── */}
        {betaNote && (
          <Section style={betaBlock}>
            <Section style={betaInner}>
              <Text style={betaEyebrow}>YOU ARE ONE OF A SMALL, HANDPICKED GROUP</Text>
              <Text style={betaHeadline}>The Founding Deadheads.</Text>
              <Text style={betaBody}>{betaNote}</Text>
              <Hr style={ruleFaint} />
              <Text style={betaBadgeRow}>
                <span style={betaBadge}>BETA DEADHEAD</span>
                <span style={betaBadgeDivider}> · </span>
                <span style={betaBadgeText}>FOUNDING SEASON · 2026</span>
              </Text>
            </Section>
          </Section>
        )}

        {/* ── DIVIDER ⌂ ── */}
        <Section style={dividerSection}>
          <Hr style={ruleFaint} />
          <Text style={dividerGlyph}>⌂</Text>
        </Section>

        {/* ── SET I ── */}
        {set1.length > 0 && (
          <Section style={setSection}>
            <Text style={setLabel}>SET I · FIXES</Text>
            {set1.map((item, i) => (
              <Section key={i} style={changeItem}>
                <Row>
                  <Column style={changeTagCell}>
                    <span style={{
                      ...tagBadge,
                      color: TAG_COLORS[item.tag]?.text || '#c9a84c',
                      backgroundColor: TAG_COLORS[item.tag]?.bg || '#1a1408',
                      borderColor: TAG_COLORS[item.tag]?.border || '#4a3a18',
                    }}>{TAG_LABELS[item.tag] || 'New'}</span>
                  </Column>
                  <Column style={changeTextCell}>
                    <Text style={changeTitle}>{item.title}</Text>
                    {item.detail && <Text style={changeDetail}>{item.detail}</Text>}
                    {item.credit && <Text style={changeCredit}>↳ {item.credit}</Text>}
                  </Column>
                </Row>
              </Section>
            ))}
          </Section>
        )}

        {/* ── DIVIDER ⌁ ── */}
        <Section style={dividerSection}>
          <Hr style={ruleFaint} />
          <Text style={dividerGlyph}>⌁</Text>
        </Section>

        {/* ── SET II ── */}
        {set2.length > 0 && (
          <Section style={setSection}>
            <Text style={setLabel}>SET II · NEW &amp; IMPROVED</Text>
            {set2.map((item, i) => (
              <Section key={i} style={changeItem}>
                <Row>
                  <Column style={changeTagCell}>
                    <span style={{
                      ...tagBadge,
                      color: TAG_COLORS[item.tag]?.text || '#c9a84c',
                      backgroundColor: TAG_COLORS[item.tag]?.bg || '#1a1408',
                      borderColor: TAG_COLORS[item.tag]?.border || '#4a3a18',
                    }}>{TAG_LABELS[item.tag] || 'New'}</span>
                  </Column>
                  <Column style={changeTextCell}>
                    <Text style={changeTitle}>{item.title}</Text>
                    {item.detail && <Text style={changeDetail}>{item.detail}</Text>}
                    {item.credit && <Text style={changeCredit}>↳ {item.credit}</Text>}
                  </Column>
                </Row>
              </Section>
            ))}
          </Section>
        )}

        {/* ── ENCORE ── */}
        {encoreNote && (
          <Section style={encoreSection}>
            <Text style={encoreLabel}>ENCORE · FROM THE LAB</Text>
            <Text style={encoreText}>{encoreNote}</Text>
          </Section>
        )}

        {/* ── FEEDBACK BOX ── */}
        <Section style={feedbackBox}>
          <Text style={feedbackLabel}>YOUR FEEDBACK SHAPES THE NEXT SET</Text>
          <Text style={feedbackText}>
            Found something broken? Have a feature you'd kill for? Head to Backstage — our beta inner circle where your bug reports, wish list items, and ideas go directly into the next build. No ticket system. No support queue. Just Deadheads building together.
          </Text>
          <Link href={`${SITE_URL}/backstage?${UTM}`} style={feedbackLink}>OPEN BACKSTAGE ↗</Link>
        </Section>

        {/* ── SIGN-OFF ── */}
        <Section style={signoff}>
          <Text style={signoffClosing}>Gratefully yours,</Text>
          <Text style={signoffName}>grateful_jaguaro</Text>
          <Text style={signoffTitle}>FOUNDER · DEAD SET · DEAD-SET.ORG</Text>
        </Section>

        {/* ── NEXT SHOW TEASER ── */}
        {nextWeekTeaser && (
          <Section style={nextShow}>
            <Text style={nextShowLabel}>ON THE SETLIST FOR NEXT WEEK</Text>
            <Text style={nextShowText}>{nextWeekTeaser}</Text>
          </Section>
        )}

        {/* ── FOOTER ── */}
        <Section style={footer}>
          <Hr style={ruleFaint} />
          <Text style={footerLogo}>DEAD SET · DEAD-SET.ORG</Text>
          <Text style={footerCopy}>
            Sent from{' '}
            <Link href="mailto:grateful_jaguaro@dead-set.org" style={footerLink}>grateful_jaguaro@dead-set.org</Link>
            <br />
            You're getting this because you're a Dead Set beta Deadhead.
            <br />
            Please copy and share freely · Trade only
            <br />
            <Link href={UPDATES_URL} style={footerLink}>Open Dead Set</Link>
          </Text>
          <Text style={footerTapeLabel}>SBD {'>'} MR · NON-COMMERCIAL · THE MUSIC NEVER STOPS</Text>
        </Section>

      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BuildNotesEmail,
  subject: (data: Record<string, any>) =>
    `Dead Set Build Notes — Week ${data.weekNumber || '?'}: ${data.editionTitle || 'What\'s New'}`,
  displayName: 'Build notes notification',
  previewData: {
    weekNumber: 1,
    weekLabel: 'Apr 7–11, 2026',
    editionTitle: 'What Got Better This Week',
    statsUpdates: 12,
    statsFeedback: 4,
    statsBugs: 3,
    betaNote: "Before there's a launch. Before there's an app store listing. Before anyone else gets a look — there's you. The people in this list are shaping what Dead Set becomes. Your feedback, your bug reports, your feature requests — they're not going into a ticket queue. They're going directly into the next build.\n\nI don't take that lightly. Every session you spend in the app, every reply you send, every \"dude have you heard this\" moment you have and share with me — that's a gift. I am genuinely, gratefully yours for it.",
    set1: [
      { tag: 'fix', title: 'Era filter returning wrong decade', detail: '1977 shows were occasionally appearing in the 1970–74 bucket. Fixed the date range boundary logic.' },
      { tag: 'fix', title: 'Mobile CTA button not tapping on iPhone SE', detail: 'Touch target was too small on smaller screens. Expanded the hit area.', credit: 'reported by a beta Deadhead' },
      { tag: 'fix', title: 'Cosmic Charlie occasionally returning duplicate songs', detail: 'Deduplication logic now runs before the setlist is assembled, not after.' },
    ],
    set2: [
      { tag: 'new', title: 'Surprise Me shortcut', detail: 'Skip the preference flow entirely. One tap, Cosmic Charlie takes the wheel.' },
      { tag: 'new', title: 'Phil-only era filter', detail: 'Filter setlists by Phil Lesh-led lineups. Because someone asked, and they were right to ask.', credit: 'built for a beta Deadhead who knows what they want' },
      { tag: 'improved', title: 'Cosmic Charlie response time', detail: '40% faster on average. The setlist generation pipeline got leaner.' },
      { tag: 'improved', title: 'Setlist poster layout on mobile', detail: 'The two-column setlist was collapsing awkwardly on narrow screens. Cleaned up the responsive layout.' },
      { tag: 'beta', title: 'Show score (early preview)', detail: 'Paste any setlist and get a rating of how legendary that night was. Rough edges — that\'s why you\'re here.' },
    ],
    encoreNote: "This was a fast week. Shipping multiple times a day is the only way to build something that actually works — you can't think your way to a good product, you have to play it live.\n\nThe Phil filter came from one of you. That's the whole point. Keep telling me what's broken, what's missing, what would make you come back tomorrow. I'm reading every message.\n\nYou're the reason this exists. Not just the app — the feeling that it's worth building at all. You are the first set. You set the tone. Everything that comes after carries your fingerprints on it.\n\nGratefully. Always.",
    nextWeekTeaser: 'Better search · Era tooltips · Something you haven\'t asked for yet',
  },
} satisfies TemplateEntry

// ── STYLES (Gmail-safe: inline only, web-safe fonts) ──

const main = { backgroundColor: '#0a0a0a', fontFamily: FF_SANS, color: '#c8c4b0' } as React.CSSProperties
const wrapper = { maxWidth: '620px', margin: '0 auto', backgroundColor: '#0d0d0d', padding: '0' } as React.CSSProperties

const ruleGold = { borderColor: '#c9a84c', borderTop: '1px solid #c9a84c', margin: '0 0 20px' } as React.CSSProperties
const ruleFaint = { borderColor: '#2a2410', borderTop: '1px solid #2a2410', margin: '0' } as React.CSSProperties

// Header
const header = { backgroundColor: '#0a0a0a', borderBottom: '1px solid #2a2410', padding: '28px 40px 24px', textAlign: 'center' as const } as React.CSSProperties
const siteName = { fontFamily: FF_SERIF, fontSize: '22px', fontWeight: '700' as const, color: '#c9a84c', letterSpacing: '0.08em', textTransform: 'uppercase' as const, margin: '0 0 8px' } as React.CSSProperties
const headerMeta = { fontFamily: FF_MONO, fontSize: '12px', letterSpacing: '0.18em', color: '#b09e78', textTransform: 'uppercase' as const, margin: '0 0 20px' } as React.CSSProperties

// Show header
const showHeader = { backgroundColor: '#0a0a0a', padding: '32px 40px 28px', textAlign: 'center' as const, borderBottom: '1px solid #1a1a12' } as React.CSSProperties
const showNumber = { fontFamily: FF_MONO, fontSize: '11px', letterSpacing: '0.28em', color: '#b09e78', textTransform: 'uppercase' as const, margin: '0 0 10px' } as React.CSSProperties
const showTitle = { fontFamily: FF_SERIF, fontSize: '30px', fontWeight: '400' as const, fontStyle: 'italic' as const, color: '#c9a84c', lineHeight: '1.2', margin: '0 0 12px' } as React.CSSProperties
const heroTaglineSt = { fontFamily: FF_MONO, fontSize: '13px', letterSpacing: '4px', color: '#b09e78', margin: '12px 0 16px' } as React.CSSProperties
const showVenue = { fontFamily: FF_MONO, fontSize: '12px', color: '#a09880', letterSpacing: '0.12em', textTransform: 'uppercase' as const, margin: '0' } as React.CSSProperties

// Stats
const statRow = { backgroundColor: '#0f0e08', borderTop: '1px solid #1e1c10', borderBottom: '1px solid #1e1c10' } as React.CSSProperties
const statCell = { padding: '16px 0', textAlign: 'center' as const, width: '33.33%' } as React.CSSProperties
const statCellMiddle = { ...statCell, borderLeft: '1px solid #2a2410', borderRight: '1px solid #2a2410' } as React.CSSProperties
const statNumber = { fontFamily: FF_SERIF, fontSize: '28px', fontWeight: '700' as const, color: '#c9a84c', lineHeight: '1', margin: '0' } as React.CSSProperties
const statLabel = { fontFamily: FF_MONO, fontSize: '10px', letterSpacing: '0.16em', color: '#a09880', textTransform: 'uppercase' as const, margin: '5px 0 0' } as React.CSSProperties

// Beta community block
const betaBlock = { backgroundColor: '#0a0a0a', borderTop: '1px solid #1e1c10', borderBottom: '1px solid #1e1c10', padding: '36px 48px 32px' } as React.CSSProperties
const betaInner = { borderLeft: '2px solid #c9a84c', paddingLeft: '20px' } as React.CSSProperties
const betaEyebrow = { fontFamily: FF_MONO, fontSize: '11px', letterSpacing: '0.22em', color: '#b09e78', textTransform: 'uppercase' as const, margin: '0 0 10px' } as React.CSSProperties
const betaHeadline = { fontFamily: FF_SERIF, fontSize: '26px', fontWeight: '400' as const, fontStyle: 'italic' as const, color: '#c9a84c', lineHeight: '1.2', margin: '0 0 18px' } as React.CSSProperties
const betaBody = { fontFamily: FF_SANS, fontSize: '14px', fontWeight: '300' as const, color: '#b0ac9a', lineHeight: '1.85', margin: '0 0 16px', whiteSpace: 'pre-line' as const } as React.CSSProperties
const betaBadge = { display: 'inline', fontFamily: FF_MONO, fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: '#c9a84c', backgroundColor: '#1a1408', border: '1px solid #4a3a18', borderRadius: '2px', padding: '4px 10px' } as React.CSSProperties
const betaBadgeDivider = { fontFamily: FF_MONO, fontSize: '12px', color: '#4a4535', margin: '0 6px' } as React.CSSProperties
const betaBadgeText = { fontFamily: FF_MONO, fontSize: '11px', color: '#7a7060', letterSpacing: '0.10em', textTransform: 'uppercase' as const } as React.CSSProperties
const betaBadgeRow = { marginTop: '16px', paddingTop: '16px' } as React.CSSProperties

// Divider with glyph
const dividerSection = { padding: '0 40px', margin: '0', textAlign: 'center' as const } as React.CSSProperties
const dividerGlyph = { display: 'inline-block', backgroundColor: '#0d0d0d', padding: '0 12px', color: '#c9a84c', fontSize: '13px', margin: '-8px 0 0', fontFamily: FF_SANS } as React.CSSProperties

// Set sections
const setSection = { padding: '32px 48px 8px', backgroundColor: '#0d0d0d' } as React.CSSProperties
const setLabel = { fontFamily: FF_MONO, fontSize: '11px', letterSpacing: '0.28em', color: '#b09e78', textTransform: 'uppercase' as const, borderBottom: '1px solid #1e1c10', paddingBottom: '10px', margin: '0 0 16px' } as React.CSSProperties

// Change items
const changeItem = { paddingBottom: '12px', paddingTop: '12px', borderBottom: '1px solid #161610' } as React.CSSProperties
const changeTagCell = { width: '80px', verticalAlign: 'top' as const, paddingTop: '2px', paddingRight: '14px' } as React.CSSProperties
const changeTextCell = { verticalAlign: 'top' as const } as React.CSSProperties
const tagBadge = { display: 'inline-block', fontFamily: FF_MONO, fontSize: '9px', letterSpacing: '0.10em', textTransform: 'uppercase' as const, padding: '3px 7px', borderRadius: '2px', borderWidth: '1px', borderStyle: 'solid' as const, whiteSpace: 'nowrap' as const } as React.CSSProperties
const changeTitle = { fontFamily: FF_SANS, fontSize: '14px', fontWeight: '500' as const, color: '#c8c4b0', lineHeight: '1.4', margin: '0 0 3px' } as React.CSSProperties
const changeDetail = { fontFamily: FF_SANS, fontSize: '13px', fontWeight: '300' as const, color: '#7a7660', lineHeight: '1.6', margin: '0' } as React.CSSProperties
const changeCredit = { fontFamily: FF_MONO, fontSize: '10px', color: '#c9a84c', letterSpacing: '0.08em', margin: '4px 0 0' } as React.CSSProperties

// Encore
const encoreSection = { padding: '32px 48px 28px', backgroundColor: '#0d0d0d' } as React.CSSProperties
const encoreLabel = { fontFamily: FF_MONO, fontSize: '11px', letterSpacing: '0.28em', color: '#b09e78', textTransform: 'uppercase' as const, margin: '0 0 16px', paddingBottom: '10px', borderBottom: '1px solid #1e1c10' } as React.CSSProperties
const encoreText = { fontFamily: FF_CURSIVE, fontSize: '19px', color: '#c8c4b0', lineHeight: '1.65', margin: '0', whiteSpace: 'pre-line' as const } as React.CSSProperties

// Feedback box
const feedbackBox = { backgroundColor: '#0f0e08', border: '1px solid #2a2410', borderLeft: '3px solid #c9a84c', borderRadius: '2px', padding: '18px 20px', margin: '28px 48px' } as React.CSSProperties
const feedbackLabel = { fontFamily: FF_MONO, fontSize: '11px', letterSpacing: '0.18em', color: '#b09e78', textTransform: 'uppercase' as const, margin: '0 0 8px' } as React.CSSProperties
const feedbackText = { fontFamily: FF_SANS, fontSize: '14px', fontWeight: '300' as const, color: '#b0ac9a', lineHeight: '1.7', margin: '0 0 12px' } as React.CSSProperties
const feedbackLink = { fontFamily: FF_MONO, fontSize: '12px', color: '#c9a84c', textDecoration: 'none' as const, letterSpacing: '0.08em', textTransform: 'uppercase' as const } as React.CSSProperties

// Sign-off
const signoff = { padding: '28px 48px 8px', backgroundColor: '#0d0d0d' } as React.CSSProperties
const signoffClosing = { fontFamily: FF_CURSIVE, fontSize: '16px', color: '#a09880', margin: '0 0 2px' } as React.CSSProperties
const signoffName = { fontFamily: FF_CURSIVE, fontSize: '28px', color: '#c9a84c', margin: '0 0 4px' } as React.CSSProperties
const signoffTitle = { fontFamily: FF_MONO, fontSize: '11px', color: '#a09880', letterSpacing: '0.14em', textTransform: 'uppercase' as const, margin: '0 0 28px' } as React.CSSProperties

// Next show teaser
const nextShow = { backgroundColor: '#0f0e08', borderTop: '1px solid #1e1c10', borderBottom: '1px solid #1e1c10', padding: '20px 48px', textAlign: 'center' as const } as React.CSSProperties
const nextShowLabel = { fontFamily: FF_MONO, fontSize: '11px', letterSpacing: '0.22em', color: '#6b6450', textTransform: 'uppercase' as const, margin: '0 0 6px' } as React.CSSProperties
const nextShowText = { fontFamily: FF_SERIF, fontSize: '15px', fontStyle: 'italic' as const, color: '#a09880', margin: '0' } as React.CSSProperties

// Footer
const footer = { backgroundColor: '#080808', borderTop: '1px solid #1a1408', padding: '24px 40px', textAlign: 'center' as const } as React.CSSProperties
const footerLogo = { fontFamily: FF_SERIF, fontSize: '13px', color: '#a09880', letterSpacing: '0.1em', textTransform: 'uppercase' as const, margin: '16px 0 8px' } as React.CSSProperties
const footerCopy = { fontFamily: FF_MONO, fontSize: '11px', color: '#8a8270', letterSpacing: '0.12em', textTransform: 'uppercase' as const, lineHeight: '1.9', margin: '0' } as React.CSSProperties
const footerLink = { color: '#a09880', textDecoration: 'underline' as const } as React.CSSProperties
const footerTapeLabel = { fontFamily: FF_MONO, fontSize: '11px', color: '#6b6450', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #2a2820' } as React.CSSProperties
