/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
  Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Dead-Set.Org'
const SITE_URL = 'https://dead-set-org.lovable.app'

interface WelcomeEmailProps {
  displayName?: string
}

const WelcomeEmail = ({ displayName }: WelcomeEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to Dead-Set.Org — your setlists await</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>☠ DEAD-SET.ORG</Text>
        <Hr style={divider} />
        <Heading style={h1}>
          {displayName ? `Welcome aboard, ${displayName}!` : 'Welcome aboard!'}
        </Heading>
        <Text style={text}>
          You're officially part of the{' '}
          <Link href={SITE_URL} style={link}>
            <strong>Dead-Set.Org</strong>
          </Link>{' '}
          family. Time to build your dream Grateful Dead setlists.
        </Text>
        <Text style={text}>
          Whether you've got a show burned into memory or want to craft the
          perfect two-set night from scratch — Cosmic Charlie is here to help.
        </Text>
        <Button style={button} href={`${SITE_URL}/builder`}>
          Build Your First Setlist
        </Button>
        <Text style={text}>
          Browse what the community is building, save your favorites, and share
          your creations with fellow heads.
        </Text>
        <Text style={footer}>
          If you have any questions, just reply to this email. We're all friends here.
        </Text>
        <Text style={tagline}>The music never stopped. ⚡</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomeEmail,
  subject: 'Welcome to Dead-Set.Org — the music never stopped ⚡',
  displayName: 'Welcome email',
  previewData: { displayName: 'Jerry' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '480px', margin: '0 auto' }
const brand = { fontSize: '13px', fontWeight: 'bold' as const, letterSpacing: '3px', color: '#b8860b', margin: '0 0 16px', textAlign: 'center' as const }
const divider = { borderColor: '#e8e0d0', margin: '0 0 28px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, fontFamily: "'Playfair Display', Georgia, serif", color: '#0d0d14', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#3d3a36', lineHeight: '1.6', margin: '0 0 20px' }
const link = { color: '#b8860b', textDecoration: 'underline' }
const button = { backgroundColor: '#b8860b', color: '#ffffff', fontSize: '15px', fontWeight: '600' as const, borderRadius: '10px', padding: '14px 28px', textDecoration: 'none' }
const footer = { fontSize: '13px', color: '#8a8578', margin: '32px 0 8px', lineHeight: '1.5' }
const tagline = { fontSize: '12px', color: '#b8860b', fontStyle: 'italic' as const, margin: '8px 0 0' }
