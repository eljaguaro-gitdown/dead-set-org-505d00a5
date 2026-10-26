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

// Operator alert, one per NEW playback issue (repeat reports add to the count
// instead), sent by the notify_playback_issue trigger. The fan who hit it was
// told "we're on it"; this is what makes that true without someone watching
// /admin. Capped at ten an hour in the trigger, so a catalog-wide outage is a
// handful of emails and a full queue, not an inbox flood.

const FF_SERIF = "Georgia, 'Times New Roman', serif"
const FF_MONO = "'Courier New', Courier, monospace"

const KIND_LABEL: Record<string, string> = {
  not_on_tape: 'The song is not on the tape we found',
  no_tape: 'No tape of the night turned up',
  wont_play: 'The tape was found but will not spin',
  none_in_setlist: 'Nothing in a setlist would play',
}

interface PlaybackIssueAlertProps {
  kind?: string
  songTitle?: string
  showDate?: string | null
  archiveUrl?: string | null
  buildSha?: string | null
  reportedAt?: string
}

const PlaybackIssueAlertEmail = ({
  kind = 'not_on_tape',
  songTitle = 'Unknown song',
  showDate = null,
  archiveUrl = null,
  buildSha = null,
  reportedAt = new Date().toISOString(),
}: PlaybackIssueAlertProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      {songTitle}
      {showDate ? ` (${showDate})` : ''} would not play for a fan
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={header}>A TAPE WOULDN'T PLAY</Text>
        <Hr style={divider} />

        <Section>
          <Text style={label}>SONG</Text>
          <Text style={value}>
            {songTitle}
            {showDate ? ` · ${showDate}` : ''}
          </Text>

          <Text style={label}>WHAT HAPPENED</Text>
          <Text style={value}>{KIND_LABEL[kind] ?? kind}</Text>

          {archiveUrl && (
            <>
              <Text style={label}>TAPE</Text>
              <Text style={value}>{archiveUrl}</Text>
            </>
          )}

          <Text style={label}>WHEN</Text>
          <Text style={value}>
            {reportedAt}
            {buildSha ? ` · build ${buildSha.slice(0, 7)}` : ''}
          </Text>
        </Section>

        <Section style={{ textAlign: 'center' as const, margin: '20px 0 8px' }}>
          <Button href="https://dead-set.org/admin" style={button}>
            Open the tape queue
          </Button>
        </Section>

        <Hr style={divider} />
        <Text style={footer}>
          The fan was told it has been noted. Mark it fixed when it is; a signed-in fan's play of that night,
          or yours, verifies it and tells everyone waiting.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PlaybackIssueAlertEmail,
  subject: (data: Record<string, any>) =>
    `Tape wouldn't play: ${data?.songTitle || 'a song'}${data?.showDate ? ` (${data.showDate})` : ''}`,
  // No fixed `to`: recipients come from the notify_playback_issue trigger.
  displayName: 'Playback issue alert',
  previewData: {
    kind: 'not_on_tape',
    songTitle: 'Althea',
    showDate: '1991-09-10',
    archiveUrl: 'https://archive.org/details/gd1991-09-10.sbd.miller.88806.flac16',
    buildSha: '4172085362a741715a28b7ea63df1323211cb205',
    reportedAt: '2026-10-25T02:00:00Z',
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
const value = { fontSize: '15px', color: '#1a1a2e', margin: '0 0 4px', lineHeight: '1.4' }
const button = {
  backgroundColor: '#1a1a2e',
  color: '#ffffff',
  fontFamily: FF_MONO,
  fontSize: '13px',
  padding: '10px 18px',
  borderRadius: '4px',
  textDecoration: 'none',
}
const footer = { fontFamily: FF_MONO, fontSize: '12px', color: '#666666', textAlign: 'center' as const, margin: '8px 0 0' }
