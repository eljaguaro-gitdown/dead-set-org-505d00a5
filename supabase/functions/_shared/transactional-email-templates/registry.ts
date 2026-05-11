/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as welcomeEmail } from './welcome-email.tsx'
import { template as buildNotes } from './build-notes.tsx'
import { template as newSignupNotification } from './new-signup-notification.tsx'
import { template as lotDispatch } from './lot-dispatch.tsx'
import { template as dmNotification } from './dm-notification.tsx'
import { template as commentNotification } from './comment-notification.tsx'
import { template as dailyUserReport } from './daily-user-report.tsx'
import { template as weeklyInsights } from './weekly-insights.tsx'
import { template as featuredSetlist } from './featured-setlist.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'welcome-email': welcomeEmail,
  'build-notes': buildNotes,
  'new-signup-notification': newSignupNotification,
  'lot-dispatch': lotDispatch,
  'dm-notification': dmNotification,
  'comment-notification': commentNotification,
  'daily-user-report': dailyUserReport,
  'weekly-insights': weeklyInsights,
  'featured-setlist': featuredSetlist,
}
