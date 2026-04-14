'use client'

import Link from 'next/link'
import { Clock } from './Clock'
import { WeatherWidget } from './WeatherWidget'
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
  searchQuery: string
  onSearchChange: (q: string) => void
}

// Desktop hides Day view (it lives in the sidebar); mobile keeps all three
const DESKTOP_VIEWS: { id: CalendarView; label: string }[] = [
  { id: 'month', label: 'Month' },
  { id: 'week', label: 'Week' },
]
const ALL_VIEWS: { id: CalendarView; label: string }[] = [
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
  searchQuery,
  onSearchChange,
}: TopBarProps) {
  return (
    <header
      className="flex-shrink-0 z-10"
      style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
    >
      {/* ── Desktop layout (md and up) ── */}
      <div className="hidden md:flex items-center justify-between px-6 py-3">
        {/* Left: logo + nav */}
        <div className="flex items-center gap-4">
          <div className="font-bold text-xl tracking-tight" style={{ color: 'var(--accent)' }}>
            FamilyHub{' '}
            <span className="font-normal" style={{ color: 'var(--text-dim)' }}>
              Calendar
            </span>
          </div>

          <div className="flex items-center gap-2">
            <NavButton onClick={onPrev} label="‹" />
            <h2 className="text-[22px] font-semibold min-w-[220px] text-center tracking-tight">
              {formatMonthYear(currentDate)}
            </h2>
            <NavButton onClick={onNext} label="›" />
            <TodayButton onClick={onToday} />
          </div>
        </div>

        {/* Right: search + view toggle + add + clock */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="text-[13px] px-3 py-[7px] rounded-[8px] w-[180px] focus:w-[240px] transition-all duration-200"
            style={{
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              outline: 'none',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          />

          <ViewToggle views={DESKTOP_VIEWS} view={view} onViewChange={onViewChange} />

          <AddEventButton onClick={onAddEvent} label="＋ Add Event" />

          <SettingsLink />

          <WeatherWidget />
          <Clock />
        </div>
      </div>

      {/* ── Mobile layout (below md) ── */}
      <div className="flex flex-col md:hidden">
        {/* Row 1: logo | nav arrows + date */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <div className="font-bold text-base tracking-tight" style={{ color: 'var(--accent)' }}>
            FamilyHub{' '}
            <span className="font-normal" style={{ color: 'var(--text-dim)' }}>
              Calendar
            </span>
          </div>
          <div className="flex items-center gap-2">
            <NavButton onClick={onPrev} label="‹" />
            <h2
              className="text-[16px] font-semibold tracking-tight text-center"
              style={{ minWidth: 130 }}
            >
              {formatMonthYear(currentDate)}
            </h2>
            <NavButton onClick={onNext} label="›" />
          </div>
        </div>

        {/* Row 2: Today | view tabs | + Add | settings */}
        <div className="flex items-center justify-between px-4 pb-2 gap-2">
          <TodayButton onClick={onToday} />
          <ViewToggle views={ALL_VIEWS} view={view} onViewChange={onViewChange} />
          <div className="flex items-center gap-2">
            <AddEventButton onClick={onAddEvent} label="＋" />
            <SettingsLink />
          </div>
        </div>
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

function TodayButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
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
  )
}

function ViewToggle({
  views,
  view,
  onViewChange,
}: {
  views: { id: CalendarView; label: string }[]
  view: CalendarView
  onViewChange: (v: CalendarView) => void
}) {
  return (
    <div
      className="flex rounded-[8px] overflow-hidden"
      style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
    >
      {views.map(v => (
        <button
          key={v.id}
          onClick={() => onViewChange(v.id)}
          className="px-[14px] py-[7px] text-[13px] font-medium border-none cursor-pointer transition-all duration-150"
          style={{
            background: view === v.id ? 'var(--accent)' : 'transparent',
            color: view === v.id ? '#fff' : 'var(--text-dim)',
          }}
        >
          {v.label}
        </button>
      ))}
    </div>
  )
}

function AddEventButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-4 py-2 rounded-[8px] text-sm font-semibold text-white border-none cursor-pointer transition-all duration-150 whitespace-nowrap"
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
      {label}
    </button>
  )
}

function SettingsLink() {
  return (
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
  )
}
