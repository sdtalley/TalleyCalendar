'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { getWeekDates, sameDay, eventSpansDay, hexToRgba } from '@/lib/utils'
import type { CalendarEvent } from '@/lib/calendar/types'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const HOUR_HEIGHT = 60 // px per hour

interface WeekViewProps {
  currentDate: Date
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
  onDragCreate?: (date: Date, startMinutes: number, endMinutes: number) => void
}

function snapToQuarter(minutes: number): number {
  return Math.round(minutes / 15) * 15
}

export function WeekView({ currentDate, events, onEventClick, onDragCreate }: WeekViewProps) {
  const today = new Date()
  const weekDates = getWeekDates(currentDate)
  const bodyRef = useRef<HTMLDivElement>(null)
  const columnRefs = useRef<(HTMLDivElement | null)[]>([])

  // Split events: all-day/multi-day vs timed
  const allDayEvents = events.filter(e => e.allDay || !sameDay(e.start, e.end))
  const timedEvents = events.filter(e => !e.allDay && sameDay(e.start, e.end))

  // Group all-day events per day for the week
  const allDayByDay = weekDates.map(day =>
    allDayEvents.filter(e => eventSpansDay(e.start, e.end, day))
  )
  const maxAllDay = Math.max(0, ...allDayByDay.map(d => d.length))

  // Drag-to-create state
  const [dragDayIndex, setDragDayIndex] = useState<number | null>(null)
  const [dragStart, setDragStart] = useState<number | null>(null)
  const [dragEnd, setDragEnd] = useState<number | null>(null)
  const dragging = useRef(false)

  // Scroll to 7am on mount
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = 7 * HOUR_HEIGHT
    }
  }, [])

  const getMinutesFromY = useCallback((clientY: number, colEl: HTMLDivElement | null): number => {
    if (!colEl) return 0
    const rect = colEl.getBoundingClientRect()
    const scrollTop = bodyRef.current?.scrollTop ?? 0
    const y = clientY - rect.top + scrollTop
    const minutes = (y / (24 * HOUR_HEIGHT)) * 24 * 60
    return Math.max(0, Math.min(24 * 60, snapToQuarter(minutes)))
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent, dayIndex: number) => {
    if ((e.target as HTMLElement).closest('button')) return
    dragging.current = true
    const min = getMinutesFromY(e.clientY, columnRefs.current[dayIndex])
    setDragDayIndex(dayIndex)
    setDragStart(min)
    setDragEnd(min + 30)
  }, [getMinutesFromY])

  const handleMouseMove = useCallback((e: React.MouseEvent, dayIndex: number) => {
    if (!dragging.current || dragDayIndex !== dayIndex || dragStart === null) return
    setDragEnd(getMinutesFromY(e.clientY, columnRefs.current[dayIndex]))
  }, [dragDayIndex, dragStart, getMinutesFromY])

  const handleMouseUp = useCallback((dayIndex: number) => {
    if (!dragging.current || dragDayIndex !== dayIndex || dragStart === null || dragEnd === null) {
      dragging.current = false
      return
    }
    dragging.current = false
    const start = Math.min(dragStart, dragEnd)
    const end = Math.max(dragStart, dragEnd)
    if (end - start >= 15 && onDragCreate) {
      onDragCreate(weekDates[dayIndex], start, end)
    }
    setDragDayIndex(null)
    setDragStart(null)
    setDragEnd(null)
  }, [dragDayIndex, dragStart, dragEnd, weekDates, onDragCreate])

  const handleMouseLeave = useCallback(() => {
    if (dragging.current) {
      dragging.current = false
      setDragDayIndex(null)
      setDragStart(null)
      setDragEnd(null)
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
          const isDragTarget = dragDayIndex === di && dragStart !== null && dragEnd !== null

          const previewTop = isDragTarget
            ? (Math.min(dragStart!, dragEnd!) / 60) * HOUR_HEIGHT
            : 0
          const previewHeight = isDragTarget
            ? (Math.abs(dragEnd! - dragStart!) / 60) * HOUR_HEIGHT
            : 0

          return (
            <div
              key={di}
              ref={el => { columnRefs.current[di] = el }}
              className="relative select-none"
              style={{ borderLeft: '1px solid var(--border)', cursor: 'crosshair' }}
              onMouseDown={e => handleMouseDown(e, di)}
              onMouseMove={e => handleMouseMove(e, di)}
              onMouseUp={() => handleMouseUp(di)}
              onMouseLeave={handleMouseLeave}
            >
              {/* Hour lines */}
              {HOURS.map(h => (
                <div
                  key={h}
                  style={{ height: HOUR_HEIGHT, borderBottom: '1px solid var(--border)' }}
                />
              ))}

              {/* Drag preview */}
              {isDragTarget && previewHeight > 0 && (
                <div
                  className="absolute left-[2px] right-[2px] rounded-md pointer-events-none"
                  style={{
                    top: previewTop,
                    height: previewHeight,
                    background: 'rgba(108,140,255,0.15)',
                    border: '2px dashed var(--accent)',
                    zIndex: 5,
                  }}
                />
              )}

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
