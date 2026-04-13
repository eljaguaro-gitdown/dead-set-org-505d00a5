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
const UTM = 'utm_source=email&utm_medium=transactional&utm_campaign=welcome'
const SITE_URL_UTM = `${SITE_URL}?${UTM}`

const FF_SERIF = "Georgia, 'Times New Roman', serif"
const FF_MONO = "'Courier New', Courier, monospace"
const FF_SANS = "Arial, Helvetica, sans-serif"
const FF_CURSIVE = "'Brush Script MT', 'Segoe Script', cursive"

interface WelcomeEmailProps {
  displayName?: string
}

const WelcomeEmail = ({ displayName }: WelcomeEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to Dead Set — you found your people</Preview>
    <Body style={main}>
      <Container style={wrapper}>

        {/* ── HEADER ── */}
        <Section style={header}>
          <Hr style={ruleGold} />
          <Text style={siteName}>DEAD SET</Text>
          <Text style={headerTagline}>DEAD-SET.ORG &nbsp;·&nbsp; 2,300 SHOWS &nbsp;·&nbsp; 50 YEARS OF MAGIC</Text>
          <Hr style={ruleMuted} />
        </Section>

        {/* ── HERO ── */}
        <Section style={hero}>
          <Text style={heroEyebrow}>WELCOME TO THE COMMUNITY</Text>
          <Text style={heroHeadline}>You found your people.<br />And your people found you.</Text>
          <Text style={heroTagline}>WAKE. NOW. DISCOVER.</Text>
          <Text style={heroSub}>A note from the founder</Text>
        </Section>

        {/* ── DIVIDER ── */}
        <Section style={dividerSection}>
          <Hr style={ruleMuted} />
        </Section>

        {/* ── BODY ── */}
        <Section style={bodySection}>
          <Text style={salutation}>Hey Now —</Text>

          <Text style={bodyP}>
            You're getting this because you signed up for Dead Set — and that means we already have something
            in common. A shared passion that's hard to explain to people who don't have it, and needs no
            explanation to people who do.
          </Text>

          <Text style={bodyP}>Grateful to meet you.</Text>

          <Text style={bodyP}>
            So — what is Dead Set, why does it exist, and who's behind it? Let me take 60 seconds and answer all three.
          </Text>

          <Text style={bodyP}>
            <strong style={gold}>Dead Set is a new way to explore the Grateful Dead's live catalog.</strong> Not a replacement
            for anything you already love — Relisten, Archive.org, SiriusXM. Additive. Another way in. Built around
            the idea that the search for the perfect version of your favorite song — by vibe, by era, by mood — is
            one of the great joys of being a Deadhead. That search never ends. Dead Set is built for it.
          </Text>

          <Text style={bodyP}>
            <strong style={gold}>Why does it exist?</strong> Because one night I was listening to Big Steve Parrish pull out
            a gem from 1973 and I thought: <em>what if we could find these moments ourselves? On demand. By feel?</em>{' '}
            That question became this.
          </Text>

          {/* Show callout */}
          <Section style={showCallout}>
            <Text style={showCalloutLabel}>THE SHOW THAT STARTED IT ALL</Text>
            <Text style={showCalloutText}>Birdsong · Roosevelt Stadium · 08-01-1973</Text>
          </Section>

          <Text style={bodyP}>
            <strong style={gold}>Who's behind it?</strong> I'm grateful_jaguaro.{' '}
            <em>(Short but long story for another time.)</em>
          </Text>

          <Text style={bodyP}>
            A 50-something New Yorker who came to the Bay Area 30 years ago and never looked back.
            San Francisco called me. Haight Street called me. The people called me. I knew the moment
            I got here that this was where I was supposed to be. With my people.
          </Text>

          {/* Pull quote */}
          <Section style={pullQuote}>
            <Text style={pullQuoteText}>
              It's more than the music. It's the community and the experiences we share. The memories, the friends, the soul. If you know, you know.
            </Text>
          </Section>

          <Text style={bodyP}>
            There's this thing that happens among us — the <strong style={gold}>never-ending search</strong>.
            The discovery of a version of your favorite song you'd never heard before. The moment someone says{' '}
            <em>"dude, have you heard this? Check this out."</em> Word of mouth. The way we do.
            That search — that discovery — is one of the great joys of being a Deadhead. The music never runs out.
          </Text>
        </Section>

        {/* ── STORY BREAK ── */}
        <Section style={storyBreak}>
          <Text style={storyBreakLabel}>THE MISSION</Text>
          <Text style={storyBreakText}>
            To be additive to the community. Not to replace Relisten or Archive.org or SiriusXM —
            but to give us another way in. Another way to find the version that hits you exactly right
            on exactly the right night.
          </Text>
        </Section>

        {/* ── BODY CONTINUED ── */}
        <Section style={bodySection}>
          <Text style={bodyP}>
            It's not perfect. It's raw and improvisational — like the band. It's early. But it's ours.
          </Text>
        </Section>

        {/* ── CTA ── */}
        <Section style={ctaSection}>
          <Text style={ctaLabel}>START EXPLORING</Text>
          <Link href={SITE_URL_UTM} style={ctaButton}>OPEN DEAD SET</Link>
          <Text style={ctaSub}>dead-set.org</Text>
        </Section>

        {/* ── DIVIDER ── */}
        <Section style={dividerSection}>
          <Hr style={ruleMuted} />
        </Section>

        {/* ── SIGN-OFF ── */}
        <Section style={signoff}>
          <Text style={signoffText}>
            I invite you to join me on the mission. Explore, discover, share. And if you find something that moves you —
            pass the tape.
          </Text>
          <Text style={signoffClosing}>Gratefully yours,</Text>
          <Text style={signoffName}>grateful_jaguaro</Text>
          <Text style={signoffTitle}>FOUNDER · DEAD SET · DEAD-SET.ORG</Text>
        </Section>

        {/* ── PS ── */}
        <Section style={psSection}>
          <Text style={psText}>
            <strong style={gold}>P.S.</strong> — The show you're looking for is out there. Let's find it together.
          </Text>
        </Section>

        {/* ── FOOTER ── */}
        <Section style={footer}>
          <Hr style={ruleMuted} />
          <Text style={footerLogo}>DEAD SET · DEAD-SET.ORG</Text>
          <Text style={footerCopy}>
            Sent from{' '}
            <Link href="mailto:noreply@notify.dead-set.org" style={footerLink}>noreply@dead-set.org</Link>
            <br />
            By the community, for the community.
            <br />
            Please copy and share freely · Trade only
          </Text>
          <Text style={footerTapeLabel}>☠ NFA · NOT FOR SALE · FREELY GIVEN ☠</Text>
        </Section>

      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomeEmail,
  subject: 'Welcome to Dead Set — you found your people',
  displayName: 'Welcome email',
  previewData: { displayName: 'Jerry' },
} satisfies TemplateEntry

// ── STYLES (Gmail-safe: no gradients, no <style> tags, web-safe fonts) ──

const gold = { color: '#c9a84c', fontWeight: '500' as const }
const main = { backgroundColor: '#0a0a0a', fontFamily: FF_SANS, color: '#c8c4b0' }
const wrapper = { maxWidth: '620px', margin: '0 auto', backgroundColor: '#0d0d0d', padding: '0' }

const ruleGold = { borderColor: '#c9a84c', borderTop: '1px solid #c9a84c', margin: '0 0 24px' }
const ruleMuted = { borderColor: '#2a2410', borderTop: '1px solid #2a2410', margin: '0' }

const header = { backgroundColor: '#0a0a0a', borderBottom: '1px solid #2a2410', padding: '32px 40px 28px', textAlign: 'center' as const }
const siteName = { fontFamily: FF_SERIF, fontSize: '26px', fontWeight: '700' as const, color: '#c9a84c', letterSpacing: '3px', margin: '0 0 10px' }
const headerTagline = { fontFamily: FF_MONO, fontSize: '12px', letterSpacing: '2px', color: '#b09e78', margin: '0' }

const hero = { backgroundColor: '#0a0a0a', padding: '48px 40px 40px', textAlign: 'center' as const, borderBottom: '1px solid #1a1a12' }
const heroEyebrow = { fontFamily: FF_MONO, fontSize: '12px', letterSpacing: '3px', color: '#b09e78', margin: '0 0 20px' }
const heroHeadline = { fontFamily: FF_SERIF, fontSize: '32px', fontWeight: '400' as const, fontStyle: 'italic' as const, color: '#c9a84c', lineHeight: '1.3', margin: '0 0 16px' }
const heroTagline = { fontFamily: FF_MONO, fontSize: '13px', letterSpacing: '4px', color: '#b09e78', margin: '16px 0 20px' }
const heroSub = { fontFamily: FF_SANS, fontSize: '15px', fontWeight: '300' as const, color: '#a09880', letterSpacing: '1px', margin: '0' }

const dividerSection = { padding: '0 40px', margin: '0', textAlign: 'center' as const }

const bodySection = { padding: '40px 40px', backgroundColor: '#0d0d0d' }
const salutation = { fontFamily: FF_CURSIVE, fontSize: '22px', color: '#c9a84c', margin: '0 0 24px' }
const bodyP = { fontFamily: FF_SANS, fontSize: '15px', fontWeight: '300' as const, lineHeight: '1.8', color: '#b0ac9a', margin: '0 0 18px' }

const pullQuote = { borderLeft: '2px solid #c9a84c', margin: '28px 0', padding: '4px 0 4px 20px' }
const pullQuoteText = { fontFamily: FF_SERIF, fontSize: '17px', fontStyle: 'italic' as const, color: '#c9a84c', lineHeight: '1.5', margin: '0' }

const showCallout = { backgroundColor: '#0f0e08', border: '1px solid #2a2410', borderLeft: '3px solid #c9a84c', padding: '14px 18px', margin: '4px 0 24px' }
const showCalloutLabel = { fontFamily: FF_MONO, fontSize: '12px', letterSpacing: '2px', color: '#a09880', margin: '0 0 7px' }
const showCalloutText = { fontFamily: FF_MONO, fontSize: '14px', color: '#c9a84c', letterSpacing: '1px', margin: '0' }

const storyBreak = { backgroundColor: '#0f0e08', borderTop: '1px solid #1e1c10', borderBottom: '1px solid #1e1c10', padding: '28px 40px', margin: '8px 0' }
const storyBreakLabel = { fontFamily: FF_MONO, fontSize: '12px', letterSpacing: '3px', color: '#a09880', margin: '0 0 14px' }
const storyBreakText = { fontFamily: FF_CURSIVE, fontSize: '19px', color: '#c8c4b0', lineHeight: '1.6', margin: '0' }

const ctaSection = { padding: '36px 40px 40px', textAlign: 'center' as const, backgroundColor: '#0d0d0d' }
const ctaLabel = { fontFamily: FF_MONO, fontSize: '12px', letterSpacing: '3px', color: '#a09880', margin: '0 0 20px' }
const ctaButton = { display: 'inline-block', fontFamily: FF_SANS, fontSize: '13px', fontWeight: '700' as const, letterSpacing: '2px', color: '#0a0a0a', backgroundColor: '#c9a84c', padding: '14px 36px', textDecoration: 'none' }
const ctaSub = { fontFamily: FF_SANS, fontSize: '14px', color: '#a09880', margin: '16px 0 0' }

const signoff = { padding: '8px 40px 36px', backgroundColor: '#0d0d0d' }
const signoffText = { fontFamily: FF_SANS, fontSize: '15px', fontWeight: '300' as const, lineHeight: '1.8', color: '#b0ac9a', margin: '0 0 24px' }
const signoffClosing = { fontFamily: FF_CURSIVE, fontSize: '16px', color: '#a09880', margin: '0 0 4px' }
const signoffName = { fontFamily: FF_CURSIVE, fontSize: '26px', color: '#c9a84c', margin: '0 0 2px' }
const signoffTitle = { fontFamily: FF_MONO, fontSize: '12px', color: '#a09880', letterSpacing: '2px', margin: '0' }

const psSection = { padding: '24px 40px 28px', borderTop: '1px solid #1a1a12', backgroundColor: '#0d0d0d' }
const psText = { fontFamily: FF_SERIF, fontSize: '15px', fontStyle: 'italic' as const, color: '#a09880', lineHeight: '1.7', margin: '0' }

const footer = { backgroundColor: '#080808', borderTop: '1px solid #1a1408', padding: '28px 40px', textAlign: 'center' as const }
const footerLogo = { fontFamily: FF_SERIF, fontSize: '14px', color: '#a09880', letterSpacing: '2px', margin: '0 0 10px' }
const footerCopy = { fontFamily: FF_MONO, fontSize: '12px', color: '#8a8270', letterSpacing: '1px', lineHeight: '1.8', margin: '0' }
const footerLink = { color: '#a09880', textDecoration: 'underline' }
const footerTapeLabel = { fontFamily: FF_MONO, fontSize: '12px', color: '#6b6450', letterSpacing: '2px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #2a2820' }
