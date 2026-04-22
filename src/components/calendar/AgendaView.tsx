'use client'

import { useMemo } from 'react'
import { sameDay, eventSpansDay, formatTime, hexToRgba } from '@/lib/utils'
import type { CalendarEvent } from '@/lib/calendar/types'

const DAYS_TO_SHOW = 14
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface AgendaViewProps {
  currentDate: Date
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
}

export function AgendaView({ currentDate, events, onEventClick }: AgendaViewProps) {
  const today = new Date()

  const days = useMemo(() => {
    return Array.from({ length: DAYS_TO_SHOW }, (_, i) => {
      const d = new Date(currentDate)
      d.setDate(d.getDate() + i)
      d.setHours(0, 0, 0, 0)
      return d
    })
  }, [currentDate])

  function eventsForDay(date: Date): CalendarEvent[] {
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
    return events
      .filter(e =>
        e.allDay
          ? eventSpansDay(e.start, e.end, date, true)
          : e.start < dayEnd && e.end > dayStart
      )
      .sort((a, b) => {
        if (a.allDay && !b.allDay) return -1
        if (!a.allDay && b.allDay) return 1
        return a.start.getTime() - b.start.getTime()
      })
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: '8px 16px 24px' }}>
      <div className="max-w-2xl mx-auto">
        {days.map((date, i) => {
          const isToday = sameDay(date, today)
          const isPast = !isToday && date < today
          const dayEvts = eventsForDay(date)

          return (
            <div
              key={date.toISOString()}
              className="flex gap-4 py-3"
              style={{
                opacity: isPast ? 0.55 : 1,
                borderBottom: i < days.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              {/* Date label column */}
              <div className="flex-shrink-0 flex flex-col items-center" style={{ width: 52 }}>
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: isToday ? 'var(--accent)' : 'var(--text-faint)' }}
                >
                  {DAY_NAMES[date.getDay()]}
                </span>
                <span
                  className="flex items-center justify-center w-9 h-9 rounded-full text-xl font-bold mt-0.5"
                  style={{
                    background: isToday ? 'var(--accent)' : 'transparent',
                    color: isToday ? '#fff' : 'var(--text)',
                  }}
                >
                  {date.getDate()}
                </span>
                <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
                  {MONTH_ABBR[date.getMonth()]}
                </span>
              </div>

              {/* Events column */}
              <div className="flex-1 flex flex-col gap-1.5 min-w-0 pt-1">
                {dayEvts.length === 0 ? (
                  <span className="text-[13px] leading-loose" style={{ color: 'var(--text-faint)' }}>
                    No events
                  </span>
                ) : (
                  dayEvts.map(ev => (
                    <button
                      key={ev.id}
                      onClick={() => onEventClick(ev)}
                      className="flex items-center gap-2.5 text-left w-full rounded-xl px-3 py-2.5 border-none cursor-pointer transition-all duration-100"
                      style={{
                        background: hexToRgba(ev.color, 0.12),
                        borderLeft: `4px solid ${ev.color}`,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.15)' }}
                      onMouseLeave={e => { e.currentTarget.style.filter = '' }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[14px] truncate" style={{ color: 'var(--text)' }}>
                          {ev.title}
                        </div>
                        {ev.location && (
                          <div className="text-[12px] truncate mt-0.5" style={{ color: 'var(--text-dim)' }}>
                            {ev.location}
                          </div>
                        )}
                      </div>
                      <div className="text-[12px] font-medium flex-shrink-0" style={{ color: ev.color }}>
                        {ev.allDay ? 'all day' : formatTime(ev.start)}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
