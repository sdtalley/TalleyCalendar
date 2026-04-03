import type { CalendarEvent, FamilyMember } from './calendar/types'
import { addMinutes } from './utils'

export const DEFAULT_FAMILY_MEMBERS: FamilyMember[] = [
  {
    id: 'you',
    name: 'You',
    color: '#6c8cff',
    enabled: true,
    calendars: [{ provider: 'google', calendarId: 'primary', type: 'personal' }],
  },
  {
    id: 'partner',
    name: 'Partner',
    color: '#ff6b8a',
    enabled: true,
    calendars: [{ provider: 'apple', calendarId: 'personal', type: 'personal' }],
  },
  {
    id: 'kid1',
    name: 'Alex',
    color: '#4ecdc4',
    enabled: true,
    calendars: [{ provider: 'local', calendarId: 'shared', type: 'kids' }],
  },
  {
    id: 'kid2',
    name: 'Jordan',
    color: '#ffd166',
    enabled: true,
    calendars: [{ provider: 'local', calendarId: 'shared', type: 'kids' }],
  },
  {
    id: 'work_you',
    name: 'Work (You)',
    color: '#a78bfa',
    enabled: true,
    calendars: [{ provider: 'outlook', calendarId: 'primary', type: 'work' }],
  },
  {
    id: 'work_partner',
    name: 'Work (Partner)',
    color: '#ff8c42',
    enabled: true,
    calendars: [{ provider: 'outlook', calendarId: 'primary', type: 'work' }],
  },
]

const memberColors: Record<string, string> = {
  you: '#6c8cff',
  partner: '#ff6b8a',
  kid1: '#4ecdc4',
  kid2: '#ffd166',
  work_you: '#a78bfa',
  work_partner: '#ff8c42',
}

interface EventTemplate {
  title: string
  memberId: string
  calType: 'personal' | 'work' | 'kids' | 'shared'
  startHour: number
  startMin: number
  durationMin: number
}

const templates: EventTemplate[] = [
  { title: 'Team Standup', memberId: 'work_you', calType: 'work', startHour: 9, startMin: 0, durationMin: 30 },
  { title: 'Dentist Appt', memberId: 'partner', calType: 'personal', startHour: 10, startMin: 30, durationMin: 60 },
  { title: 'Soccer Practice', memberId: 'kid1', calType: 'kids', startHour: 16, startMin: 0, durationMin: 90 },
  { title: 'Piano Lesson', memberId: 'kid2', calType: 'kids', startHour: 15, startMin: 0, durationMin: 45 },
  { title: 'Date Night', memberId: 'you', calType: 'shared', startHour: 19, startMin: 0, durationMin: 120 },
  { title: 'Sprint Planning', memberId: 'work_you', calType: 'work', startHour: 10, startMin: 0, durationMin: 60 },
  { title: 'Grocery Run', memberId: 'partner', calType: 'shared', startHour: 11, startMin: 0, durationMin: 60 },
  { title: 'Swim Class', memberId: 'kid1', calType: 'kids', startHour: 9, startMin: 0, durationMin: 60 },
  { title: 'Book Club', memberId: 'partner', calType: 'personal', startHour: 19, startMin: 30, durationMin: 90 },
  { title: '1:1 w/ Manager', memberId: 'work_you', calType: 'work', startHour: 14, startMin: 0, durationMin: 30 },
  { title: 'Family Dinner', memberId: 'you', calType: 'shared', startHour: 18, startMin: 0, durationMin: 90 },
  { title: 'Art Class', memberId: 'kid2', calType: 'kids', startHour: 10, startMin: 0, durationMin: 60 },
  { title: 'Yoga', memberId: 'you', calType: 'personal', startHour: 7, startMin: 0, durationMin: 60 },
  { title: 'Client Call', memberId: 'work_partner', calType: 'work', startHour: 11, startMin: 0, durationMin: 45 },
  { title: 'Playdate', memberId: 'kid1', calType: 'kids', startHour: 14, startMin: 0, durationMin: 120 },
  { title: 'Doctor Appt', memberId: 'you', calType: 'personal', startHour: 8, startMin: 30, durationMin: 45 },
  { title: 'School Pickup', memberId: 'partner', calType: 'kids', startHour: 15, startMin: 15, durationMin: 30 },
  { title: 'Board Meeting', memberId: 'work_partner', calType: 'work', startHour: 13, startMin: 0, durationMin: 60 },
  { title: 'Park Outing', memberId: 'kid2', calType: 'shared', startHour: 10, startMin: 0, durationMin: 120 },
  { title: 'Haircut', memberId: 'you', calType: 'personal', startHour: 12, startMin: 0, durationMin: 30 },
]

export function generateSampleEvents(): CalendarEvent[] {
  const events: CalendarEvent[] = []
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  for (let day = 1; day <= daysInMonth; day++) {
    const count = 2 + Math.floor(Math.random() * 3)
    const used = new Set<number>()
    for (let i = 0; i < count; i++) {
      let idx: number
      do {
        idx = Math.floor(Math.random() * templates.length)
      } while (used.has(idx))
      used.add(idx)

      const t = templates[idx]
      const start = new Date(year, month, day, t.startHour, t.startMin)
      const end = addMinutes(start, t.durationMin)
      const color = memberColors[t.memberId] ?? '#6c8cff'

      events.push({
        id: `sample-${day}-${i}`,
        provider: 'local',
        title: t.title,
        start,
        end,
        allDay: false,
        recurring: false,
        familyMemberId: t.memberId,
        calendarType: t.calType,
        color,
        source: { calendarId: 'local', calendarName: 'Local', provider: 'local' },
      })
    }
  }
  return events
}
