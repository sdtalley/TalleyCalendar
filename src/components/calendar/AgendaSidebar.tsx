'use client'

import { sameDay, eventSpansDay, formatTime, formatDateShort } from '@/lib/utils'
import type { CalendarEvent } from '@/lib/calendar/types'

interface AgendaSidebarProps {
  selectedDate: Date
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
}

export function AgendaSidebar({ selectedDate, events, onEventClick }: AgendaSidebarProps) {
  const today = new Date()

  // Show selected day + next 6 days
  const days: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + i)
    days.push(d)
  }

  const grouped = days
    .map(d => ({
      date: d,
      events: events
        .filter(e => eventSpansDay(e.start, e.end, d))
        .sort((a, b) => {
          // All-day events first, then by start time
          if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
          return a.start.getTime() - b.start.getTime()
        }),
    }))
    .filter(g => g.events.length > 0)

  const headerLabel = sameDay(selectedDate, today)
    ? "Today's Agenda"
    : formatDateShort(selectedDate)

  return (
    <aside
      className="flex flex-col overflow-hidden flex-shrink-0"
      style={{
        width: 300,
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
      }}
    >
      <div
        className="px-5 py-4 text-sm font-semibold uppercase tracking-widest flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-dim)' }}
      >
        {headerLabel}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {grouped.length === 0 ? (
          <div
            className="text-center text-sm mt-8"
            style={{ color: 'var(--text-faint)' }}
          >
            No events
          </div>
        ) : (
          grouped.map(({ date, events: dayEvs }) => (
            <div key={date.toISOString()}>
              <div
                className="text-[12px] font-semibold uppercase tracking-[0.8px] px-2 py-1 mt-2 first:mt-0"
                style={{ color: 'var(--text-faint)' }}
              >
                {sameDay(date, today)
                  ? 'Today'
                  : date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
              {dayEvs.map(ev => (
                <button
                  key={ev.id}
                  onClick={() => onEventClick(ev)}
                  className="flex gap-3 px-2.5 py-2.5 rounded-[8px] items-start w-full text-left border-none cursor-pointer transition-colors duration-100"
                  style={{ background: 'transparent' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span
                    className="font-mono text-[12px] min-w-[55px] pt-[2px]"
                    style={{ color: 'var(--text-dim)' }}
                  >
                    {ev.allDay ? 'all day' : formatTime(ev.start)}
                  </span>
                  <span
                    className="w-1 rounded-sm flex-shrink-0 self-stretch"
                    style={{ background: ev.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-sm font-semibold truncate"
                      style={{ color: 'var(--text)' }}
                    >
                      {ev.title}
                    </div>
                    {ev.location && (
                      <div
                        className="text-[11px] mt-0.5 truncate"
                        style={{ color: 'var(--text-dim)' }}
                      >
                        {ev.location}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </aside>
  )
}
