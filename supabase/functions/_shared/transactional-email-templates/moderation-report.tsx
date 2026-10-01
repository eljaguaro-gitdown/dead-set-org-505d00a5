/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
  Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

// Operator alert, one per report, sent by the notify_moderation_report
// trigger on content_reports. App Store guideline 1.2 requires acting on a
// report within 24 hours; this is what makes that possible without someone
// watching /admin.

const FF_SERIF = "Georgia, 'Times New Roman', serif"
const FF_MONO = "'Courier New', Courier, monospace"

interface ModerationReportProps {
  contentType?: string
  reason?: string | null
  excerpt?: string | null
  reportedAt?: string
}

const deadline = (reportedAt: string) =>
  new Date(new Date(reportedAt).getTime() + 24 * 60 * 60 * 1000).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })

const ModerationReportEmail = ({
  contentType = 'setlist',
  reason = null,
  excerpt = null,
  reportedAt = new Date().toISOString(),
}: ModerationReportProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Report filed on a {contentType}. Act by {deadline(reportedAt)}.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={header}>REPORT FILED</Text>
        <Hr style={divider} />

        <Section>
          <Text style={label}>WHAT</Text>
          <Text style={value}>{contentType.toUpperCase()}</Text>

          {excerpt && (
            <>
              <Text style={label}>CONTENT</Text>
              <Text style={quote}>{excerpt}</Text>
            </>
          )}

          <Text style={label}>REPORTER SAID</Text>
          <Text style={value}>{reason || '(no reason given)'}</Text>

          <Text style={label}>ACT BY</Text>
          <Text style={value}>{deadline(reportedAt)}</Text>
        </Section>

        <Section style={{ textAlign: 'center' as const, margin: '20px 0 8px' }}>
          <Button href="https://dead-set.org/admin" style={button}>
            Open the moderation queue
          </Button>
        </Section>

        <Hr style={divider} />
        <Text style={footer}>
          Remove the content and ban the account from the queue, or dismiss it.
          Apple's rule is 24 hours from the report.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ModerationReportEmail,
  subject: (data: Record<string, any>) =>
    `Report filed: ${data.contentType || 'content'}, act within 24 hours`,
  // No fixed `to`: recipients come from the notify_moderation_report trigger.
  displayName: 'Moderation report alert',
  previewData: {
    contentType: 'comment',
    reason: 'Harassing another member',
    excerpt: 'An example of a reported comment.',
    reportedAt: '2026-09-30T12:00:00Z',
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
const quote = {
  ...value,
  borderLeft: '3px solid #e5e5e5',
  paddingLeft: '10px',
  fontStyle: 'italic' as const,
}
const button = {
  backgroundColor: '#1a1a2e',
  color: '#ffffff',
  fontFamily: FF_MONO,
  fontSize: '13px',
  padding: '10px 18px',
  borderRadius: '4px',
  textDecoration: 'none',
}
const footer = {
  fontFamily: FF_MONO,
  fontSize: '12px',
  color: '#666666',
  textAlign: 'center' as const,
  margin: '8px 0 0',
}
