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

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to Dead-Set.Org — confirm your email</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>☠ DEAD-SET.ORG</Text>
        <Hr style={divider} />
        <Heading style={h1}>Come on in — there's room.</Heading>
        <Text style={text}>
          Thanks for joining{' '}
          <Link href={siteUrl} style={link}>
            <strong>Dead-Set.Org</strong>
          </Link>
          . We just need to make sure you're you.
        </Text>
        <Text style={text}>
          Confirm your email (
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
          ) and start building your dream setlists.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Verify &amp; Get Started
        </Button>
        <Text style={footer}>
          If you didn't sign up for Dead-Set.Org, just ignore this — no harm done.
        </Text>
        <Text style={tagline}>The music never stopped. ⚡</Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

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
