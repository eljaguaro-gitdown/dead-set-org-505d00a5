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

export const TEMPLATES: Record<string, TemplateEntry> = {
  'welcome-email': welcomeEmail,
  'build-notes': buildNotes,
  'new-signup-notification': newSignupNotification,
  'lot-dispatch': lotDispatch,
}
