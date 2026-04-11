/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
  Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const FF_SERIF = "Georgia, 'Times New Roman', serif"
const FF_MONO = "'Courier New', Courier, monospace"

interface NewSignupNotificationProps {
  userEmail?: string
  displayName?: string
  provider?: string
  signupTime?: string
}

const NewSignupNotificationEmail = ({
  userEmail = 'unknown@example.com',
  displayName = 'Unknown',
  provider = 'email',
  signupTime = new Date().toISOString(),
}: NewSignupNotificationProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New Deadhead just joined: {displayName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={header}>⚡ NEW DEADHEAD ALERT ⚡</Text>
        <Hr style={divider} />

        <Section style={detailSection}>
          <Text style={label}>WHO</Text>
          <Text style={value}>{displayName}</Text>

          <Text style={label}>EMAIL</Text>
          <Text style={value}>{userEmail}</Text>

          <Text style={label}>SIGNED IN VIA</Text>
          <Text style={value}>{provider.toUpperCase()}</Text>

          <Text style={label}>WHEN</Text>
          <Text style={value}>
            {new Date(signupTime).toLocaleString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              timeZoneName: 'short',
            })}
          </Text>
        </Section>

        <Hr style={divider} />
        <Text style={footer}>
          Another one on the bus. 🌹💀
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: NewSignupNotificationEmail,
  subject: (data: Record<string, any>) =>
    `🌹 New signup: ${data.displayName || 'A new Deadhead'}`,
  to: 'grateful_jaguaro@dead-set.org',
  displayName: 'New signup notification',
  previewData: {
    userEmail: 'jerry@example.com',
    displayName: 'JerryFan77',
    provider: 'google',
    signupTime: '2026-04-11T12:00:00Z',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: FF_SERIF }
const container = { padding: '24px 28px', maxWidth: '480px' }
const header = {
  fontFamily: FF_MONO,
  fontSize: '14px',
  fontWeight: 'bold' as const,
  color: '#1a1a2e',
  letterSpacing: '2px',
  textAlign: 'center' as const,
  margin: '0 0 8px',
}
const divider = { borderColor: '#e5e5e5', margin: '16px 0' }
const detailSection = { padding: '0' }
const label = {
  fontFamily: FF_MONO,
  fontSize: '10px',
  color: '#999999',
  letterSpacing: '1.5px',
  margin: '12px 0 2px',
  textTransform: 'uppercase' as const,
}
const value = {
  fontSize: '15px',
  color: '#1a1a2e',
  margin: '0 0 4px',
  lineHeight: '1.4',
}
const footer = {
  fontFamily: FF_MONO,
  fontSize: '12px',
  color: '#666666',
  textAlign: 'center' as const,
  margin: '8px 0 0',
}
