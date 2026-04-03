'use client'

import { useEffect, useRef } from 'react'
import { sameDay, formatTime, formatDateShort, hexToRgba } from '@/lib/utils'
import type { CalendarEvent } from '@/lib/calendar/types'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const HOUR_HEIGHT = 60

interface DayViewProps {
  currentDate: Date
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
}

export function DayView({ currentDate, events, onEventClick }: DayViewProps) {
  const today = new Date()
  const bodyRef = useRef<HTMLDivElement>(null)
  const dayEvents = events.filter(e => sameDay(e.start, currentDate))
  const nowMinutes = today.getHours() * 60 + today.getMinutes()
  const isToday = sameDay(currentDate, today)

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = 7 * HOUR_HEIGHT
    }
  }, [])

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Day header */}
      <div
        className="flex-shrink-0 px-6 py-4"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="text-[28px] font-bold tracking-tight">
          {formatDateShort(currentDate)}
          {isToday && (
            <span className="ml-3 text-base font-semibold" style={{ color: 'var(--accent)' }}>
              Today
            </span>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div
        ref={bodyRef}
        className="flex-1 overflow-y-auto"
        style={{ display: 'grid', gridTemplateColumns: '70px 1fr' }}
      >
        {/* Time labels */}
        <div className="flex flex-col">
          {HOURS.map(h => (
            <div
              key={h}
              className="font-mono text-[12px] text-right pr-3 flex-shrink-0"
              style={{
                height: HOUR_HEIGHT,
                color: 'var(--text-faint)',
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

        {/* Events column */}
        <div
          className="relative"
          style={{ borderLeft: '1px solid var(--border)' }}
        >
          {HOURS.map(h => (
            <div
              key={h}
              style={{ height: HOUR_HEIGHT, borderBottom: '1px solid var(--border)' }}
            />
          ))}

          {dayEvents.map(ev => {
            const startMin = ev.start.getHours() * 60 + ev.start.getMinutes()
            const endMin = ev.end.getHours() * 60 + ev.end.getMinutes()
            const top = (startMin / 60) * HOUR_HEIGHT
            const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 24)

            return (
              <button
                key={ev.id}
                onClick={() => onEventClick(ev)}
                className="absolute left-1 right-4 rounded-lg px-3 py-2 text-[13px] font-medium text-left cursor-pointer border-none transition-all duration-100"
                style={{
                  top,
                  height,
                  background: hexToRgba(ev.color, 0.15),
                  color: ev.color,
                  borderLeft: `4px solid ${ev.color}`,
                  zIndex: 2,
                }}
                onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.15)')}
                onMouseLeave={e => (e.currentTarget.style.filter = '')}
              >
                <div className="font-semibold truncate">{ev.title}</div>
                <div className="font-mono text-[11px] opacity-80 mt-0.5">
                  {formatTime(ev.start)} – {formatTime(ev.end)}
                </div>
              </button>
            )
          })}

          {isToday && (
            <div
              className="now-line"
              style={{ top: (nowMinutes / 60) * HOUR_HEIGHT }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
