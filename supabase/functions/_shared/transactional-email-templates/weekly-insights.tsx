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

const SITE_URL = 'https://dead-set.org'

interface WeeklyInsightsProps {
  weekLabel: string
  // Stats
  totalUsers: number
  newUsersThisWeek: number
  totalSetlists: number
  newSetlistsThisWeek: number
  // Traffic comes from PostHog (production host, internal accounts and bots
  // excluded). null = PostHog was unreachable this week; shown as "—".
  unique7d: number | null
  unique30d: number | null
  pageViews7d: number | null
  topPages: { path: string; count: number }[]
  // Comparison
  prevWeekUsers: number
  prevWeekSetlists: number
  prevWeekVisitors: number | null
  // AI insights
  aiAnalysis: string
  aiRecommendations: string[]
}

const show = (n: number | null) => (n === null ? '—' : n)

const delta = (curr: number | null, prev: number | null) => {
  if (curr === null || prev === null) return '—'
  if (prev === 0) return curr > 0 ? '+∞' : '—'
  const pct = Math.round(((curr - prev) / prev) * 100)
  return pct >= 0 ? `+${pct}%` : `${pct}%`
}

const WeeklyInsights = ({
  weekLabel = 'Week of April 7',
  totalUsers = 0,
  newUsersThisWeek = 0,
  totalSetlists = 0,
  newSetlistsThisWeek = 0,
  unique7d = null,
  unique30d = null,
  pageViews7d = null,
  topPages = [],
  prevWeekUsers = 0,
  prevWeekSetlists = 0,
  prevWeekVisitors = null,
  aiAnalysis = '',
  aiRecommendations = [],
}: WeeklyInsightsProps) => (
  <Html>
    <Head />
    <Preview>Dead Set Weekly Insights — {weekLabel}</Preview>
    <Body style={{ backgroundColor: '#1a1a2e', fontFamily: 'Georgia, serif', margin: '0', padding: '20px 0' }}>
      <Container style={{ maxWidth: '580px', margin: '0 auto', backgroundColor: '#16213e', borderRadius: '8px', padding: '32px' }}>

        <Text style={{ color: '#e94560', fontSize: '24px', fontWeight: 'bold', textAlign: 'center' as const, margin: '0 0 4px' }}>
          ☠️ Dead Set Weekly Insights
        </Text>
        <Text style={{ color: '#8892b0', fontSize: '14px', textAlign: 'center' as const, margin: '0 0 24px' }}>
          {weekLabel}
        </Text>

        <Hr style={{ borderColor: '#2a2a4a', margin: '0 0 20px' }} />

        {/* Key Metrics */}
        <Text style={{ color: '#e94560', fontSize: '16px', fontWeight: 'bold', margin: '0 0 12px' }}>
          Key Metrics
        </Text>
        <table style={{ width: '100%', borderCollapse: 'collapse' as const, marginBottom: '20px' }}>
          <tr style={{ borderBottom: '1px solid #2a2a4a' }}>
            <td style={{ color: '#8892b0', fontSize: '12px', padding: '8px 0', textTransform: 'uppercase' as const }}>Metric</td>
            <td style={{ color: '#8892b0', fontSize: '12px', padding: '8px 0', textAlign: 'right' as const, textTransform: 'uppercase' as const }}>This Week</td>
            <td style={{ color: '#8892b0', fontSize: '12px', padding: '8px 0', textAlign: 'right' as const, textTransform: 'uppercase' as const }}>vs Last</td>
          </tr>
          <tr>
            <td style={{ color: '#ccd6f6', fontSize: '14px', padding: '8px 0' }}>New Users</td>
            <td style={{ color: '#ccd6f6', fontSize: '14px', padding: '8px 0', textAlign: 'right' as const, fontFamily: 'Courier New, monospace' }}>{newUsersThisWeek}</td>
            <td style={{ color: newUsersThisWeek >= prevWeekUsers ? '#64ffda' : '#e94560', fontSize: '14px', padding: '8px 0', textAlign: 'right' as const, fontFamily: 'Courier New, monospace' }}>
              {delta(newUsersThisWeek, prevWeekUsers)}
            </td>
          </tr>
          <tr>
            <td style={{ color: '#ccd6f6', fontSize: '14px', padding: '8px 0' }}>New Setlists</td>
            <td style={{ color: '#ccd6f6', fontSize: '14px', padding: '8px 0', textAlign: 'right' as const, fontFamily: 'Courier New, monospace' }}>{newSetlistsThisWeek}</td>
            <td style={{ color: newSetlistsThisWeek >= prevWeekSetlists ? '#64ffda' : '#e94560', fontSize: '14px', padding: '8px 0', textAlign: 'right' as const, fontFamily: 'Courier New, monospace' }}>
              {delta(newSetlistsThisWeek, prevWeekSetlists)}
            </td>
          </tr>
          <tr>
            <td style={{ color: '#ccd6f6', fontSize: '14px', padding: '8px 0' }}>Unique Visitors (7d)</td>
            <td style={{ color: '#ccd6f6', fontSize: '14px', padding: '8px 0', textAlign: 'right' as const, fontFamily: 'Courier New, monospace' }}>{show(unique7d)}</td>
            <td style={{ color: (unique7d ?? 0) >= (prevWeekVisitors ?? 0) ? '#64ffda' : '#e94560', fontSize: '14px', padding: '8px 0', textAlign: 'right' as const, fontFamily: 'Courier New, monospace' }}>
              {delta(unique7d, prevWeekVisitors)}
            </td>
          </tr>
        </table>

        {/* Totals */}
        <Section style={{ backgroundColor: '#1a1a2e', borderRadius: '6px', padding: '12px 16px', marginBottom: '20px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
            <tr>
              <td style={{ color: '#8892b0', fontSize: '13px', padding: '4px 0' }}>Total Users</td>
              <td style={{ color: '#ccd6f6', fontSize: '13px', padding: '4px 0', textAlign: 'right' as const, fontFamily: 'Courier New, monospace' }}>{totalUsers}</td>
            </tr>
            <tr>
              <td style={{ color: '#8892b0', fontSize: '13px', padding: '4px 0' }}>Total Setlists</td>
              <td style={{ color: '#ccd6f6', fontSize: '13px', padding: '4px 0', textAlign: 'right' as const, fontFamily: 'Courier New, monospace' }}>{totalSetlists}</td>
            </tr>
            <tr>
              <td style={{ color: '#8892b0', fontSize: '13px', padding: '4px 0' }}>30d Unique Visitors</td>
              <td style={{ color: '#ccd6f6', fontSize: '13px', padding: '4px 0', textAlign: 'right' as const, fontFamily: 'Courier New, monospace' }}>{show(unique30d)}</td>
            </tr>
            <tr>
              <td style={{ color: '#8892b0', fontSize: '13px', padding: '4px 0' }}>Page Views (7d)</td>
              <td style={{ color: '#ccd6f6', fontSize: '13px', padding: '4px 0', textAlign: 'right' as const, fontFamily: 'Courier New, monospace' }}>{show(pageViews7d)}</td>
            </tr>
          </table>
          <Text style={{ color: '#8892b0', fontSize: '11px', margin: '8px 0 0' }}>
            {unique7d === null
              ? 'Traffic unavailable this week — the PostHog query failed.'
              : 'Traffic via PostHog: dead-set.org only, internal accounts, Lovable previews and bots excluded.'}
          </Text>
        </Section>

        {/* Top Pages */}
        {topPages.length > 0 && (
          <>
            <Text style={{ color: '#e94560', fontSize: '16px', fontWeight: 'bold', margin: '0 0 8px' }}>
              Top Pages (7d)
            </Text>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const, marginBottom: '20px' }}>
              {topPages.slice(0, 5).map((p, i) => (
                <tr key={i}>
                  <td style={{ color: '#ccd6f6', fontSize: '13px', padding: '4px 0', fontFamily: 'Courier New, monospace' }}>{p.path}</td>
                  <td style={{ color: '#8892b0', fontSize: '13px', padding: '4px 0', textAlign: 'right' as const, fontFamily: 'Courier New, monospace' }}>{p.count}</td>
                </tr>
              ))}
            </table>
          </>
        )}

        <Hr style={{ borderColor: '#2a2a4a', margin: '0 0 20px' }} />

        {/* AI Analysis */}
        <Text style={{ color: '#e94560', fontSize: '16px', fontWeight: 'bold', margin: '0 0 8px' }}>
          🔮 Analysis
        </Text>
        <Text style={{ color: '#ccd6f6', fontSize: '14px', lineHeight: '1.6', margin: '0 0 20px' }}>
          {aiAnalysis}
        </Text>

        {/* Recommendations */}
        {aiRecommendations.length > 0 && (
          <>
            <Text style={{ color: '#e94560', fontSize: '16px', fontWeight: 'bold', margin: '0 0 12px' }}>
              💡 Recommendations
            </Text>
            {aiRecommendations.map((rec, i) => (
              <Section key={i} style={{ backgroundColor: '#1a1a2e', borderRadius: '6px', padding: '10px 14px', marginBottom: '8px', borderLeft: '3px solid #e94560' }}>
                <Text style={{ color: '#ccd6f6', fontSize: '14px', lineHeight: '1.5', margin: '0' }}>
                  {rec}
                </Text>
              </Section>
            ))}
          </>
        )}

        <Hr style={{ borderColor: '#2a2a4a', margin: '20px 0' }} />

        <Text style={{ color: '#8892b0', fontSize: '12px', textAlign: 'center' as const, margin: '0' }}>
          Auto-generated from Dead Set · {SITE_URL}
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template: TemplateEntry = {
  component: WeeklyInsights,
  subject: (data) => `☠️ Dead Set Weekly Insights — ${data.weekLabel || 'Report'}`,
  displayName: 'Weekly Insights Report',
  previewData: {
    weekLabel: 'Week of April 7, 2026',
    totalUsers: 52,
    newUsersThisWeek: 8,
    totalSetlists: 156,
    newSetlistsThisWeek: 14,
    unique7d: 312,
    unique30d: 890,
    pageViews7d: 1240,
    topPages: [
      { path: '/', count: 1200 },
      { path: '/browse', count: 430 },
      { path: '/builder', count: 380 },
    ],
    prevWeekUsers: 5,
    prevWeekSetlists: 10,
    prevWeekVisitors: 280,
    aiAnalysis: 'User growth accelerated 60% week-over-week, driven primarily by organic search and social sharing. The builder page saw increased engagement with a 15% longer average session time. Browse page traffic correlates strongly with new setlist creation — users who visit Browse are 3x more likely to build their own setlist.',
    aiRecommendations: [
      'Consider adding a "Trending Setlists" section to the landing page — Browse visitors convert at a high rate and surfacing popular content earlier could boost engagement.',
      'The OAuth signup funnel has a 40% higher completion rate than email. Consider making Google sign-in more prominent on the auth page.',
      'Several users created setlists but never shared them. A gentle "Share your setlist" nudge after the first build could increase virality.',
    ],
  },
}
