'use client'

import { useEffect, useState, useCallback } from 'react'
import { sameDay, eventSpansDay, formatTime, formatDateShort } from '@/lib/utils'
import type { CalendarEvent } from '@/lib/calendar/types'

interface AgendaSidebarProps {
  selectedDate: Date
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function AgendaSidebar({ selectedDate, events, onEventClick }: AgendaSidebarProps) {
  const today = new Date()
  const [note, setNote] = useState('')
  const [savedNote, setSavedNote] = useState('')
  const [noteLoading, setNoteLoading] = useState(false)

  const dateKey = toDateKey(selectedDate)

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
    </aside>
  )
}
