'use client'

import { eventSpansDay, formatTime } from '@/lib/utils'
import type { CalendarEvent } from '@/lib/calendar/types'

interface MobileDayDrawerProps {
  open: boolean
  date: Date
  events: CalendarEvent[]
  onClose: () => void
  onEventClick: (event: CalendarEvent) => void
}

export function MobileDayDrawer({ open, date, events, onClose, onEventClick }: MobileDayDrawerProps) {
  const dayEvents = events
    .filter(e => eventSpansDay(e.start, e.end, date, e.allDay))
    .sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
      return a.start.getTime() - b.start.getTime()
    })

  const label = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 md:hidden transition-opacity duration-300"
        style={{
          background: 'rgba(0,0,0,0.5)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
        }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden flex flex-col transition-transform duration-300"
        style={{
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
          borderRadius: '16px 16px 0 0',
          maxHeight: '65dvh',
          transform: open ? 'translateY(0)' : 'translateY(100%)',
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 2 }} />
        </div>

        {/* Header */}
        <div
          className="flex items-center justify-between px-5 pb-3 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="font-semibold text-base" style={{ color: 'var(--text)' }}>
            {label}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-[8px] border-none cursor-pointer text-lg"
            style={{ background: 'var(--surface2)', color: 'var(--text-dim)' }}
          >
            ✕
          </button>
        </div>

        {/* Event list */}
        <div className="overflow-y-auto px-4 py-3">
          {dayEvents.length === 0 ? (
            <div
              className="text-sm text-center py-8"
              style={{ color: 'var(--text-faint)' }}
            >
              No events
            </div>
          ) : (
            dayEvents.map(ev => (
              <button
                key={ev.id}
                onClick={() => { onEventClick(ev); onClose() }}
                className="flex gap-3 px-3 py-3 rounded-[8px] items-start w-full text-left border-none cursor-pointer transition-colors duration-100 mb-1"
                style={{ background: 'transparent' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span
                  className="font-mono text-[12px] min-w-[55px] pt-[2px] flex-shrink-0"
                  style={{ color: 'var(--text-dim)' }}
                >
                  {ev.allDay ? 'all day' : formatTime(ev.start)}
                </span>
                <span
                  className="w-1 rounded-sm flex-shrink-0 self-stretch"
                  style={{ background: ev.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
                    {ev.title}
                  </div>
                  {ev.location && (
                    <div className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--text-dim)' }}>
                      {ev.location}
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  )
}
