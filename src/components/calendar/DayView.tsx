'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { sameDay, eventSpansDay, formatTime, formatDateShort, hexToRgba } from '@/lib/utils'
import type { CalendarEvent } from '@/lib/calendar/types'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const HOUR_HEIGHT = 60

interface DayViewProps {
  currentDate: Date
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
  onDragCreate?: (date: Date, startMinutes: number, endMinutes: number) => void
}

function snapToQuarter(minutes: number): number {
  return Math.round(minutes / 15) * 15
}

export function DayView({ currentDate, events, onEventClick, onDragCreate }: DayViewProps) {
  const today = new Date()
  const bodyRef = useRef<HTMLDivElement>(null)
  const columnRef = useRef<HTMLDivElement>(null)
  const isToday = sameDay(currentDate, today)
  const nowMinutes = today.getHours() * 60 + today.getMinutes()

  // Drag-to-create state
  const [dragStart, setDragStart] = useState<number | null>(null)
  const [dragEnd, setDragEnd] = useState<number | null>(null)
  const dragging = useRef(false)

  // Split events
  const allDayEvents = events.filter(
    e => (e.allDay || !sameDay(e.start, e.end)) && eventSpansDay(e.start, e.end, currentDate)
  )
  const timedEvents = events.filter(
    e => !e.allDay && sameDay(e.start, e.end) && sameDay(e.start, currentDate)
  )

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = 7 * HOUR_HEIGHT
    }
  }, [])

  const getMinutesFromY = useCallback((clientY: number): number => {
    if (!columnRef.current) return 0
    const rect = columnRef.current.getBoundingClientRect()
    const scrollTop = bodyRef.current?.scrollTop ?? 0
    const y = clientY - rect.top + scrollTop
    const minutes = (y / (24 * HOUR_HEIGHT)) * 24 * 60
    return Math.max(0, Math.min(24 * 60, snapToQuarter(minutes)))
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    dragging.current = true
    const min = getMinutesFromY(e.clientY)
    setDragStart(min)
    setDragEnd(min + 30)
  }, [getMinutesFromY])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current || dragStart === null) return
    setDragEnd(getMinutesFromY(e.clientY))
  }, [dragStart, getMinutesFromY])

  const handleMouseUp = useCallback(() => {
    if (!dragging.current || dragStart === null || dragEnd === null) {
      dragging.current = false
      return
    }
    dragging.current = false
    const start = Math.min(dragStart, dragEnd)
    const end = Math.max(dragStart, dragEnd)
    if (end - start >= 15 && onDragCreate) {
      onDragCreate(currentDate, start, end)
    }
    setDragStart(null)
    setDragEnd(null)
  }, [dragStart, dragEnd, currentDate, onDragCreate])

  // Clean up drag on mouse leave
  const handleMouseLeave = useCallback(() => {
    if (dragging.current) {
      dragging.current = false
      setDragStart(null)
      setDragEnd(null)
    }
  }, [])

  // Preview rectangle
  const previewTop = dragStart !== null && dragEnd !== null
    ? (Math.min(dragStart, dragEnd) / 60) * HOUR_HEIGHT
    : 0
  const previewHeight = dragStart !== null && dragEnd !== null
    ? (Math.abs(dragEnd - dragStart) / 60) * HOUR_HEIGHT
    : 0

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

      {/* All-day section */}
      {allDayEvents.length > 0 && (
        <div
          className="flex-shrink-0 px-6 py-2 flex flex-wrap gap-2"
          style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
        >
          <span
            className="font-mono text-[11px] self-center mr-1"
            style={{ color: 'var(--text-faint)' }}
          >
            all day
          </span>
          {allDayEvents.map(ev => (
            <button
              key={ev.id}
              onClick={() => onEventClick(ev)}
              className="text-[12px] px-2.5 py-1 rounded-md font-medium border-none cursor-pointer transition-all duration-100"
              style={{
                background: hexToRgba(ev.color, 0.25),
                color: ev.color,
              }}
              onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.15)')}
              onMouseLeave={e => (e.currentTarget.style.filter = '')}
            >
              {ev.title}
            </button>
          ))}
        </div>
      )}

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
          ref={columnRef}
          className="relative select-none"
          style={{ borderLeft: '1px solid var(--border)', cursor: 'crosshair' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          {HOURS.map(h => (
            <div
              key={h}
              style={{ height: HOUR_HEIGHT, borderBottom: '1px solid var(--border)' }}
            />
          ))}

          {/* Drag preview */}
          {dragStart !== null && dragEnd !== null && previewHeight > 0 && (
            <div
              className="absolute left-1 right-4 rounded-lg pointer-events-none"
              style={{
                top: previewTop,
                height: previewHeight,
                background: 'rgba(108,140,255,0.15)',
                border: '2px dashed var(--accent)',
                zIndex: 5,
              }}
            />
          )}

          {timedEvents.map(ev => {
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
