'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Clock } from './Clock'
import { WeatherWidget } from './WeatherWidget'
import { formatMonthYear } from '@/lib/utils'
import type { CalendarView, FamilyMemberUI } from '@/lib/calendar/types'

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
  // Filter props (optional — omit when no accounts connected)
  familyMembers?: FamilyMemberUI[]
  calTypes?: { id: string; name: string; enabled: boolean }[]
  onToggleMember?: (id: string) => void
  onToggleCalType?: (id: string) => void
  onOpenListsDrawer?: () => void
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
  familyMembers,
  calTypes,
  onToggleMember,
  onToggleCalType,
  onOpenListsDrawer,
}: TopBarProps) {
  return (
    <header
      className="flex-shrink-0 z-10"
      style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
    >
      {/* ── Desktop layout (md and up) ── */}
      <div
        className="hidden md:grid items-center px-6 py-3"
        style={{ gridTemplateColumns: '1fr auto 1fr' }}
      >
        {/* Col 1 — left: logo + nav */}
        <div className="flex items-center gap-4">
          <div className="font-bold text-xl tracking-tight" style={{ color: 'var(--accent)' }}>
            FamilyHub{' '}
            <span className="font-normal" style={{ color: 'var(--text-dim)' }}>
              Calendar
            </span>
          </div>

          <div className="flex items-center gap-2">
            <NavButton onClick={onPrev} label="‹" />
            <h2 className="text-[22px] font-semibold min-w-[200px] text-center tracking-tight">
              {formatMonthYear(currentDate)}
            </h2>
            <NavButton onClick={onNext} label="›" />
            <TodayButton onClick={onToday} />
          </div>
        </div>

        {/* Col 2 — center: ambient info */}
        <div className="flex items-center gap-3 justify-center">
          <WeatherWidget />
          <Clock />
        </div>

        {/* Col 3 — right: member chips + filters + search + views + add */}
        <div className="flex items-center gap-2 justify-end">
          {/* Family member chips */}
          {familyMembers && familyMembers.length > 0 && onToggleMember && (
            <div className="flex items-center gap-1.5">
              {familyMembers.map(m => (
                <MemberChip key={m.id} member={m} onToggle={onToggleMember} />
              ))}
            </div>
          )}

          {/* Filters dropdown (calendar types) */}
          {calTypes && onToggleCalType && (
            <FiltersDropdown calTypes={calTypes} onToggleCalType={onToggleCalType} />
          )}

          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="text-[13px] px-3 py-[7px] rounded-[8px] transition-all duration-200"
            style={{
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              outline: 'none',
              width: 150,
            }}
            onFocus={e => {
              e.currentTarget.style.borderColor = 'var(--accent)'
              e.currentTarget.style.width = '200px'
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.width = '150px'
            }}
          />

          <ViewToggle views={DESKTOP_VIEWS} view={view} onViewChange={onViewChange} />

          <AddEventButton onClick={onAddEvent} label="＋ Add Event" />

          <SettingsLink />
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

        {/* Row 2: Today | view tabs | + Add | Lists | settings */}
        <div className="flex items-center justify-between px-4 pb-2 gap-2">
          <TodayButton onClick={onToday} />
          <ViewToggle views={ALL_VIEWS} view={view} onViewChange={onViewChange} />
          <div className="flex items-center gap-2">
            {onOpenListsDrawer && (
              <button
                onClick={onOpenListsDrawer}
                title="Lists"
                className="w-9 h-9 flex items-center justify-center rounded-[8px] text-base cursor-pointer transition-all duration-150"
                style={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-dim)',
                }}
              >
                ☰
              </button>
            )}
            <AddEventButton onClick={onAddEvent} label="＋" />
            <SettingsLink />
          </div>
        </div>

        {/* Row 3: family member chips (compact, scrollable) */}
        {familyMembers && familyMembers.length > 0 && onToggleMember && (
          <div
            className="flex items-center gap-2 px-4 pb-2 overflow-x-auto"
            style={{ scrollbarWidth: 'none' }}
          >
            {familyMembers.map(m => (
              <MemberChip key={m.id} member={m} onToggle={onToggleMember} compact />
            ))}
            {calTypes && onToggleCalType && (
              <FiltersDropdown calTypes={calTypes} onToggleCalType={onToggleCalType} compact />
            )}
          </div>
        )}
      </div>
    </header>
  )
}

/* ── Member chip ── */

function MemberChip({
  member,
  onToggle,
  compact = false,
}: {
  member: FamilyMemberUI
  onToggle: (id: string) => void
  compact?: boolean
}) {
  return (
    <button
      onClick={() => onToggle(member.id)}
      title={member.name}
      className="flex items-center gap-1.5 rounded-full transition-all duration-150 cursor-pointer flex-shrink-0"
      style={{
        padding: compact ? '3px 8px 3px 6px' : '4px 10px 4px 8px',
        background: member.enabled ? 'var(--surface2)' : 'transparent',
        border: `1px solid ${member.enabled ? member.color + '60' : 'var(--border)'}`,
        opacity: member.enabled ? 1 : 0.45,
      }}
    >
      <span
        style={{
          width: compact ? 8 : 10,
          height: compact ? 8 : 10,
          borderRadius: '50%',
          background: member.enabled ? member.color : 'var(--text-faint)',
          flexShrink: 0,
          display: 'inline-block',
        }}
      />
      {!compact && (
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: member.enabled ? 'var(--text)' : 'var(--text-dim)',
            whiteSpace: 'nowrap',
          }}
        >
          {member.name}
        </span>
      )}
    </button>
  )
}

/* ── Filters dropdown ── */

function FiltersDropdown({
  calTypes,
  onToggleCalType,
  compact = false,
}: {
  calTypes: { id: string; name: string; enabled: boolean }[]
  onToggleCalType: (id: string) => void
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const anyDisabled = calTypes.some(ct => !ct.enabled)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 rounded-[8px] text-[12px] font-medium cursor-pointer transition-all duration-150 flex-shrink-0"
        style={{
          padding: compact ? '4px 8px' : '5px 10px',
          background: open || anyDisabled ? 'var(--accent-glow)' : 'var(--surface2)',
          border: `1px solid ${open || anyDisabled ? 'var(--accent)' : 'var(--border)'}`,
          color: open || anyDisabled ? 'var(--accent)' : 'var(--text-dim)',
        }}
      >
        <span>Filters</span>
        {anyDisabled && (
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--accent)',
              display: 'inline-block',
            }}
          />
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            minWidth: 180,
            zIndex: 50,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '8px 12px 6px',
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--text-faint)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              borderBottom: '1px solid var(--border)',
            }}
          >
            Calendar Type
          </div>
          {calTypes.map(ct => (
            <button
              key={ct.id}
              onClick={() => onToggleCalType(ct.id)}
              className="flex items-center gap-2.5 w-full text-left cursor-pointer transition-colors duration-100"
              style={{
                padding: '8px 12px',
                background: 'transparent',
                border: 'none',
                color: ct.enabled ? 'var(--text)' : 'var(--text-dim)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 4,
                  background: ct.enabled ? 'var(--accent)' : 'transparent',
                  border: ct.enabled ? '2px solid var(--accent)' : '2px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: 9,
                  color: '#fff',
                }}
              >
                {ct.enabled && '✓'}
              </span>
              <span style={{ fontSize: 13 }}>{ct.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Shared sub-components ── */

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
