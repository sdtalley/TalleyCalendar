'use client'

import { useEffect, useRef, useState } from 'react'
import type { FamilyMember, NewEventDraft, CalendarType } from '@/lib/calendar/types'

interface EventModalProps {
  open: boolean
  initialDate?: Date
  familyMembers: FamilyMember[]
  onClose: () => void
  onSave: (draft: NewEventDraft) => void
}

const CAL_TYPES: { id: CalendarType; label: string }[] = [
  { id: 'personal', label: 'Personal' },
  { id: 'work', label: 'Work' },
  { id: 'kids', label: 'Kids' },
  { id: 'shared', label: 'Shared' },
]

function toDateString(d: Date): string {
  return d.toISOString().split('T')[0]
}

export function EventModal({
  open,
  initialDate,
  familyMembers,
  onClose,
  onSave,
}: EventModalProps) {
  const titleRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState<NewEventDraft>({
    title: '',
    date: toDateString(initialDate ?? new Date()),
    startTime: '09:00',
    endTime: '10:00',
    familyMemberId: familyMembers[0]?.id ?? '',
    calendarType: 'personal',
  })

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setDraft(prev => ({
        ...prev,
        date: toDateString(initialDate ?? new Date()),
        title: '',
      }))
      setTimeout(() => titleRef.current?.focus(), 50)
    }
  }, [open, initialDate])

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  function handleSave() {
    if (!draft.title.trim()) {
      titleRef.current?.focus()
      return
    }
    onSave(draft)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 transition-opacity duration-200"
      style={{
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        opacity: open ? 1 : 0,
        pointerEvents: open ? 'all' : 'none',
      }}
      onClick={onClose}
    >
      <div
        className="w-[480px] max-w-[95vw] rounded-2xl transition-all duration-200"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow)',
          transform: open ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.97)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="text-[18px] font-bold">New Event</div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-lg cursor-pointer border-none transition-all duration-150"
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
        <div className="px-6 py-6 flex flex-col gap-4">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="field-label">Event Title</label>
            <input
              ref={titleRef}
              type="text"
              placeholder="What's happening?"
              value={draft.title}
              onChange={e => setDraft(p => ({ ...p, title: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
          </div>

          {/* Date + Person */}
          <div className="flex gap-3">
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="field-label">Date</label>
              <input
                type="date"
                value={draft.date}
                onChange={e => setDraft(p => ({ ...p, date: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="field-label">Person</label>
              <select
                value={draft.familyMemberId}
                onChange={e => setDraft(p => ({ ...p, familyMemberId: e.target.value }))}
              >
                {familyMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Start + End time */}
          <div className="flex gap-3">
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="field-label">Start Time</label>
              <input
                type="time"
                value={draft.startTime}
                onChange={e => setDraft(p => ({ ...p, startTime: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="field-label">End Time</label>
              <input
                type="time"
                value={draft.endTime}
                onChange={e => setDraft(p => ({ ...p, endTime: e.target.value }))}
              />
            </div>
          </div>

          {/* Calendar type */}
          <div className="flex flex-col gap-1.5">
            <label className="field-label">Calendar</label>
            <select
              value={draft.calendarType}
              onChange={e => setDraft(p => ({ ...p, calendarType: e.target.value as CalendarType }))}
            >
              {CAL_TYPES.map(ct => (
                <option key={ct.id} value={ct.id}>{ct.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Actions */}
        <div
          className="flex justify-end gap-2.5 px-6 py-4"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-[8px] text-sm font-medium cursor-pointer border transition-all duration-150"
            style={{
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              color: 'var(--text-dim)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--surface3)'
              e.currentTarget.style.color = 'var(--text)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'var(--surface2)'
              e.currentTarget.style.color = 'var(--text-dim)'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2.5 rounded-[8px] text-sm font-semibold text-white cursor-pointer border-none transition-all duration-150"
            style={{
              background: 'var(--accent)',
              boxShadow: '0 4px 12px rgba(108,140,255,0.3)',
            }}
            onMouseEnter={e =>
              (e.currentTarget.style.boxShadow = '0 6px 20px rgba(108,140,255,0.4)')
            }
            onMouseLeave={e =>
              (e.currentTarget.style.boxShadow = '0 4px 12px rgba(108,140,255,0.3)')
            }
          >
            Save Event
          </button>
        </div>
      </div>
    </div>
  )
}
