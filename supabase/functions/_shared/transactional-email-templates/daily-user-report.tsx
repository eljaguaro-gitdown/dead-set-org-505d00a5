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
  Row,
  Column,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_URL = 'https://dead-set.org'

interface DailyUserReportProps {
  totalUsers: number
  newUsersToday: number
  newUserNames: string[]
  totalSetlists: number
  newSetlistsToday: number
  unique24h: number
  unique7d: number
  totalPageViews: number
  reportDate: string
}

const DailyUserReport = ({
  totalUsers = 0,
  newUsersToday = 0,
  newUserNames = [],
  totalSetlists = 0,
  newSetlistsToday = 0,
  unique24h = 0,
  unique7d = 0,
  totalPageViews = 0,
  reportDate = new Date().toLocaleDateString(),
}: DailyUserReportProps) => (
  <Html>
    <Head />
    <Preview>Dead Set Daily Report — {reportDate}</Preview>
    <Body style={{ backgroundColor: '#1a1a2e', fontFamily: 'Georgia, serif', margin: '0', padding: '20px 0' }}>
      <Container style={{ maxWidth: '560px', margin: '0 auto', backgroundColor: '#16213e', borderRadius: '8px', padding: '32px' }}>

        <Text style={{ color: '#e94560', fontSize: '22px', fontWeight: 'bold', textAlign: 'center' as const, margin: '0 0 4px' }}>
          ☠️ Dead Set Daily Report
        </Text>
        <Text style={{ color: '#8892b0', fontSize: '14px', textAlign: 'center' as const, margin: '0 0 24px' }}>
          {reportDate}
        </Text>

        <Hr style={{ borderColor: '#2a2a4a', margin: '0 0 20px' }} />

        {/* Users */}
        <Text style={{ color: '#e94560', fontSize: '16px', fontWeight: 'bold', margin: '0 0 8px' }}>
          Users
        </Text>
        <table style={{ width: '100%', borderCollapse: 'collapse' as const, marginBottom: '16px' }}>
          <tr>
            <td style={{ color: '#ccd6f6', fontSize: '14px', padding: '6px 0' }}>Total Users</td>
            <td style={{ color: '#ccd6f6', fontSize: '14px', padding: '6px 0', textAlign: 'right' as const, fontFamily: 'Courier New, monospace' }}>{totalUsers}</td>
          </tr>
          <tr>
            <td style={{ color: '#ccd6f6', fontSize: '14px', padding: '6px 0' }}>New Today</td>
            <td style={{ color: newUsersToday > 0 ? '#64ffda' : '#ccd6f6', fontSize: '14px', padding: '6px 0', textAlign: 'right' as const, fontFamily: 'Courier New, monospace', fontWeight: newUsersToday > 0 ? 'bold' : 'normal' }}>
              {newUsersToday > 0 ? `+${newUsersToday}` : '0'}
            </td>
          </tr>
        </table>

        {newUserNames.length > 0 && (
          <Section style={{ backgroundColor: '#1a1a2e', borderRadius: '6px', padding: '12px 16px', marginBottom: '16px' }}>
            <Text style={{ color: '#8892b0', fontSize: '12px', margin: '0 0 6px', textTransform: 'uppercase' as const }}>
              New Members
            </Text>
            {newUserNames.map((name, i) => (
              <Text key={i} style={{ color: '#ccd6f6', fontSize: '14px', margin: '2px 0' }}>
                ⚡ {name}
              </Text>
            ))}
          </Section>
        )}

        <Hr style={{ borderColor: '#2a2a4a', margin: '0 0 20px' }} />

        {/* Setlists */}
        <Text style={{ color: '#e94560', fontSize: '16px', fontWeight: 'bold', margin: '0 0 8px' }}>
          Setlists
        </Text>
        <table style={{ width: '100%', borderCollapse: 'collapse' as const, marginBottom: '16px' }}>
          <tr>
            <td style={{ color: '#ccd6f6', fontSize: '14px', padding: '6px 0' }}>Total Setlists</td>
            <td style={{ color: '#ccd6f6', fontSize: '14px', padding: '6px 0', textAlign: 'right' as const, fontFamily: 'Courier New, monospace' }}>{totalSetlists}</td>
          </tr>
          <tr>
            <td style={{ color: '#ccd6f6', fontSize: '14px', padding: '6px 0' }}>Created Today</td>
            <td style={{ color: newSetlistsToday > 0 ? '#64ffda' : '#ccd6f6', fontSize: '14px', padding: '6px 0', textAlign: 'right' as const, fontFamily: 'Courier New, monospace', fontWeight: newSetlistsToday > 0 ? 'bold' : 'normal' }}>
              {newSetlistsToday > 0 ? `+${newSetlistsToday}` : '0'}
            </td>
          </tr>
        </table>

        <Hr style={{ borderColor: '#2a2a4a', margin: '0 0 20px' }} />

        {/* Traffic */}
        <Text style={{ color: '#e94560', fontSize: '16px', fontWeight: 'bold', margin: '0 0 8px' }}>
          Traffic
        </Text>
        <table style={{ width: '100%', borderCollapse: 'collapse' as const, marginBottom: '16px' }}>
          <tr>
            <td style={{ color: '#ccd6f6', fontSize: '14px', padding: '6px 0' }}>Unique Visitors (24h)</td>
            <td style={{ color: '#ccd6f6', fontSize: '14px', padding: '6px 0', textAlign: 'right' as const, fontFamily: 'Courier New, monospace' }}>{unique24h}</td>
          </tr>
          <tr>
            <td style={{ color: '#ccd6f6', fontSize: '14px', padding: '6px 0' }}>Unique Visitors (7d)</td>
            <td style={{ color: '#ccd6f6', fontSize: '14px', padding: '6px 0', textAlign: 'right' as const, fontFamily: 'Courier New, monospace' }}>{unique7d}</td>
          </tr>
          <tr>
            <td style={{ color: '#ccd6f6', fontSize: '14px', padding: '6px 0' }}>Total Page Views</td>
            <td style={{ color: '#ccd6f6', fontSize: '14px', padding: '6px 0', textAlign: 'right' as const, fontFamily: 'Courier New, monospace' }}>{totalPageViews}</td>
          </tr>
        </table>

        <Hr style={{ borderColor: '#2a2a4a', margin: '20px 0' }} />

        <Text style={{ color: '#8892b0', fontSize: '12px', textAlign: 'center' as const, margin: '0' }}>
          Auto-generated from Dead Set · {SITE_URL}
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template: TemplateEntry = {
  component: DailyUserReport,
  subject: (data) => `☠️ Dead Set Daily — ${data.reportDate || 'Report'}`,
  to: 'grateful_jaguaro@dead-set.org',
  displayName: 'Daily User Report',
  previewData: {
    totalUsers: 42,
    newUsersToday: 3,
    newUserNames: ['Jerry G.', 'Bobby W.', 'Phil L.'],
    totalSetlists: 128,
    newSetlistsToday: 5,
    unique24h: 67,
    unique7d: 312,
    totalPageViews: 4200,
    reportDate: '2026-04-13',
  },
}
