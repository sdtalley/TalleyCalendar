'use client'

import { getWeekDates, sameDay, eventSpansDay, formatTimeCompact } from '@/lib/utils'
import type { CalendarEvent, FamilyMemberUI } from '@/lib/calendar/types'

function getMemberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return (parts[0][0] ?? '?').toUpperCase()
  return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase()
}

function getAvatarContent(m: FamilyMemberUI): { content: string; isEmoji: boolean } {
  if (m.avatar?.type === 'emoji') return { content: m.avatar.value, isEmoji: true }
  if (m.avatar?.type === 'initials' && m.avatar.value) return { content: m.avatar.value, isEmoji: false }
  return { content: getMemberInitials(m.name), isEmoji: false }
}

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface CalendarWeekViewProps {
  currentDate: Date
  events: CalendarEvent[]
  familyMembers?: FamilyMemberUI[]
  onEventClick: (event: CalendarEvent) => void
  onSelectDate?: (date: Date) => void
}

export function CalendarWeekView({
  currentDate,
  events,
  familyMembers = [],
  onEventClick,
  onSelectDate,
}: CalendarWeekViewProps) {
  const today = new Date()
  const weekDates = getWeekDates(currentDate)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Day header row */}
      <div
        className="flex flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}
      >
        {weekDates.map((date, i) => {
          const isToday = sameDay(date, today)
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center py-2 cursor-pointer select-none"
              style={{ borderRight: i < 6 ? '1px solid var(--border)' : undefined }}
              onClick={() => onSelectDate?.(date)}
            >
              <span
                className="text-[10px] font-medium uppercase tracking-wide"
                style={{ color: isToday ? 'var(--accent)' : 'var(--text-faint)' }}
              >
                {DAY_ABBR[date.getDay()]}
              </span>
              <span
                className="text-[16px] font-semibold mt-0.5 w-8 h-8 flex items-center justify-center rounded-full"
                style={{
                  background: isToday ? 'var(--accent)' : 'transparent',
                  color: isToday ? '#fff' : 'var(--text)',
                }}
              >
                {date.getDate()}
              </span>
            </div>
          )
        })}
      </div>

      {/* Events columns — shared vertical scroll */}
      <div className="flex flex-1 overflow-y-auto">
        {weekDates.map((date, i) => {
          const isToday = sameDay(date, today)
          const dayEvents = events
            .filter(e => eventSpansDay(e.start, e.end, date, e.allDay))
            .sort((a, b) => {
              if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
              return a.start.getTime() - b.start.getTime()
            })

          return (
            <div
              key={i}
              className="flex-1 flex flex-col gap-1 p-1.5 min-w-0"
              style={{
                borderRight: i < 6 ? '1px solid var(--border)' : undefined,
                background: isToday ? 'rgba(108,140,255,0.04)' : 'transparent',
              }}
            >
              {dayEvents.map(event => {
                const member = familyMembers.find(m => m.id === event.familyMemberId)
                const avatar = member ? getAvatarContent(member) : null
                return (
                  <button
                    key={event.id}
                    onClick={() => onEventClick(event)}
                    className="w-full text-left rounded-[5px] px-1.5 py-1 cursor-pointer border-none transition-all duration-100 min-w-0"
                    style={{ background: `${event.color}22`, borderLeft: `3px solid ${event.color}` }}
                    onMouseEnter={e => { e.currentTarget.style.background = `${event.color}33` }}
                    onMouseLeave={e => { e.currentTarget.style.background = `${event.color}22` }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="text-[11px] font-semibold truncate leading-tight" style={{ color: 'var(--text)' }}>
                          {event.title}
                        </div>
                        {!event.allDay && (
                          <div className="text-[10px] leading-tight" style={{ color: 'var(--text-dim)' }}>
                            {formatTimeCompact(event.start)}
                          </div>
                        )}
                      </div>
                      {avatar && (
                        <span style={{
                          width: 12, height: 12, borderRadius: '50%', background: event.color, color: '#fff',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: avatar.isEmoji ? 7 : 5, fontWeight: 700, flexShrink: 0,
                        }}>
                          {avatar.content}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
