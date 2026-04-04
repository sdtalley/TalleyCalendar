'use client'

import Link from 'next/link'
import { Clock } from './Clock'
import { formatMonthYear } from '@/lib/utils'
import type { CalendarView } from '@/lib/calendar/types'

interface TopBarProps {
  currentDate: Date
  view: CalendarView
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onViewChange: (v: CalendarView) => void
  onAddEvent: () => void
}

const VIEWS: { id: CalendarView; label: string }[] = [
  { id: 'month', label: 'Month' },
  { id: 'week', label: 'Week' },
  { id: 'day', label: 'Day' },
]

export function TopBar({
  currentDate,
  view,
  onPrev,
  onNext,
  onToday,
  onViewChange,
  onAddEvent,
}: TopBarProps) {
  return (
    <header
      className="flex items-center justify-between px-6 py-3 flex-shrink-0 z-10"
      style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Left: logo + nav */}
      <div className="flex items-center gap-4">
        <div
          className="font-bold text-xl tracking-tight"
          style={{ color: 'var(--accent)' }}
        >
          FamilyHub{' '}
          <span className="font-normal" style={{ color: 'var(--text-dim)' }}>
            Calendar
          </span>
        </div>

        <div className="flex items-center gap-2">
          <NavButton onClick={onPrev} label="‹" />
          <h2
            className="text-[22px] font-semibold min-w-[220px] text-center tracking-tight"
          >
            {formatMonthYear(currentDate)}
          </h2>
          <NavButton onClick={onNext} label="›" />

          <button
            onClick={onToday}
            className="px-4 py-1.5 rounded-[8px] text-sm font-semibold transition-all duration-150 cursor-pointer"
            style={{
              background: 'var(--accent-glow)',
              border: '1px solid var(--accent)',
              color: 'var(--accent)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--accent)'
              e.currentTarget.style.color = '#fff'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'var(--accent-glow)'
              e.currentTarget.style.color = 'var(--accent)'
            }}
          >
            Today
          </button>
        </div>
      </div>

      {/* Right: view toggle + add + clock */}
      <div className="flex items-center gap-3">
        <div
          className="flex rounded-[8px] overflow-hidden"
          style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
        >
          {VIEWS.map(v => (
            <button
              key={v.id}
              onClick={() => onViewChange(v.id)}
              className="px-[18px] py-[7px] text-[13px] font-medium border-none cursor-pointer transition-all duration-150"
              style={{
                background: view === v.id ? 'var(--accent)' : 'transparent',
                color: view === v.id ? '#fff' : 'var(--text-dim)',
              }}
            >
              {v.label}
            </button>
          ))}
        </div>

        <button
          onClick={onAddEvent}
          className="flex items-center gap-1.5 px-5 py-2 rounded-[8px] text-sm font-semibold text-white border-none cursor-pointer transition-all duration-150"
          style={{
            background: 'var(--accent)',
            boxShadow: '0 4px 16px rgba(108,140,255,0.3)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-1px)'
            e.currentTarget.style.boxShadow = '0 6px 24px rgba(108,140,255,0.4)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = ''
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(108,140,255,0.3)'
          }}
        >
          ＋ Add Event
        </button>

        <Link
          href="/settings"
          className="w-9 h-9 flex items-center justify-center rounded-[8px] text-lg cursor-pointer transition-all duration-150 no-underline"
          style={{
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            color: 'var(--text-dim)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'var(--surface3)'
            e.currentTarget.style.borderColor = 'var(--accent)'
            e.currentTarget.style.color = 'var(--text)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'var(--surface2)'
            e.currentTarget.style.borderColor = 'var(--border)'
            e.currentTarget.style.color = 'var(--text-dim)'
          }}
          title="Settings"
        >
          ⚙
        </Link>

        <Clock />
      </div>
    </header>
  )
}

function NavButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="w-9 h-9 flex items-center justify-center rounded-[8px] text-lg cursor-pointer transition-all duration-150"
      style={{
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        color: 'var(--text)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'var(--surface3)'
        e.currentTarget.style.borderColor = 'var(--accent)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'var(--surface2)'
        e.currentTarget.style.borderColor = 'var(--border)'
      }}
    >
      {label}
    </button>
  )
}
