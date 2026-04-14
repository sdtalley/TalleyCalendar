'use client'

import { useEffect } from 'react'
import { formatTime, hexToRgba } from '@/lib/utils'
import type { CalendarEvent, FamilyMemberUI } from '@/lib/calendar/types'

interface EventDetailModalProps {
  event: CalendarEvent | null
  familyMembers: FamilyMemberUI[]
  onClose: () => void
}

function formatDateLong(d: Date, allDay = false): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    // All-day event dates are stored as UTC midnight; force UTC to get correct calendar date
    ...(allDay && { timeZone: 'UTC' }),
  })
}

function providerLabel(provider: string): string {
  switch (provider) {
    case 'google': return 'Google Calendar'
    case 'outlook': return 'Outlook'
    case 'apple': return 'Apple iCloud'
    case 'local': return 'Local'
    default: return provider
  }
}

export function EventDetailModal({ event, familyMembers, onClose }: EventDetailModalProps) {
  const open = !!event

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!event) return null

  const member = familyMembers.find(m => m.id === event.familyMemberId)
  // For all-day events the end is exclusive (Outlook/Google convention: end = next day midnight)
  // so a single-day all-day event has end - start = exactly 1 day
  const allDaySingleDay = event.allDay && event.end.getTime() - event.start.getTime() <= 86_400_000
  const sameDate = !event.allDay && (
    event.start.getFullYear() === event.end.getFullYear() &&
    event.start.getMonth() === event.end.getMonth() &&
    event.start.getDate() === event.end.getDate()
  )

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 transition-opacity duration-200"
      style={{
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        opacity: 1,
        pointerEvents: 'all',
      }}
      onClick={onClose}
    >
      <div
        className="w-[480px] max-w-[95vw] rounded-2xl"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Color banner */}
        <div
          className="h-2 rounded-t-2xl"
          style={{ background: event.color }}
        />

        {/* Header */}
        <div
          className="flex items-start justify-between px-6 pt-5 pb-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex-1 min-w-0">
            <h2
              className="text-[20px] font-bold leading-tight"
              style={{ color: 'var(--text)' }}
            >
              {event.title}
            </h2>
            {event.source.calendarName && (
              <div className="text-[12px] mt-1" style={{ color: 'var(--text-faint)' }}>
                {event.source.calendarName}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-lg cursor-pointer border-none transition-all duration-150 flex-shrink-0 ml-3"
            style={{ background: 'var(--surface2)', color: 'var(--text-dim)' }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--surface3)'
              e.currentTarget.style.color = 'var(--text)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'var(--surface2)'
              e.currentTarget.style.color = 'var(--text-dim)'
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-4">
          {/* Date/Time */}
          <DetailRow label="When">
            {event.allDay ? (
              <span>
                {formatDateLong(event.start, true)}
                {!allDaySingleDay && ` — ${formatDateLong(new Date(event.end.getTime() - 86_400_000), true)}`}
                <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--surface2)', color: 'var(--text-dim)' }}>
                  All day
                </span>
              </span>
            ) : sameDate ? (
              <span>
                {formatDateLong(event.start)}
                <br />
                {formatTime(event.start)} — {formatTime(event.end)}
              </span>
            ) : (
              <span>
                {formatDateLong(event.start)} {formatTime(event.start)}
                <br />
                — {formatDateLong(event.end)} {formatTime(event.end)}
              </span>
            )}
          </DetailRow>

          {/* Person */}
          {member && (
            <DetailRow label="Person">
              <span className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full inline-block flex-shrink-0"
                  style={{ background: member.color }}
                />
                {member.name}
              </span>
            </DetailRow>
          )}

          {/* Location */}
          {event.location && (
            <DetailRow label="Location">
              {event.location}
            </DetailRow>
          )}

          {/* Description */}
          {event.description && (
            <DetailRow label="Notes">
              <span className="whitespace-pre-wrap">{event.description}</span>
            </DetailRow>
          )}

          {/* Recurring badge */}
          {event.recurring && (
            <DetailRow label="Recurrence">
              <span
                className="text-[11px] px-2 py-0.5 rounded-full"
                style={{ background: 'var(--surface2)', color: 'var(--text-dim)' }}
              >
                Recurring event
              </span>
            </DetailRow>
          )}

          {/* Source */}
          <DetailRow label="Source">
            <span
              className="text-[11px] px-2 py-1 rounded-md"
              style={{ background: hexToRgba(event.color, 0.1), color: event.color }}
            >
              {providerLabel(event.source.provider)}
            </span>
          </DetailRow>
        </div>

        {/* Footer */}
        <div
          className="flex justify-end px-6 py-4"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-[8px] text-sm font-medium cursor-pointer border-none transition-all duration-150"
            style={{ background: 'var(--surface2)', color: 'var(--text-dim)' }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--surface3)'
              e.currentTarget.style.color = 'var(--text)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'var(--surface2)'
              e.currentTarget.style.color = 'var(--text-dim)'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <span
        className="text-[12px] font-semibold uppercase tracking-wide min-w-[80px] pt-0.5 flex-shrink-0"
        style={{ color: 'var(--text-faint)' }}
      >
        {label}
      </span>
      <span className="text-[14px] leading-relaxed" style={{ color: 'var(--text)' }}>
        {children}
      </span>
    </div>
  )
}
