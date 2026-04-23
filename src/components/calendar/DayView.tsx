'use client'

import { useState, useEffect, useMemo } from 'react'
import { sameDay, eventSpansDay, formatTime, hexToRgba } from '@/lib/utils'
import type { CalendarEvent } from '@/lib/calendar/types'

const DAY_ABBR = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface DayViewProps {
  currentDate: Date
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
  onSelectDate: (date: Date) => void
  onAddEvent?: (date: Date) => void
}

export function DayView({ currentDate, events, onEventClick, onSelectDate, onAddEvent }: DayViewProps) {
  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const [miniCalMonth, setMiniCalMonth] = useState<Date>(
    () => new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  )

  const curYear = currentDate.getFullYear()
  const curMonth = currentDate.getMonth()
  useEffect(() => {
    setMiniCalMonth(new Date(curYear, curMonth, 1))
  }, [curYear, curMonth])

  const calDays = useMemo(() => {
    const y = miniCalMonth.getFullYear()
    const m = miniCalMonth.getMonth()
    const firstDow = new Date(y, m, 1).getDay()
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    const cells: (Date | null)[] = []
    for (let i = 0; i < firstDow; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d))
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [miniCalMonth])

  const dayEvents = useMemo(() => {
    const dayStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate())
    const dayEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1)
    return events
      .filter(e =>
        e.allDay
          ? eventSpansDay(e.start, e.end, currentDate, true)
          : e.start < dayEnd && e.end > dayStart
      )
      .sort((a, b) => {
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
        return a.start.getTime() - b.start.getTime()
      })
  }, [currentDate, events])

  function headerLabel(): string {
    const d = new Date(currentDate)
    d.setHours(0, 0, 0, 0)
    if (sameDay(d, today)) return 'Today'
    const tom = new Date(today)
    tom.setDate(today.getDate() + 1)
    if (sameDay(d, tom)) return 'Tomorrow'
    const yest = new Date(today)
    yest.setDate(today.getDate() - 1)
    if (sameDay(d, yest)) return 'Yesterday'
    return currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  }

  const label = headerLabel()

  return (
    <div className="flex h-full overflow-hidden">
      {/* LEFT: Mini month calendar — desktop only */}
      <div
        className="hidden md:flex flex-col flex-shrink-0"
        style={{
          width: '38%',
          maxWidth: 440,
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
        }}
      >
        <div className="flex flex-col justify-center flex-1 py-8 px-4">
          <div style={{ maxWidth: 340, margin: '0 auto', width: '100%' }}>

            {/* Month navigation */}
            <div className="flex items-center justify-between mb-5">
              <button
                onClick={() => setMiniCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                className="flex items-center justify-center w-9 h-9 rounded-full border-none cursor-pointer transition-colors duration-100"
                style={{ background: 'none', color: 'var(--text-dim)', fontSize: 22 }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
              >
                &#8249;
              </button>
              <span className="font-bold text-[17px]" style={{ color: 'var(--text)' }}>
                {MONTH_NAMES[miniCalMonth.getMonth()]} {miniCalMonth.getFullYear()}
              </span>
              <button
                onClick={() => setMiniCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                className="flex items-center justify-center w-9 h-9 rounded-full border-none cursor-pointer transition-colors duration-100"
                style={{ background: 'none', color: 'var(--text-dim)', fontSize: 22 }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
              >
                &#8250;
              </button>
            </div>

            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAY_ABBR.map(d => (
                <div
                  key={d}
                  className="text-center text-[11px] font-semibold uppercase py-1.5"
                  style={{ color: 'var(--text-faint)' }}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-0.5">
              {calDays.map((day, i) => {
                if (!day) return <div key={`empty-${i}`} />
                const isToday = sameDay(day, today)
                const isSelected = sameDay(day, currentDate)
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => onSelectDate(new Date(day.getFullYear(), day.getMonth(), day.getDate()))}
                    className="w-full aspect-square flex items-center justify-center rounded-full text-[14px] cursor-pointer border-none transition-all duration-100"
                    style={{
                      background: isToday
                        ? 'var(--accent)'
                        : isSelected
                        ? 'var(--accent-glow)'
                        : 'transparent',
                      color: isToday ? '#fff' : isSelected ? 'var(--accent)' : 'var(--text)',
                      fontWeight: isToday || isSelected ? 700 : 400,
                      outline: isSelected && !isToday ? '2px solid var(--accent)' : 'none',
                      outlineOffset: -1,
                    }}
                    onMouseEnter={e => {
                      if (!isToday && !isSelected) e.currentTarget.style.background = 'var(--surface2)'
                    }}
                    onMouseLeave={e => {
                      if (!isToday && !isSelected) e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    {day.getDate()}
                  </button>
                )
              })}
            </div>

          </div>
        </div>
      </div>

      {/* RIGHT: Event list */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--surface)' }}>

        {/* Day header */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div>
            <div className="font-bold text-[22px]" style={{ color: 'var(--text)' }}>
              {label}
            </div>
            <div className="text-[13px] mt-0.5" style={{ color: 'var(--text-dim)' }}>
              {dayEvents.length === 0
                ? 'Nothing scheduled'
                : `${dayEvents.length} event${dayEvents.length !== 1 ? 's' : ''}`}
            </div>
          </div>
          {onAddEvent && (
            <button
              onClick={() => onAddEvent(currentDate)}
              className="flex items-center gap-1 rounded-[9px] text-sm font-semibold text-white border-none cursor-pointer transition-all duration-150"
              style={{
                padding: '8px 16px',
                background: 'var(--accent)',
                boxShadow: '0 4px 14px rgba(108,140,255,0.3)',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = '' }}
            >
              + Add Event
            </button>
          )}
        </div>

        {/* Events scroll area */}
        <div
          className="flex-1 overflow-y-auto"
          style={{ padding: '16px 20px 32px', touchAction: 'pan-y' }}
        >
          {dayEvents.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center h-full gap-4"
              style={{ color: 'var(--text-faint)' }}
            >
              <span style={{ fontSize: 52, lineHeight: 1 }}>&#128197;</span>
              <span className="text-[15px]">Nothing scheduled</span>
              {onAddEvent && (
                <button
                  onClick={() => onAddEvent(currentDate)}
                  className="text-[13px] font-semibold border-none cursor-pointer px-5 py-2.5 rounded-[9px] transition-all duration-150"
                  style={{ color: 'var(--accent)', background: 'var(--accent-glow)' }}
                  onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.1)' }}
                  onMouseLeave={e => { e.currentTarget.style.filter = '' }}
                >
                  + Add Event
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {dayEvents.map(ev => (
                <button
                  key={ev.id}
                  onClick={() => onEventClick(ev)}
                  className="flex items-center gap-4 w-full text-left rounded-2xl px-5 py-4 border-none cursor-pointer transition-all duration-100"
                  style={{
                    background: hexToRgba(ev.color, 0.1),
                    borderLeft: `4px solid ${ev.color}`,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.1)' }}
                  onMouseLeave={e => { e.currentTarget.style.filter = '' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[15px] truncate" style={{ color: 'var(--text)' }}>
                      {ev.title}
                    </div>
                    {ev.location && (
                      <div className="text-[12px] mt-0.5 truncate" style={{ color: 'var(--text-dim)' }}>
                        &#128205; {ev.location}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-[13px] font-semibold" style={{ color: ev.color }}>
                      {ev.allDay
                        ? 'All day'
                        : `${formatTime(ev.start)} – ${formatTime(ev.end)}`}
                    </span>
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: ev.color,
                        flexShrink: 0,
                        display: 'inline-block',
                      }}
                    />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
