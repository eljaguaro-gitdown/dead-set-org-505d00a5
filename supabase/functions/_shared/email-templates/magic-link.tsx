/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
  Hr,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Dead-Set.Org login link</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>☠ DEAD-SET.ORG</Text>
        <Hr style={divider} />
        <Heading style={h1}>Your login link</Heading>
        <Text style={text}>
          Click below to log back in to Dead-Set.Org. This link expires shortly, so don't wait too long.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Log In to Dead-Set.Org
        </Button>
        <Text style={footer}>
          Didn't request this? Just ignore it — nothing changes.
        </Text>
        <Text style={tagline}>The music never stopped. ⚡</Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '480px', margin: '0 auto' }
const brand = { fontSize: '13px', fontWeight: 'bold' as const, letterSpacing: '3px', color: '#b8860b', margin: '0 0 16px', textAlign: 'center' as const }
const divider = { borderColor: '#e8e0d0', margin: '0 0 28px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, fontFamily: "'Playfair Display', Georgia, serif", color: '#0d0d14', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#3d3a36', lineHeight: '1.6', margin: '0 0 20px' }
const button = { backgroundColor: '#b8860b', color: '#ffffff', fontSize: '15px', fontWeight: '600' as const, borderRadius: '10px', padding: '14px 28px', textDecoration: 'none' }
const footer = { fontSize: '13px', color: '#8a8578', margin: '32px 0 8px', lineHeight: '1.5' }
const tagline = { fontSize: '12px', color: '#b8860b', fontStyle: 'italic' as const, margin: '8px 0 0' }
