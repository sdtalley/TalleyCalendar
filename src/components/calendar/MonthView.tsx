'use client'

import { getMonthGridDates, sameDay, eventSpansDay, hexToRgba } from '@/lib/utils'
import type { CalendarEvent } from '@/lib/calendar/types'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface MonthViewProps {
  currentDate: Date
  selectedDate: Date
  events: CalendarEvent[]
  onSelectDate: (date: Date) => void
  onEventClick: (event: CalendarEvent) => void
}

export function MonthView({
  currentDate,
  selectedDate,
  events,
  onSelectDate,
  onEventClick,
}: MonthViewProps) {
  const today = new Date()
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const gridDates = getMonthGridDates(year, month)

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Weekday header */}
      <div
        className="grid grid-cols-7 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}
      >
        {DAYS.map(d => (
          <div
            key={d}
            className="py-2.5 text-center text-[12px] font-semibold uppercase tracking-widest"
            style={{ color: 'var(--text-faint)' }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 flex-1 overflow-hidden" style={{ gridTemplateRows: 'repeat(6, 1fr)' }}>
        {gridDates.map((date, i) => {
          const isOtherMonth = date.getMonth() !== month
          const isToday = sameDay(date, today)
          const isSelected = sameDay(date, selectedDate)

          // Split into all-day/multi-day vs timed events
          const dayAllDay = events.filter(
            e => (e.allDay || !sameDay(e.start, e.end)) && eventSpansDay(e.start, e.end, date)
          )
          const dayTimed = events.filter(
            e => !e.allDay && sameDay(e.start, e.end) && sameDay(e.start, date)
          )
          const dayEvents = [...dayAllDay, ...dayTimed]
          const maxShow = 3

          return (
            <div
              key={i}
              onClick={() => onSelectDate(date)}
              className="flex flex-col p-1 cursor-pointer transition-colors duration-100 overflow-hidden relative"
              style={{
                borderRight: (i + 1) % 7 === 0 ? 'none' : '1px solid var(--border)',
                borderBottom: '1px solid var(--border)',
                opacity: isOtherMonth ? 0.3 : 1,
                background: isSelected
                  ? 'rgba(108,140,255,0.1)'
                  : isToday
                  ? 'var(--accent-glow)'
                  : 'transparent',
                boxShadow: isSelected ? 'inset 0 0 0 2px var(--accent)' : undefined,
              }}
              onMouseEnter={e => {
                if (!isSelected) e.currentTarget.style.background = 'var(--surface2)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = isSelected
                  ? 'rgba(108,140,255,0.1)'
                  : isToday
                  ? 'var(--accent-glow)'
                  : 'transparent'
              }}
            >
              {/* Day number */}
              <div className="flex justify-end">
                <span
                  className="text-[13px] font-semibold px-1.5 rounded-full min-w-[26px] text-center leading-[22px]"
                  style={{
                    background: isToday ? 'var(--accent)' : 'transparent',
                    color: isToday ? '#fff' : 'var(--text)',
                  }}
                >
                  {date.getDate()}
                </span>
              </div>

              {/* Events */}
              <div className="flex flex-col gap-[2px] mt-[2px] overflow-hidden flex-1">
                {dayEvents.slice(0, maxShow).map(ev => {
                  const isAllDayStyle = ev.allDay || !sameDay(ev.start, ev.end)
                  return (
                    <button
                      key={ev.id}
                      onClick={e => {
                        e.stopPropagation()
                        onEventClick(ev)
                      }}
                      className="text-[11px] px-1.5 py-[2px] rounded text-left font-medium leading-[1.5] truncate w-full border-none cursor-pointer transition-all duration-100"
                      style={
                        isAllDayStyle
                          ? {
                              background: hexToRgba(ev.color, 0.3),
                              color: ev.color,
                              borderRadius: '3px',
                            }
                          : {
                              background: hexToRgba(ev.color, 0.13),
                              color: ev.color,
                              borderLeft: `3px solid ${ev.color}`,
                            }
                      }
                      onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.2)')}
                      onMouseLeave={e => (e.currentTarget.style.filter = '')}
                    >
                      {ev.title}
                    </button>
                  )
                })}
                {dayEvents.length > maxShow && (
                  <div
                    className="text-[10px] font-semibold px-1.5"
                    style={{ color: 'var(--text-faint)' }}
                  >
                    +{dayEvents.length - maxShow} more
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
