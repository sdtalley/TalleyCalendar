export type CalendarProvider = 'google' | 'apple' | 'outlook' | 'local'
export type CalendarType = 'personal' | 'work' | 'kids' | 'shared'

// ── Family Member ──────────────────────────────────────────────────────────
export interface FamilyMember {
  id: string
  name: string
  color: string
}

// ── Connected Account (stored in Redis per-account) ────────────────────────

export interface OAuthCredentials {
  type: 'oauth'
  accessToken: string
  refreshToken: string
  expiresAt: number // unix timestamp ms
}

export interface CalDAVCredentials {
  type: 'caldav'
  username: string
  appPassword: string
}

export interface EnabledCalendar {
  calendarId: string
  name: string
  enabled: boolean
}

export type AccountStatus = 'connected' | 'error' | 'reauth_needed'

export interface ConnectedAccount {
  id: string
  provider: CalendarProvider
  familyMemberId: string
  label: string
  email: string
  calendarType: CalendarType
  auth: OAuthCredentials | CalDAVCredentials
  enabledCalendars: EnabledCalendar[]
  status: AccountStatus
  connectedAt: string   // ISO date
  lastSyncAt?: string   // ISO date
}

// ── Calendar Event (normalized from any provider) ──────────────────────────

export interface CalendarEvent {
  id: string
  externalId?: string
  provider: CalendarProvider
  accountId: string
  title: string
  description?: string
  location?: string
  start: Date
  end: Date
  allDay: boolean
  recurring: boolean
  recurrenceRule?: string
  familyMemberId: string
  calendarType: CalendarType
  color: string
  source: {
    calendarId: string
    calendarName: string
    provider: CalendarProvider
  }
}

// ── App Settings (stored in Redis) ─────────────────────────────────────────

export interface AppSettings {
  refreshInterval: number       // ms, default 300000 (5 min)
  defaultView: CalendarView
  dimSchedule: {
    start: string               // HH:MM
    end: string                 // HH:MM
  }
}

// ── UI types ───────────────────────────────────────────────────────────────

// Extended FamilyMember with client-side UI state (not stored in Redis)
export interface FamilyMemberUI extends FamilyMember {
  enabled: boolean
}

export type CalendarView = 'month' | 'week' | 'day'

export interface NewEventDraft {
  title: string
  date: string        // YYYY-MM-DD
  startTime: string   // HH:MM
  endTime: string     // HH:MM
  familyMemberId: string
  calendarType: CalendarType
}
