/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
  Hr,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Dead Set verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>☠ DEAD SET</Text>
        <Hr style={divider} />
        <Heading style={h1}>Verify your identity</Heading>
        <Text style={text}>Use this code to confirm it's you:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          This code expires shortly. Didn't request it? Just ignore this email.
        </Text>
        <Text style={tagline}>The music never stopped. ⚡</Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '480px', margin: '0 auto' }
const brand = { fontSize: '13px', fontWeight: 'bold' as const, letterSpacing: '3px', color: '#b8860b', margin: '0 0 16px', textAlign: 'center' as const }
const divider = { borderColor: '#e8e0d0', margin: '0 0 28px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, fontFamily: "'Playfair Display', Georgia, serif", color: '#0d0d14', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#3d3a36', lineHeight: '1.6', margin: '0 0 20px' }
const codeStyle = { fontFamily: "'JetBrains Mono', Courier, monospace", fontSize: '28px', fontWeight: 'bold' as const, color: '#b8860b', letterSpacing: '4px', margin: '0 0 30px' }
const footer = { fontSize: '13px', color: '#8a8578', margin: '32px 0 8px', lineHeight: '1.5' }
const tagline = { fontSize: '12px', color: '#b8860b', fontStyle: 'italic' as const, margin: '8px 0 0' }
