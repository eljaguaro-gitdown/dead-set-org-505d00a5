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

// Operator alert from the tape desk (supabase/functions/tape-desk), the
// follow-up to "Tape wouldn't play". Two kinds:
//   ready  the exact song from the exact night plays on dead-set.org; the
//          owner's Mark fixed is all that is left, and it is what emails the
//          fans who are waiting. The desk never presses it.
//   held   the desk stopped before changing anything, for a reason only the
//          owner can settle (night data, fan-facing copy, a repeat failure…).
// Internal only: never sent to a fan, and listed in INTERNAL_TEMPLATES.

const FF_SERIF = "Georgia, 'Times New Roman', serif"
const FF_MONO = "'Courier New', Courier, monospace"

const CLASS_LABEL: Record<string, string> = {
  M: 'Matcher miss: the song is on the tape under a title the player did not match',
  S: 'Source choice: the chosen tape lacks it, another tape of the night has it',
  N: 'Night data: the song was not played that night',
  G: 'Gap: played that night, on no tape the Archive has',
  A: 'Archive-side: the item or a mirror was down',
  C: 'Regression: it played on an earlier build',
}

interface TapeDeskAlertProps {
  status?: 'ready' | 'held'
  songTitle?: string
  showDate?: string | null
  cls?: string
  cause?: string
  pick?: string
  reason?: string | null
  firstSoundMs?: number | null
  waiting?: number
  issueUrl?: string
  adminUrl?: string
}

const TapeDeskAlertEmail = ({
  status = 'ready',
  songTitle = 'Unknown song',
  showDate = null,
  cls = 'M',
  cause = '',
  pick = '',
  reason = null,
  firstSoundMs = null,
  waiting = 0,
  issueUrl = 'https://github.com/eljaguaro-gitdown/dead-set-org-505d00a5/issues',
  adminUrl = 'https://dead-set.org/admin',
}: TapeDeskAlertProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      {status === 'ready' ? 'Plays on dead-set.org, waiting on your Mark fixed' : `Held for you: ${reason ?? ''}`}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={header}>{status === 'ready' ? 'READY TO CLOSE' : 'HELD FOR YOU'}</Text>
        <Hr style={divider} />

        <Section>
          <Text style={label}>SONG</Text>
          <Text style={value}>
            {songTitle}
            {showDate ? ` · ${showDate}` : ''}
          </Text>

          <Text style={label}>CAUSE</Text>
          <Text style={value}>{CLASS_LABEL[cls] ?? cls}</Text>
          <Text style={value}>{cause}</Text>

          <Text style={label}>{status === 'ready' ? 'WHAT THE DESK DID' : 'WHAT THE DESK RECOMMENDS'}</Text>
          <Text style={value}>{pick}</Text>

          {status === 'held' && reason && (
            <>
              <Text style={label}>WHY IT STOPPED</Text>
              <Text style={value}>{reason}</Text>
            </>
          )}

          {status === 'ready' && firstSoundMs !== null && (
            <>
              <Text style={label}>ON DEAD-SET.ORG</Text>
              <Text style={value}>First sound in {firstSoundMs} ms</Text>
            </>
          )}

          <Text style={label}>FANS WAITING</Text>
          <Text style={value}>{waiting}</Text>
        </Section>

        <Section style={{ textAlign: 'center' as const, margin: '20px 0 8px' }}>
          <Button href={issueUrl} style={button}>
            Read the ticket
          </Button>
        </Section>
        <Section style={{ textAlign: 'center' as const, margin: '8px 0' }}>
          <Button href={adminUrl} style={buttonQuiet}>
            {status === 'ready' ? 'Mark fixed on the tape queue' : 'Open the tape queue'}
          </Button>
        </Section>

        <Hr style={divider} />
        <Text style={footer}>
          {status === 'ready'
            ? 'Mark fixed is yours to press. It emails everyone waiting, and the desk closes the ticket after.'
            : 'Nothing was changed. Reply on the ticket and the desk picks it up from the step you name.'}
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: TapeDeskAlertEmail,
  subject: (data: Record<string, any>) =>
    `${data?.status === 'held' ? 'Held for you' : 'Ready to close'}: ${data?.songTitle || 'a song'}${data?.showDate ? ` (${data.showDate})` : ''}`,
  // No fixed `to`: the tape-desk function sends it to the owner's inboxes.
  displayName: 'Tape desk alert',
  previewData: {
    status: 'held',
    songTitle: 'Bird Song',
    showDate: '1972-04-08',
    cls: 'N',
    cause: 'Not in JerryBase\'s setlist for Wembley, and none of the four Relisten sources of the night carries it.',
    pick: 'Repoint the Songbook issue\'s 1972 night to one Bird Song was played; until then the index marks it before the tap.',
    reason: 'Night data is yours: it drives first/last-played and the Songbook.',
    firstSoundMs: null,
    waiting: 1,
    issueUrl: 'https://github.com/eljaguaro-gitdown/dead-set-org-505d00a5/issues/153',
    adminUrl: 'https://dead-set.org/admin',
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
const buttonQuiet = { ...button, backgroundColor: '#ffffff', color: '#1a1a2e', border: '1px solid #1a1a2e' }
const footer = { fontFamily: FF_MONO, fontSize: '12px', color: '#666666', textAlign: 'center' as const, margin: '8px 0 0' }
