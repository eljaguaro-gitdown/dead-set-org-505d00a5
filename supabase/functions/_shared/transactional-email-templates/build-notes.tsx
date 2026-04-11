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
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_URL = 'https://dead-set.org'
const UTM = 'utm_source=email&utm_medium=transactional&utm_campaign=build-notes'
const UPDATES_URL = `${SITE_URL}/updates?${UTM}`

interface ChangeItem {
  tag: 'fix' | 'new' | 'improved' | 'beta'
  title: string
  detail?: string
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
}

const TAG_COLORS: Record<string, { text: string; bg: string }> = {
  fix: { text: '#7ab87a', bg: '#0f1a0f' },
  new: { text: '#c9a84c', bg: '#1a1408' },
  improved: { text: '#7aa8c9', bg: '#0f141a' },
  beta: { text: '#c97aa8', bg: '#1a0f14' },
}

const TAG_LABELS: Record<string, string> = {
  fix: 'FIX',
  new: 'NEW',
  improved: 'BETTER',
  beta: 'BETA',
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
}: BuildNotesEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=DM+Sans:wght@300;400;500&family=Caveat:wght@400;600&family=JetBrains+Mono:wght@400&display=swap');`}</style>
    </Head>
    <Preview>Dead Set Build Notes — Week {weekNumber}: {editionTitle}</Preview>
    <Body style={main}>
      <Container style={wrapper}>

        {/* ── HEADER ── */}
        <Section style={header}>
          <div style={headerRuleTop} />
          <Text style={siteName}>Dead Set</Text>
          <Text style={headerTagline}>Build Notes</Text>
          <div style={headerRuleBottom} />
        </Section>

        {/* ── HERO ── */}
        <Section style={hero}>
          <Text style={heroEyebrow}>Week {weekNumber} · {weekLabel}</Text>
          <Text style={heroHeadline}>{editionTitle}</Text>
          <Text style={heroTaglineSt}>WAIT. NOW. DISCOVER.</Text>
        </Section>

        {/* ── STATS ── */}
        <Section style={statsSection}>
          <span style={statPill}>{statsUpdates} updates shipped</span>{' '}
          <span style={statPill}>{statsFeedback} from your feedback</span>{' '}
          <span style={statPill}>{statsBugs} bugs squashed</span>
        </Section>

        {/* ── DIVIDER ── */}
        <Section style={dividerSection}>
          <div style={dividerLine} />
          <Text style={dividerGlyph}>⌂</Text>
        </Section>

        {/* ── SET I ── */}
        {set1.length > 0 && (
          <Section style={setSection}>
            <Text style={setLabel}>Set I · Fixes</Text>
            {set1.map((item, i) => (
              <Section key={i} style={changeRow}>
                <span style={{
                  ...tagBadge,
                  color: TAG_COLORS[item.tag]?.text || '#c9a84c',
                  backgroundColor: TAG_COLORS[item.tag]?.bg || '#1a1408',
                }}>{TAG_LABELS[item.tag] || 'NEW'}</span>
                <Text style={changeTitle}>{item.title}</Text>
                {item.detail && <Text style={changeDetail}>{item.detail}</Text>}
              </Section>
            ))}
          </Section>
        )}

        {/* ── SET II ── */}
        {set2.length > 0 && (
          <Section style={setSection}>
            <Text style={setLabel}>Set II · New & Improved</Text>
            {set2.map((item, i) => (
              <Section key={i} style={changeRow}>
                <span style={{
                  ...tagBadge,
                  color: TAG_COLORS[item.tag]?.text || '#c9a84c',
                  backgroundColor: TAG_COLORS[item.tag]?.bg || '#1a1408',
                }}>{TAG_LABELS[item.tag] || 'NEW'}</span>
                <Text style={changeTitle}>{item.title}</Text>
                {item.detail && <Text style={changeDetail}>{item.detail}</Text>}
              </Section>
            ))}
          </Section>
        )}

        {/* ── ENCORE ── */}
        {encoreNote && (
          <Section style={encoreSection}>
            <Text style={encoreLabel}>Encore</Text>
            <Text style={encoreText}>{encoreNote}</Text>
          </Section>
        )}

        {/* ── CTA ── */}
        <Section style={ctaSection}>
          <Text style={ctaLabel}>Full build notes</Text>
          <Link href={UPDATES_URL} style={ctaButton}>View All Updates</Link>
          <Text style={ctaSub}>dead-set.org/updates</Text>
        </Section>

        {/* ── DIVIDER ── */}
        <Section style={dividerSection}>
          <div style={dividerLine} />
          <Text style={dividerGlyph}>∿</Text>
        </Section>

        {/* ── SIGN-OFF ── */}
        <Section style={signoff}>
          <Text style={signoffClosing}>Keep on truckin',</Text>
          <Text style={signoffName}>grateful_jaguaro</Text>
          <Text style={signoffTitle}>Founder · Dead Set · dead-set.org</Text>
        </Section>

        {/* ── FOOTER ── */}
        <Section style={footer}>
          <div style={footerRule} />
          <Text style={footerLogo}>Dead Set · dead-set.org</Text>
          <Text style={footerCopy}>
            Sent from{' '}
            <Link href="mailto:noreply@notify.dead-set.org" style={footerLink}>noreply@dead-set.org</Link>
            <br />
            By the community, for the community.
            <br />
            The music never stops.
          </Text>
          <Text style={footerTapeLabel}>☠ NFA · NOT FOR SALE · FREELY GIVEN ☠</Text>
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
    statsUpdates: 14,
    statsFeedback: 6,
    statsBugs: 5,
    set1: [
      { tag: 'fix', title: 'Audio track matching', detail: 'Songs now match their actual title — no more surprise tracks' },
      { tag: 'fix', title: 'Mobile scroll lock', detail: 'Fixed a bug where the builder would freeze on scroll' },
    ],
    set2: [
      { tag: 'new', title: 'Build Notes page', detail: 'A public changelog so you can see what\'s changing week by week' },
      { tag: 'improved', title: 'Setlist poster sharing', detail: 'Cleaner layout, faster render, and proper OG images' },
      { tag: 'beta', title: 'Cosmic Charlie memory', detail: 'Charlie now remembers your favorite eras across sessions' },
    ],
    encoreNote: 'This week was a big one. We shipped more in five days than most apps ship in a month. And we\'re just getting started.',
  },
} satisfies TemplateEntry

// ── STYLES ──

const main = { backgroundColor: '#0a0a0a', fontFamily: "'DM Sans', Arial, sans-serif", color: '#c8c4b0', WebkitFontSmoothing: 'antialiased' as const }
const wrapper = { maxWidth: '620px', margin: '0 auto', backgroundColor: '#0d0d0d', padding: '0' }

// Header
const header = { backgroundColor: '#0a0a0a', borderBottom: '1px solid #2a2410', padding: '32px 40px 28px', textAlign: 'center' as const }
const headerRuleTop = { width: '100%', height: '1px', background: 'linear-gradient(90deg, transparent, #c9a84c 30%, #c9a84c 70%, transparent)', marginBottom: '24px' }
const siteName = { fontFamily: "'Playfair Display', Georgia, serif", fontSize: '26px', fontWeight: '700' as const, color: '#c9a84c', letterSpacing: '0.08em', textTransform: 'uppercase' as const, margin: '0 0 10px' }
const headerTagline = { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', letterSpacing: '0.18em', color: '#b09e78', textTransform: 'uppercase' as const, margin: '0' }
const headerRuleBottom = { width: '100%', height: '1px', background: 'linear-gradient(90deg, transparent, #2a2410 30%, #2a2410 70%, transparent)', marginTop: '24px' }

// Hero
const hero = { backgroundColor: '#0a0a0a', padding: '40px 40px 24px', textAlign: 'center' as const }
const heroEyebrow = { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', letterSpacing: '0.22em', color: '#b09e78', textTransform: 'uppercase' as const, margin: '0 0 16px' }
const heroHeadline = { fontFamily: "'Playfair Display', Georgia, serif", fontSize: '30px', fontWeight: '400' as const, fontStyle: 'italic' as const, color: '#c9a84c', lineHeight: '1.3', margin: '0' }

// Stats
const statsSection = { padding: '20px 40px 28px', textAlign: 'center' as const, borderBottom: '1px solid #1a1a12' }
const statPill = { display: 'inline-block', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', letterSpacing: '0.1em', color: '#c9a84c', border: '1px solid rgba(201,168,76,0.3)', borderRadius: '20px', padding: '4px 12px', margin: '3px 2px' }

// Divider
const dividerSection = { padding: '0 40px', margin: '0', textAlign: 'center' as const }
const dividerLine = { height: '1px', background: 'linear-gradient(90deg, transparent, #2a2410 20%, #c9a84c 50%, #2a2410 80%, transparent)' }
const dividerGlyph = { display: 'inline-block', backgroundColor: '#0d0d0d', padding: '0 12px', color: '#c9a84c', fontSize: '14px', margin: '-8px 0 0' }

// Sets
const setSection = { padding: '28px 48px 12px', backgroundColor: '#0d0d0d' }
const setLabel = { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', letterSpacing: '0.18em', color: '#a09880', textTransform: 'uppercase' as const, borderBottom: '1px solid #1e1c10', paddingBottom: '8px', margin: '0 0 16px' }

const changeRow = { marginBottom: '16px', paddingLeft: '0' }
const tagBadge = { display: 'inline-block', fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', letterSpacing: '0.14em', borderRadius: '3px', padding: '3px 8px', margin: '0 8px 4px 0', verticalAlign: 'middle' }
const changeTitle = { fontFamily: "'DM Sans', Arial, sans-serif", fontSize: '15px', fontWeight: '500' as const, color: '#b0ac9a', margin: '4px 0 2px', display: 'inline' }
const changeDetail = { fontFamily: "'DM Sans', Arial, sans-serif", fontSize: '14px', fontWeight: '300' as const, color: '#a09880', lineHeight: '1.6', margin: '2px 0 0' }

// Encore
const encoreSection = { borderLeft: '2px solid #c9a84c', margin: '8px 48px 24px', padding: '12px 0 12px 20px', backgroundColor: '#0f0e08', borderRadius: '0 4px 4px 0' }
const encoreLabel = { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', letterSpacing: '0.18em', color: '#a09880', textTransform: 'uppercase' as const, margin: '0 0 8px' }
const encoreText = { fontFamily: "'Caveat', cursive", fontSize: '20px', color: '#c8c4b0', lineHeight: '1.5', margin: '0' }

// CTA
const ctaSection = { padding: '32px 48px 36px', textAlign: 'center' as const, backgroundColor: '#0d0d0d' }
const ctaLabel = { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', letterSpacing: '0.22em', color: '#a09880', textTransform: 'uppercase' as const, margin: '0 0 16px' }
const ctaButton = { display: 'inline-block', fontFamily: "'DM Sans', Arial, sans-serif", fontSize: '13px', fontWeight: '500' as const, letterSpacing: '0.14em', textTransform: 'uppercase' as const, color: '#0a0a0a', backgroundColor: '#c9a84c', padding: '14px 36px', textDecoration: 'none', borderRadius: '2px' }
const ctaSub = { fontFamily: "'DM Sans', Arial, sans-serif", fontSize: '14px', color: '#a09880', margin: '14px 0 0' }

// Sign-off
const signoff = { padding: '8px 48px 32px', backgroundColor: '#0d0d0d' }
const signoffClosing = { fontFamily: "'Caveat', cursive", fontSize: '16px', color: '#a09880', margin: '0 0 4px' }
const signoffName = { fontFamily: "'Caveat', cursive", fontSize: '28px', color: '#c9a84c', margin: '0 0 2px' }
const signoffTitle = { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', color: '#a09880', letterSpacing: '0.14em', textTransform: 'uppercase' as const, margin: '0' }

// Footer
const footer = { backgroundColor: '#080808', borderTop: '1px solid #1a1408', padding: '28px 40px', textAlign: 'center' as const }
const footerRule = { height: '1px', background: 'linear-gradient(90deg, transparent, #2a2410 30%, #2a2410 70%, transparent)', marginBottom: '22px' }
const footerLogo = { fontFamily: "'Playfair Display', Georgia, serif", fontSize: '14px', color: '#a09880', letterSpacing: '0.1em', textTransform: 'uppercase' as const, margin: '0 0 10px' }
const footerCopy = { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', color: '#8a8270', letterSpacing: '0.14em', textTransform: 'uppercase' as const, lineHeight: '1.8', margin: '0' }
const footerLink = { color: '#a09880', textDecoration: 'underline' }
const footerTapeLabel = { fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', color: '#6b6450', letterSpacing: '0.18em', textTransform: 'uppercase' as const, marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #2a2820' }
