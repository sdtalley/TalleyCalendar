'use client'

import { useEffect, useRef } from 'react'
import { getWeekDates, sameDay, eventSpansDay, formatTime, hexToRgba } from '@/lib/utils'
import type { CalendarEvent } from '@/lib/calendar/types'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const HOUR_HEIGHT = 60 // px per hour

interface WeekViewProps {
  currentDate: Date
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
}

export function WeekView({ currentDate, events, onEventClick }: WeekViewProps) {
  const today = new Date()
  const weekDates = getWeekDates(currentDate)
  const bodyRef = useRef<HTMLDivElement>(null)

  // Split events: all-day/multi-day vs timed
  const allDayEvents = events.filter(e => e.allDay || !sameDay(e.start, e.end))
  const timedEvents = events.filter(e => !e.allDay && sameDay(e.start, e.end))

  // Group all-day events per day for the week
  const allDayByDay = weekDates.map(day =>
    allDayEvents.filter(e => eventSpansDay(e.start, e.end, day))
  )
  const maxAllDay = Math.max(0, ...allDayByDay.map(d => d.length))

  // Scroll to 7am on mount
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = 7 * HOUR_HEIGHT
    }
  }, [])

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header row */}
      <div
        className="flex-shrink-0 grid"
        style={{
          gridTemplateColumns: `60px repeat(7, 1fr)`,
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
        }}
      >
        <div /> {/* time gutter */}
        {weekDates.map((d, i) => {
          const isToday = sameDay(d, today)
          return (
            <div key={i} className="py-2.5 px-2 text-center text-[12px]" style={{ color: 'var(--text-dim)' }}>
              <div className="uppercase tracking-wider text-[11px]">
                {d.toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
              <div
                className="text-[24px] font-bold leading-tight mt-0.5"
                style={{ color: isToday ? 'var(--accent)' : 'var(--text)' }}
              >
                {d.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* All-day section */}
      {maxAllDay > 0 && (
        <div
          className="flex-shrink-0 grid"
          style={{
            gridTemplateColumns: `60px repeat(7, 1fr)`,
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
          }}
        >
          <div
            className="font-mono text-[10px] text-right pr-2 flex items-center justify-end"
            style={{ color: 'var(--text-faint)' }}
          >
            all day
          </div>
          {weekDates.map((day, di) => (
            <div
              key={di}
              className="flex flex-col gap-[2px] py-1 px-[2px]"
              style={{ borderLeft: '1px solid var(--border)', minHeight: 28 }}
            >
              {allDayByDay[di].map(ev => (
                <button
                  key={ev.id}
                  onClick={() => onEventClick(ev)}
                  className="text-[10px] px-1.5 py-[1px] rounded font-medium truncate w-full border-none cursor-pointer text-left transition-all duration-100"
                  style={{
                    background: hexToRgba(ev.color, 0.3),
                    color: ev.color,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.2)')}
                  onMouseLeave={e => (e.currentTarget.style.filter = '')}
                >
                  {ev.title}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Scrollable body */}
      <div
        ref={bodyRef}
        className="flex-1 overflow-y-auto relative"
        style={{ display: 'grid', gridTemplateColumns: `60px repeat(7, 1fr)` }}
      >
        {/* Time labels */}
        <div className="flex flex-col">
          {HOURS.map(h => (
            <div
              key={h}
              className="font-mono text-[11px] text-right pr-2 flex-shrink-0"
              style={{
                height: HOUR_HEIGHT,
                color: 'var(--text-faint)',
                paddingTop: 0,
                transform: 'translateY(-7px)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'flex-end',
              }}
            >
              {h === 0 ? '' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {weekDates.map((day, di) => {
          const dayEvents = timedEvents.filter(e => sameDay(e.start, day))
          const nowMinutes = today.getHours() * 60 + today.getMinutes()

          return (
            <div
              key={di}
              className="relative"
              style={{ borderLeft: '1px solid var(--border)' }}
            >
              {/* Hour lines */}
              {HOURS.map(h => (
                <div
                  key={h}
                  style={{ height: HOUR_HEIGHT, borderBottom: '1px solid var(--border)' }}
                />
              ))}

              {/* Events */}
              {dayEvents.map(ev => {
                const startMin = ev.start.getHours() * 60 + ev.start.getMinutes()
                const endMin = ev.end.getHours() * 60 + ev.end.getMinutes()
                const top = (startMin / 60) * HOUR_HEIGHT
                const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 20)

                return (
                  <button
                    key={ev.id}
                    onClick={() => onEventClick(ev)}
                    className="absolute left-[2px] right-[2px] rounded-md px-2 py-1 text-[11px] font-medium overflow-hidden cursor-pointer border-none text-left transition-all duration-100"
                    style={{
                      top,
                      height,
                      background: hexToRgba(ev.color, 0.2),
                      color: ev.color,
                      borderLeft: `3px solid ${ev.color}`,
                      zIndex: 2,
                      lineHeight: 1.3,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.filter = 'brightness(1.2)'
                      e.currentTarget.style.zIndex = '3'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.filter = ''
                      e.currentTarget.style.zIndex = '2'
                    }}
                  >
                    <div>{ev.title}</div>
                    <div className="font-mono text-[10px] opacity-80">
                      {formatTime(ev.start)}
                    </div>
                  </button>
                )
              })}

              {/* Current time line */}
              {sameDay(day, today) && (
                <div
                  className="now-line"
                  style={{ top: (nowMinutes / 60) * HOUR_HEIGHT }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
