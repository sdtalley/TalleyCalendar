import type { CalendarEvent, FamilyMember, LocalEvent } from './types'

// Normalize a LocalEvent (Redis-stored) into a CalendarEvent for the UI
export function normalizeLocalEvent(
  event: LocalEvent,
  member: FamilyMember
): CalendarEvent {
  return {
    id: `local-${event.id}`,
    externalId: event.id,
    provider: 'local',
    accountId: `local:${event.memberId}`,
    title: event.title,
    description: event.description,
    location: event.location,
    start: new Date(event.start),
    end: new Date(event.end),
    allDay: event.allDay,
    recurring: false,
    familyMemberId: event.memberId,
    calendarType: event.calendarType,
    color: member.color,
    source: {
      calendarId: 'local',
      calendarName: `${member.name} (Local)`,
      provider: 'local',
    },
  }
}
