export type CalendarProvider = 'google' | 'apple' | 'outlook' | 'local'
export type CalendarType = 'personal' | 'work' | 'kids' | 'shared'

// ── Family Member ──────────────────────────────────────────────────────────
export interface FamilyMember {
  id: string
  name: string
  color: string
  localOnly?: boolean
  defaultCalendarType?: 'kids' | 'shared'
  avatar?: {
    type: 'emoji' | 'initials'
    value: string   // emoji char, or custom initials (1-2 chars); auto-generated from name if empty
  }
  profileType?: 'person' | 'other'   // defaults to 'person' when absent
  profileCategory?: string           // 'Birthdays' | 'Pets' | 'Sports' | 'School' | etc.
}

// ── Local Event (stored in Redis for localOnly members) ────────────────────
export interface LocalEvent {
  id: string
  memberId: string
  memberIds?: string[]   // multi-profile; if set, overrides memberId for display
  calendarType: 'kids' | 'shared'
  title: string
  description?: string
  location?: string
  start: string   // ISO string
  end: string     // ISO string
  allDay: boolean
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
  defaultWriteCalendarId?: string   // target for new events; falls back to "primary" / first enabled
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
  memberIds?: string[]   // multi-profile assignment; if set, overrides familyMemberId for display
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
  weather: {
    enabled: boolean
    latitude: number
    longitude: number
    label: string               // city name for display
  }
  settingsPin: string           // 4-digit PIN to protect settings, empty = disabled
}

// ── User Accounts (Phase 3A) ──────────────────────────────────────────────

export type UserRole = 'admin' | 'member' | 'guest'

export interface AppUser {
  id: string
  name: string
  email: string           // lowercase; used as login credential
  passwordHash: string    // bcrypt hash (cost 12)
  role: UserRole
  memberId: string | null // links to FamilyMember; null for guests/unlinked
  createdAt: string       // ISO
}

export interface SessionPayload {
  userId: string
  role: UserRole
  memberId: string | null
  iat: number
  exp: number
}

// ── Chores (Phase 3B) ────────────────────────────────────────────────────

export interface ChoreRepeat {
  frequency: 'daily' | 'weekly' | 'monthly'
  interval: number          // every N units; min 1
  daysOfWeek?: number[]     // 0=Sun..6=Sat; only for frequency='weekly'
  endDate?: string          // YYYY-MM-DD; undefined = no end
}

export interface Chore {
  id: string
  title: string
  emoji?: string            // single emoji character
  memberIds: string[]       // assigned family member IDs
  date?: string             // YYYY-MM-DD; undefined = no specific date (always active)
  time?: string             // HH:MM; undefined = no specific time
  repeat?: ChoreRepeat
  exceptions?: string[]     // YYYY-MM-DD dates excluded from a repeating chore
  starValue: number         // 0 = no stars
  createdAt: string         // ISO
  updatedAt: string         // ISO
}

export interface ChoreCompletion {
  status: 'complete' | 'skipped'
  completedAt: string       // ISO
  completedByMemberId?: string
}

// ── Routines (Phase 3B) ───────────────────────────────────────────────────

export type RoutineTimeBlock = 'morning' | 'afternoon' | 'evening'

export interface Routine {
  id: string
  title: string
  emoji?: string
  memberIds: string[]
  timeBlock: RoutineTimeBlock
  repeat: 'daily' | { weekly: number[] }  // days 0=Sun..6=Sat
  starValue: number
  order?: number       // display order within time block
  createdAt: string    // ISO
  updatedAt: string    // ISO
}

export interface RoutineCompletion {
  status: 'complete' | 'skipped'
  completedAt: string
  completedByMemberId?: string
}

// ── Lists (Phase 3B) ─────────────────────────────────────────────────────

export type ListType = 'todo' | 'grocery' | 'other'

export interface ListItem {
  id: string
  text: string
  checked: boolean
  subcategory?: string   // grouping header within the list
  order: number          // display order; new items append at max+1
}

export interface AppList {
  id: string
  title: string
  type: ListType
  color: string          // hex color for the list card
  items: ListItem[]
  createdAt: string      // ISO
  updatedAt: string      // ISO
}

// ── UI types ───────────────────────────────────────────────────────────────

// Extended FamilyMember with client-side UI state (not stored in Redis)
export interface FamilyMemberUI extends FamilyMember {
  enabled: boolean
}

export type CalendarView = 'month' | 'week' | 'schedule' | 'day'

export interface NewEventDraft {
  title: string
  date: string        // YYYY-MM-DD
  startTime: string   // HH:MM
  endTime: string     // HH:MM
  familyMemberId: string
  calendarType: CalendarType
}
