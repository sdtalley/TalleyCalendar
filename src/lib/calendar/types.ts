export type CalendarProvider = 'google' | 'apple' | 'outlook' | 'local'
export type CalendarType = 'personal' | 'work' | 'kids' | 'shared'

export interface CalendarEvent {
  id: string
  externalId?: string
  provider: CalendarProvider
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

export interface FamilyMember {
  id: string
  name: string
  color: string
  enabled: boolean
  calendars: {
    provider: CalendarProvider
    calendarId: string
    type: CalendarType
  }[]
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
