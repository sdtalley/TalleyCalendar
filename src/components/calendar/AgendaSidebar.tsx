'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { sameDay, eventSpansDay, formatTime, formatDateShort } from '@/lib/utils'
import { DayView } from './DayView'
import type { CalendarEvent } from '@/lib/calendar/types'

const DEFAULT_WIDTH = 300
const MIN_WIDTH = 240
const MAX_WIDTH = 520

interface AgendaSidebarProps {
  selectedDate: Date
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
  onDragCreate: (date: Date, startMinutes: number, endMinutes: number) => void
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function AgendaSidebar({ selectedDate, events, onEventClick, onDragCreate }: AgendaSidebarProps) {
  const today = new Date()
  const [mode, setMode] = useState<'hours' | 'agenda'>('hours')
  const [note, setNote] = useState('')
  const [savedNote, setSavedNote] = useState('')
  const [noteLoading, setNoteLoading] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH)

  // Resize drag state
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(DEFAULT_WIDTH)

  function startResize(clientX: number) {
    isDragging.current = true
    dragStartX.current = clientX
    dragStartWidth.current = sidebarWidth

    function onMove(e: MouseEvent | TouchEvent) {
      if (!isDragging.current) return
      const x = 'touches' in e ? e.touches[0].clientX : e.clientX
      const delta = dragStartX.current - x   // left = wider
      setSidebarWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, dragStartWidth.current + delta)))
    }
    function onUp() {
      isDragging.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.addEventListener('touchmove', onMove, { passive: true })
    document.addEventListener('touchend', onUp)
  }

  const dateKey = toDateKey(selectedDate)
  const prevDateKey = useRef(dateKey)

  // Auto-switch to hours view whenever the selected date changes
  useEffect(() => {
    if (prevDateKey.current !== dateKey) {
      prevDateKey.current = dateKey
      setMode('hours')
    }
  }, [dateKey])

  // Fetch note when selected date changes
  useEffect(() => {
    setNoteLoading(true)
    fetch(`/api/notes?date=${dateKey}`)
      .then(r => r.json())
      .then(data => {
        setNote(data.content || '')
        setSavedNote(data.content || '')
      })
      .catch(() => {})
      .finally(() => setNoteLoading(false))
  }, [dateKey])

  const saveNote = useCallback(async () => {
    if (note === savedNote) return
    await fetch('/api/notes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: dateKey, content: note }),
    })
    setSavedNote(note)
  }, [note, savedNote, dateKey])

  // Show selected day + next 6 days for agenda mode
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
          if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
          return a.start.getTime() - b.start.getTime()
        }),
    }))
    .filter(g => g.events.length > 0)

  const headerLabel = sameDay(selectedDate, today)
    ? 'Today'
    : formatDateShort(selectedDate)

  return (
    <aside
      className="flex flex-col overflow-hidden flex-shrink-0 relative"
      style={{
        width: sidebarWidth,
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
      }}
    >
      {/* Drag-to-resize handle on the left border */}
      <div
        className="absolute top-0 bottom-0 left-0 z-20 flex items-center justify-center group"
        style={{ width: 6, cursor: 'col-resize' }}
        onMouseDown={e => { e.preventDefault(); startResize(e.clientX) }}
        onTouchStart={e => startResize(e.touches[0].clientX)}
      >
        <div
          className="h-12 w-0.5 rounded-full transition-colors duration-150 group-hover:opacity-100 opacity-0"
          style={{ background: 'var(--accent)' }}
        />
      </div>
      {/* Header: date label + Hours/Agenda toggle */}
      <div
        className="px-4 py-3 flex items-center justify-between flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div
          className="text-sm font-semibold uppercase tracking-widest"
          style={{ color: 'var(--text-dim)' }}
        >
          {headerLabel}
        </div>

        <div
          className="flex rounded-[6px] overflow-hidden"
          style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
        >
          <button
            onClick={() => setMode('hours')}
            className="px-[10px] py-[4px] text-[11px] font-medium border-none cursor-pointer transition-all duration-150"
            style={{
              background: mode === 'hours' ? 'var(--accent)' : 'transparent',
              color: mode === 'hours' ? '#fff' : 'var(--text-dim)',
            }}
          >
            Hours
          </button>
          <button
            onClick={() => setMode('agenda')}
            className="px-[10px] py-[4px] text-[11px] font-medium border-none cursor-pointer transition-all duration-150"
            style={{
              background: mode === 'agenda' ? 'var(--accent)' : 'transparent',
              color: mode === 'agenda' ? '#fff' : 'var(--text-dim)',
            }}
          >
            Agenda
          </button>
        </div>
      </div>

      {/* Hours mode — DayView without its own header */}
      {mode === 'hours' && (
        <DayView
          currentDate={selectedDate}
          events={events}
          onEventClick={onEventClick}
          onDragCreate={onDragCreate}
          hideHeader
        />
      )}

      {/* Agenda mode — upcoming events list + daily notes */}
      {mode === 'agenda' && (
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

          {/* Daily Notes */}
          <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <div
              className="text-[12px] font-semibold uppercase tracking-[0.8px] px-2 py-1 mb-1"
              style={{ color: 'var(--text-faint)' }}
            >
              Notes & Meals
            </div>
            <textarea
              value={noteLoading ? '' : note}
              onChange={e => setNote(e.target.value)}
              onBlur={saveNote}
              placeholder="Dinner ideas, reminders, meal plan..."
              rows={4}
              className="w-full text-[13px] px-3 py-2 rounded-lg resize-none"
              style={{
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                outline: 'none',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onBlurCapture={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            />
            {note !== savedNote && (
              <div
                className="text-[10px] text-right mt-0.5 px-1"
                style={{ color: 'var(--text-faint)' }}
              >
                unsaved
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  )
}
