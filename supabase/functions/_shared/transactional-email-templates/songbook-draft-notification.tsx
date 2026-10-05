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

// Operator alert, one per new Songbook entry, sent by the
// draft_songbook_announcement trigger on songbook_entries.
//
// Nothing here is subscriber mail and nothing here sends itself to the
// community. The trigger writes an announcement with published = false — a
// DRAFT, visible only to admins — and this is the nudge that one is waiting.
// A human reads it, edits the words, and publishes. That is deliberate: an
// announcement that goes to everyone the moment a row appears is the one
// mechanism in this app that could speak to the whole community without
// anybody having read it first.

const FF_SERIF = "Georgia, 'Times New Roman', serif"
const FF_MONO = "'Courier New', Courier, monospace"

interface SongbookDraftProps {
  songTitle?: string
  contributorName?: string
  slotCount?: number
  draftTitle?: string
  draftBody?: string
  guideUrl?: string
}

const SongbookDraftEmail = ({
  songTitle = 'a song',
  contributorName = 'a Deadhead',
  slotCount = 0,
  draftTitle = '',
  draftBody = '',
  guideUrl = 'https://dead-set.org/songbook',
}: SongbookDraftProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      {contributorName} put {songTitle} in the Songbook. A draft announcement is
      waiting for you.
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={header}>SONGBOOK DRAFT WAITING</Text>
        <Hr style={divider} />

        <Section>
          <Text style={label}>SONG</Text>
          <Text style={value}>{songTitle}</Text>

          <Text style={label}>FIRST MAPPED BY</Text>
          <Text style={value}>{contributorName}</Text>

          {slotCount > 0 && (
            <>
              <Text style={label}>NIGHTS IN THE GUIDE</Text>
              <Text style={value}>{slotCount}</Text>
            </>
          )}
        </Section>

        <Hr style={divider} />
        <Text style={label}>DRAFTED ANNOUNCEMENT</Text>
        <Text style={draftHeading}>{draftTitle}</Text>
        <Text style={quote}>{draftBody}</Text>

        <Section style={{ textAlign: 'center' as const, margin: '20px 0 8px' }}>
          <Button href="https://dead-set.org/admin" style={button}>
            Review and publish
          </Button>
        </Section>

        <Hr style={divider} />
        <Text style={footer}>
          Nothing has been sent. The draft is unpublished and only admins can
          see it. Edit the words first — they were generated from the entry, not
          written by anyone.
        </Text>
        <Text style={footer}>{guideUrl}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SongbookDraftEmail,
  subject: (data: Record<string, any>) =>
    `Songbook draft waiting: ${data.songTitle || 'a new entry'}`,
  // No fixed `to`: recipients come from the trigger, which reads the admins.
  displayName: 'Songbook draft awaiting approval',
  previewData: {
    songTitle: 'Eyes of the World',
    contributorName: 'ric neil',
    slotCount: 7,
    draftTitle: 'Somebody mapped Eyes of the World',
    draftBody:
      "Hey Now — nobody had written anything down for Eyes of the World. Now somebody has.",
    guideUrl: 'https://dead-set.org/setlist/00000000-0000-0000-0000-000000000000',
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
const draftHeading = {
  ...value,
  fontSize: '17px',
  fontWeight: 'bold' as const,
  margin: '4px 0 6px',
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
