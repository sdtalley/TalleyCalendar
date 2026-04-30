'use client'

import { useEffect, useRef, useState } from 'react'
import { InfoBar } from '@/components/layout/InfoBar'
import { MonthView } from '@/components/calendar/MonthView'
import { WeekView } from '@/components/calendar/WeekView'
import { DayView } from '@/components/calendar/DayView'
import { CalendarWeekView } from '@/components/calendar/CalendarWeekView'
import { EventModal } from '@/components/calendar/EventModal'
import { EventDetailModal } from '@/components/calendar/EventDetailModal'
import { MobileDayDrawer } from '@/components/calendar/MobileDayDrawer'
import { useCalendarNavigation } from '@/hooks/useCalendarNavigation'
import { useEventFilters } from '@/hooks/useEventFilters'
import { useCalendarEvents } from '@/hooks/useCalendarEvents'
import { generateSampleEvents, DEFAULT_FAMILY_MEMBERS } from '@/lib/sampleData'
import { formatMonthYear, getWeekDates } from '@/lib/utils'
import type { CalendarEvent, FamilyMember, FamilyMemberUI, NewEventDraft, CalendarView } from '@/lib/calendar/types'

function getMemberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return (parts[0][0] ?? '?').toUpperCase()
  return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase()
}

function getMemberAvatarContent(member: FamilyMember): string {
  if (member.avatar?.type === 'emoji') return member.avatar.value
  if (member.avatar?.type === 'initials' && member.avatar.value) return member.avatar.value
  return getMemberInitials(member.name)
}

function formatScheduleRange(currentDate: Date, numDays: number, snapToWeek = true): string {
  const dates = snapToWeek
    ? getWeekDates(currentDate).slice(0, numDays)
    : Array.from({ length: numDays }, (_, i) => {
        const d = new Date(currentDate)
        d.setDate(d.getDate() + i)
        return d
      })
  const first = dates[0]
  const last = dates[dates.length - 1]
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (numDays === 1) return first.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  if (first.getMonth() === last.getMonth()) return `${fmt(first)} – ${last.getDate()}`
  return `${fmt(first)} – ${fmt(last)}`
}

const VIEWS: { id: CalendarView; label: string }[] = [
  { id: 'month', label: 'Month' },
  { id: 'week', label: 'Week' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'day', label: 'Day' },
]

// ── CalendarTab ────────────────────────────────────────────────────────────

export function CalendarTab() {
  const [scheduleDays, setScheduleDays] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('calendar-schedule-days')
      const n = stored ? parseInt(stored, 10) : NaN
      return n >= 1 && n <= 7 ? n : 7
    } catch { return 7 }
  })

  const handleScheduleDaysChange = (n: number) => {
    try { localStorage.setItem('calendar-schedule-days', String(n)) } catch { /* ignore */ }
    setScheduleDays(n)
  }
  const { currentDate, selectedDate, view, goToday, goPrev, goNext, selectDate, changeView } =
    useCalendarNavigation(scheduleDays)

  const { events: liveEvents, members: liveMembers, loading, backgroundLoading, error: calError } =
    useCalendarEvents(currentDate)

  const [sampleEvents] = useState<CalendarEvent[]>(() => generateSampleEvents())
  const [localEvents, setLocalEvents] = useState<CalendarEvent[]>([])
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => new Set())
  const [rescheduleOverrides, setRescheduleOverrides] = useState<Map<string, { start: Date; end: Date }>>(
    () => new Map()
  )
  const [writeError, setWriteError] = useState<string | null>(null)
  const writeErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hasRealSetup = liveMembers.length > 0
  const baseEvents = hasRealSetup
    ? [...liveEvents, ...localEvents]
    : [...sampleEvents, ...localEvents]

  const uiMembers: FamilyMemberUI[] = hasRealSetup
    ? liveMembers.map(m => ({ ...m, enabled: true }))
    : DEFAULT_FAMILY_MEMBERS

  const { familyMembers, calTypes, visibleEvents, toggleMember, toggleCalType } =
    useEventFilters(baseEvents, uiMembers)

  const [modalOpen, setModalOpen] = useState(false)
  const [modalInitialDate, setModalInitialDate] = useState<Date | undefined>()
  const [dragTimeRange, setDragTimeRange] = useState<{ startTime: string; endTime: string } | null>(null)
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null)
  const [pendingMonthReschedule, setPendingMonthReschedule] = useState<CalendarEvent | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [dayPopup, setDayPopup] = useState<{ date: Date; rect: DOMRect } | null>(null)
  const touchStartX = useRef<number>(0)
  const touchStartY = useRef<number>(0)

  const visibleWithOverrides = visibleEvents
    .filter(e => !deletedIds.has(e.id))
    .map(e => {
      const override = rescheduleOverrides.get(e.id)
      return override ? { ...e, ...override } : e
    })

  const displayEvents = searchQuery.trim()
    ? visibleWithOverrides.filter(e => {
        const q = searchQuery.toLowerCase()
        return (
          e.title.toLowerCase().includes(q) ||
          (e.location?.toLowerCase().includes(q) ?? false) ||
          (e.description?.toLowerCase().includes(q) ?? false)
        )
      })
    : visibleWithOverrides

  function showWriteError(msg: string) {
    setWriteError(msg)
    if (writeErrorTimer.current) clearTimeout(writeErrorTimer.current)
    writeErrorTimer.current = setTimeout(() => setWriteError(null), 5000)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) {
        if (e.key === 'Escape') (e.target as HTMLElement).blur()
        return
      }
      switch (e.key) {
        case 'ArrowLeft':  goPrev(); break
        case 'ArrowRight': goNext(); break
        case 't': case 'T': goToday(); break
        case 'n': case 'N': setModalOpen(true); break
        case 'm': changeView('month'); break
        case 'w': changeView('week'); break
        case 's': changeView('schedule'); break
        case 'd': changeView('day'); break
        case '/': {
          e.preventDefault()
          document.querySelector<HTMLInputElement>('[data-search-input]')?.focus()
          break
        }
        case 'Escape': setSearchQuery(''); break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goPrev, goNext, goToday, changeView])

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleSelectDate(date: Date) {
    selectDate(date)
    setMobileDrawerOpen(true)
  }

  function handleMonthDayClick(date: Date, rect: DOMRect) {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      selectDate(date)
      setMobileDrawerOpen(true)
    } else {
      setDayPopup({ date, rect })
    }
  }

  function handleAddEvent() {
    setModalInitialDate(selectedDate)
    setDragTimeRange(null)
    setModalOpen(true)
  }

  function handleAddEventOnDate(date: Date) {
    setModalInitialDate(date)
    setDragTimeRange(null)
    setModalOpen(true)
  }

  function handleMonthReschedule(event: CalendarEvent, newDate: Date) {
    setPendingMonthReschedule(event)
    setModalInitialDate(newDate)
    setDragTimeRange({
      startTime: `${String(event.start.getHours()).padStart(2, '0')}:${String(event.start.getMinutes()).padStart(2, '0')}`,
      endTime:   `${String(event.end.getHours()).padStart(2, '0')}:${String(event.end.getMinutes()).padStart(2, '0')}`,
    })
    setModalOpen(true)
  }

  async function handleSaveEvent(draft: NewEventDraft) {
    const member = familyMembers.find(m => m.id === draft.familyMemberId)
    if (!member) return

    if (pendingMonthReschedule) {
      const ev = pendingMonthReschedule
      setPendingMonthReschedule(null)
      const [sh, sm] = draft.startTime.split(':').map(Number)
      const [eh, em] = draft.endTime.split(':').map(Number)
      const [yr, mo, dy] = draft.date.split('-').map(Number)
      const newStart = new Date(yr, mo - 1, dy, sh, sm)
      const newEnd = new Date(yr, mo - 1, dy, eh, em)
      setRescheduleOverrides(prev => new Map(prev).set(ev.id, { start: newStart, end: newEnd }))
      if (ev.externalId) {
        try {
          const res = await fetch(`/api/events/${encodeURIComponent(ev.id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              accountId: ev.accountId,
              calendarId: ev.source.calendarId,
              externalId: ev.externalId,
              start: newStart.toISOString(),
              end: newEnd.toISOString(),
            }),
          })
          if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            showWriteError(data.error ?? 'Failed to move event')
            setRescheduleOverrides(prev => { const n = new Map(prev); n.delete(ev.id); return n })
          }
        } catch {
          showWriteError('Failed to reach server — event not moved')
          setRescheduleOverrides(prev => { const n = new Map(prev); n.delete(ev.id); return n })
        }
      }
      return
    }

    const [sh, sm] = draft.startTime.split(':').map(Number)
    const [eh, em] = draft.endTime.split(':').map(Number)
    const [yr, mo, dy] = draft.date.split('-').map(Number)
    const start = new Date(yr, mo - 1, dy, sh, sm)
    const end = new Date(yr, mo - 1, dy, eh, em)
    const optimisticId = `local-${Date.now()}`
    const optimisticEvent: CalendarEvent = {
      id: optimisticId,
      provider: 'local',
      accountId: 'local',
      title: draft.title,
      start,
      end,
      allDay: false,
      recurring: false,
      familyMemberId: draft.familyMemberId,
      calendarType: draft.calendarType,
      color: member.color,
      source: { calendarId: 'local', calendarName: 'Local', provider: 'local' },
    }
    setLocalEvents(prev => [...prev, optimisticEvent])

    if (!hasRealSetup) return

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        showWriteError(data.error ?? 'Failed to save event to calendar')
        setLocalEvents(prev => prev.filter(e => e.id !== optimisticId))
      }
    } catch {
      showWriteError('Failed to reach server — event not saved')
      setLocalEvents(prev => prev.filter(e => e.id !== optimisticId))
    }
  }

  async function handleDeleteEvent(event: CalendarEvent) {
    if (!event.externalId) return
    setDeletedIds(prev => new Set(Array.from(prev).concat(event.id)))
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(event.id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: event.accountId,
          calendarId: event.source.calendarId,
          externalId: event.externalId,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        showWriteError(data.error ?? 'Failed to delete event')
        setDeletedIds(prev => { const n = new Set(prev); n.delete(event.id); return n })
      }
    } catch {
      showWriteError('Failed to reach server — event not deleted')
      setDeletedIds(prev => { const n = new Set(prev); n.delete(event.id); return n })
    }
  }

  async function handleRescheduleEvent(event: CalendarEvent, newDate: Date, newStartMinutes: number) {
    if (!event.externalId) return
    const durationMs = event.end.getTime() - event.start.getTime()
    const newStart = new Date(newDate)
    newStart.setHours(Math.floor(newStartMinutes / 60), newStartMinutes % 60, 0, 0)
    const newEnd = new Date(newStart.getTime() + durationMs)
    setRescheduleOverrides(prev => new Map(prev).set(event.id, { start: newStart, end: newEnd }))
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(event.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: event.accountId,
          calendarId: event.source.calendarId,
          externalId: event.externalId,
          start: newStart.toISOString(),
          end: newEnd.toISOString(),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        showWriteError(data.error ?? 'Failed to reschedule event')
        setRescheduleOverrides(prev => { const n = new Map(prev); n.delete(event.id); return n })
      }
    } catch {
      showWriteError('Failed to reach server — event not rescheduled')
      setRescheduleOverrides(prev => { const n = new Map(prev); n.delete(event.id); return n })
    }
  }

  const anyFilterOff =
    familyMembers.some(m => !m.enabled) || calTypes.some(ct => !ct.enabled)

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current)
    if (Math.abs(dx) > 60 && Math.abs(dx) > dy * 1.5) {
      dx < 0 ? goNext() : goPrev()
    }
  }

  // ── Date label ─────────────────────────────────────────────────────────────

  const dateLabel =
    view === 'day'      ? currentDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) :
    view === 'week'     ? formatScheduleRange(currentDate, 7) :
    view === 'schedule' ? formatScheduleRange(currentDate, scheduleDays, false) :
                          formatMonthYear(currentDate)

  // ── Render ─────────────────────────────────────────────────────────────────

  // ── InfoBar right slot (desktop calendar controls) ─────────────────────────
  // [dateLabel] [spacer] [View ▾] [DayCount?] [⊞ Filter] [‹] [Today] [›] [🔍]
  // Dropdowns use zIndex:9999 to escape the calendar stacking context below.

  const calendarRightSlot = (
    <>
      {/* Current date / range — left portion of the right slot */}
      <span
        className="text-[13px] font-semibold flex-shrink-0 select-none"
        style={{ color: 'var(--text)' }}
      >
        {dateLabel}
      </span>
      <div className="flex-1" />

      <ViewDropdown views={VIEWS} view={view} onViewChange={changeView} />
      {view === 'schedule' && (
        <DayCountPicker value={scheduleDays} onChange={handleScheduleDaysChange} />
      )}

      {/* Filter panel — profiles + calendar types inside */}
      <FiltersDropdown
        familyMembers={hasRealSetup ? familyMembers : []}
        calTypes={calTypes}
        anyFilterOff={anyFilterOff}
        onToggleMember={toggleMember}
        onToggleCalType={toggleCalType}
      />
      <NavButton onClick={goPrev} label="‹" />
      <TodayButton onClick={goToday} />
      <NavButton onClick={goNext} label="›" />
      <SearchChip value={searchQuery} onChange={setSearchQuery} />
    </>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* InfoBar — one combined bar (date/time/weather + calendar controls) */}
      <InfoBar rightSlot={calendarRightSlot} />

      {/* Mobile sub-nav — compact controls shown only on mobile */}
      <div
        className="flex md:hidden flex-shrink-0 items-center justify-between px-3 py-2 gap-2"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-1">
          <NavButton onClick={goPrev} label="‹" />
          <span
            className="text-[13px] font-semibold text-center select-none"
            style={{ minWidth: 110, color: 'var(--text)' }}
          >
            {dateLabel}
          </span>
          <NavButton onClick={goNext} label="›" />
        </div>
        <div className="flex items-center gap-1.5">
          <TodayButton onClick={goToday} />
          <ViewDropdown views={VIEWS} view={view} onViewChange={changeView} compact />
          {familyMembers.length > 0 && (
            <button
              onClick={() => setMobileFiltersOpen(true)}
              className="w-8 h-8 flex items-center justify-center rounded-[7px] text-sm cursor-pointer transition-all duration-150 border-none"
              style={{
                background: anyFilterOff ? 'var(--accent-glow)' : 'var(--surface2)',
                border: `1px solid ${anyFilterOff ? 'var(--accent)' : 'var(--border)'}`,
                color: anyFilterOff ? 'var(--accent)' : 'var(--text-dim)',
              }}
            >
              ⊞
            </button>
          )}
          <AddEventButton onClick={handleAddEvent} compact />
        </div>
      </div>


      {/* Error banners */}
      {calError && (
        <div className="px-4 py-2 text-xs text-center flex-shrink-0" style={{ background: 'rgba(255,107,107,0.1)', color: '#ff6b6b' }}>
          {calError}
        </div>
      )}
      {writeError && (
        <div className="px-4 py-2 text-xs flex items-center justify-between flex-shrink-0" style={{ background: 'rgba(255,107,107,0.1)', color: '#ff6b6b' }}>
          <span>{writeError}</span>
          <button
            onClick={() => setWriteError(null)}
            style={{ background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer', padding: '0 4px' }}
          >
            ×
          </button>
        </div>
      )}

      {/* Calendar content */}
      {loading ? (
        <div className="flex items-center justify-center flex-1" style={{ color: 'var(--text-dim)' }}>
          Loading calendar...
        </div>
      ) : (
        <div
          className="flex-1 flex flex-col overflow-hidden relative"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {backgroundLoading && <div className="calendar-shimmer" />}
          {view === 'month' && (
            <MonthView
              currentDate={currentDate}
              selectedDate={selectedDate}
              events={displayEvents}
              onSelectDate={handleSelectDate}
              onDayClick={handleMonthDayClick}
              onEventClick={ev => setDetailEvent(ev)}
              onAddEventOnDate={handleAddEventOnDate}
              onMonthReschedule={handleMonthReschedule}
            />
          )}
          {view === 'week' && (
            <CalendarWeekView
              currentDate={currentDate}
              events={displayEvents}
              familyMembers={familyMembers}
              onEventClick={ev => setDetailEvent(ev)}
              onSelectDate={selectDate}
            />
          )}
          {view === 'schedule' && (
            <WeekView
              currentDate={currentDate}
              events={displayEvents}
              familyMembers={familyMembers}
              onEventClick={ev => setDetailEvent(ev)}
              onReschedule={handleRescheduleEvent}
              numDays={scheduleDays}
            />
          )}
          {view === 'day' && (
            <DayView
              currentDate={currentDate}
              events={displayEvents}
              familyMembers={familyMembers}
              onEventClick={ev => setDetailEvent(ev)}
              onSelectDate={selectDate}
              onAddEvent={handleAddEventOnDate}
            />
          )}
        </div>
      )}

      {/* Floating Action Button — bottom-right, overlays content */}
      <button
        onClick={handleAddEvent}
        className="fixed bottom-8 right-8 z-40 flex items-center justify-center rounded-full text-white border-none cursor-pointer transition-all duration-200 select-none"
        style={{
          width: 56,
          height: 56,
          fontSize: 28,
          lineHeight: 1,
          background: 'var(--accent)',
          boxShadow: '0 8px 32px rgba(108,140,255,0.45)',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
        title="Add event"
      >
        ＋
      </button>

      {/* Desktop day popup — month view day click */}
      {dayPopup && (
        <DayEventsPopup
          date={dayPopup.date}
          rect={dayPopup.rect}
          events={displayEvents}
          familyMembers={familyMembers}
          onEventClick={ev => { setDetailEvent(ev); setDayPopup(null) }}
          onAddEvent={() => { handleAddEventOnDate(dayPopup.date); setDayPopup(null) }}
          onClose={() => setDayPopup(null)}
        />
      )}

      {/* Mobile drawers */}
      <MobileDayDrawer
        open={mobileDrawerOpen}
        date={selectedDate}
        events={displayEvents}
        onClose={() => setMobileDrawerOpen(false)}
        onEventClick={ev => setDetailEvent(ev)}
      />

      {/* Mobile filters sheet */}
      {mobileFiltersOpen && (
        <MobileFiltersSheet
          familyMembers={familyMembers}
          calTypes={calTypes}
          onToggleMember={toggleMember}
          onToggleCalType={toggleCalType}
          onClose={() => setMobileFiltersOpen(false)}
        />
      )}

      {/* Modals */}
      <EventModal
        open={modalOpen}
        initialDate={modalInitialDate}
        initialStartTime={dragTimeRange?.startTime}
        initialEndTime={dragTimeRange?.endTime}
        initialTitle={pendingMonthReschedule?.title}
        initialFamilyMemberId={pendingMonthReschedule?.familyMemberId}
        initialCalendarType={pendingMonthReschedule?.calendarType}
        modalTitle={pendingMonthReschedule ? 'Move Event' : undefined}
        familyMembers={familyMembers}
        onClose={() => {
          setModalOpen(false)
          setDragTimeRange(null)
          setPendingMonthReschedule(null)
        }}
        onSave={handleSaveEvent}
      />
      <EventDetailModal
        event={detailEvent}
        familyMembers={familyMembers}
        onClose={() => setDetailEvent(null)}
        onDelete={handleDeleteEvent}
      />
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function NavButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="w-8 h-8 flex items-center justify-center rounded-[8px] text-lg cursor-pointer transition-all duration-150 border-none"
      style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface3)'; e.currentTarget.style.borderColor = 'var(--accent)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.borderColor = 'var(--border)' }}
    >
      {label}
    </button>
  )
}

function TodayButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1 rounded-[8px] text-xs font-semibold cursor-pointer transition-all duration-150 border-none"
      style={{ background: 'var(--accent-glow)', border: '1px solid var(--accent)', color: 'var(--accent)' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = '#fff' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent-glow)'; e.currentTarget.style.color = 'var(--accent)' }}
    >
      Today
    </button>
  )
}

function ViewDropdown({
  views,
  view,
  onViewChange,
  compact,
}: {
  views: { id: CalendarView; label: string }[]
  view: CalendarView
  onViewChange: (v: CalendarView) => void
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = views.find(v => v.id === view) ?? views[0]

  useEffect(() => {
    if (!open) return
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 rounded-[7px] text-[12px] font-semibold cursor-pointer transition-all duration-150 border-none whitespace-nowrap"
        style={{
          padding: compact ? '5px 8px' : '5px 10px',
          background: open ? 'var(--accent)' : 'var(--surface2)',
          border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`,
          color: open ? '#fff' : 'var(--text)',
        }}
      >
        {current.label}
        <span style={{ fontSize: 9, opacity: 0.7 }}>▾</span>
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            minWidth: 120,
            zIndex: 9999,
            overflow: 'hidden',
          }}
        >
          {views.map(v => (
            <button
              key={v.id}
              onClick={() => { onViewChange(v.id); setOpen(false) }}
              className="flex items-center justify-between w-full text-left cursor-pointer transition-colors duration-100 border-none"
              style={{
                padding: '8px 12px',
                background: view === v.id ? 'var(--accent-glow)' : 'transparent',
                color: view === v.id ? 'var(--accent)' : 'var(--text)',
                fontSize: 13,
                fontWeight: view === v.id ? 600 : 400,
              }}
              onMouseEnter={e => { if (view !== v.id) e.currentTarget.style.background = 'var(--surface2)' }}
              onMouseLeave={e => { if (view !== v.id) e.currentTarget.style.background = 'transparent' }}
            >
              {v.label}
              {view === v.id && <span style={{ fontSize: 11 }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function DayCountPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const options = [1, 2, 3, 4, 5, 7]

  useEffect(() => {
    if (!open) return
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-0.5 rounded-[7px] text-[11px] font-medium cursor-pointer transition-all duration-150 border-none whitespace-nowrap"
        style={{
          padding: '5px 7px',
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          color: 'var(--text-dim)',
        }}
      >
        {value}d
        <span style={{ fontSize: 9, opacity: 0.7 }}>▾</span>
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            minWidth: 80,
            zIndex: 9999,
            overflow: 'hidden',
          }}
        >
          {options.map(n => (
            <button
              key={n}
              onClick={() => { onChange(n); setOpen(false) }}
              className="flex items-center justify-between w-full text-left cursor-pointer transition-colors duration-100 border-none"
              style={{
                padding: '7px 12px',
                background: value === n ? 'var(--accent-glow)' : 'transparent',
                color: value === n ? 'var(--accent)' : 'var(--text)',
                fontSize: 13,
                fontWeight: value === n ? 600 : 400,
              }}
              onMouseEnter={e => { if (value !== n) e.currentTarget.style.background = 'var(--surface2)' }}
              onMouseLeave={e => { if (value !== n) e.currentTarget.style.background = 'transparent' }}
            >
              {n} day{n !== 1 ? 's' : ''}
              {value === n && <span style={{ fontSize: 11 }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function AddEventButton({ onClick, compact }: { onClick: () => void; compact?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 rounded-[8px] text-sm font-semibold text-white border-none cursor-pointer transition-all duration-150 whitespace-nowrap"
      style={{
        padding: compact ? '6px 10px' : '6px 14px',
        background: 'var(--accent)',
        boxShadow: '0 4px 16px rgba(108,140,255,0.3)',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(108,140,255,0.4)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 16px rgba(108,140,255,0.3)' }}
    >
      {compact ? '＋' : '＋ Add Event'}
    </button>
  )
}

// ── FiltersDropdown ────────────────────────────────────────────────────────
// Combined filter panel: profile chips + calendar-type chips

function FiltersDropdown({
  familyMembers,
  calTypes,
  anyFilterOff,
  onToggleMember,
  onToggleCalType,
}: {
  familyMembers: FamilyMemberUI[]
  calTypes: { id: string; name: string; enabled: boolean }[]
  anyFilterOff: boolean
  onToggleMember: (id: string) => void
  onToggleCalType: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const allMembersOn = familyMembers.length === 0 || familyMembers.every(m => m.enabled)

  useEffect(() => {
    if (!open) return
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  function handleSelectAll() {
    if (allMembersOn) {
      familyMembers.filter(m => m.enabled).forEach(m => onToggleMember(m.id))
    } else {
      familyMembers.filter(m => !m.enabled).forEach(m => onToggleMember(m.id))
    }
  }

  const hasContent = familyMembers.length > 0 || calTypes.length > 0

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 rounded-[8px] text-[12px] font-medium cursor-pointer transition-all duration-150 border-none whitespace-nowrap"
        style={{
          padding: '5px 10px',
          background: open || anyFilterOff ? 'var(--accent-glow)' : 'var(--surface2)',
          border: `1px solid ${open || anyFilterOff ? 'var(--accent)' : 'var(--border)'}`,
          color: open || anyFilterOff ? 'var(--accent)' : 'var(--text-dim)',
        }}
      >
        ⊞ Filter
        {anyFilterOff && (
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
        )}
      </button>
      {open && hasContent && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          minWidth: 240, zIndex: 9999,
        }}>
          {familyMembers.length > 0 && (
            <div style={{ padding: '12px 14px', borderBottom: calTypes.length > 0 ? '1px solid var(--border)' : undefined }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Profiles
                </span>
                <button
                  onClick={handleSelectAll}
                  className="cursor-pointer border-none text-[11px] font-medium"
                  style={{ background: 'none', color: 'var(--accent)', padding: '0 2px' }}
                >
                  {allMembersOn ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {familyMembers.map(m => {
                  const avatarContent = getMemberAvatarContent(m)
                  const isEmoji = m.avatar?.type === 'emoji'
                  return (
                    <button
                      key={m.id}
                      onClick={() => onToggleMember(m.id)}
                      className="flex items-center gap-1.5 cursor-pointer border-none transition-all duration-150"
                      style={{
                        padding: '4px 10px 4px 4px',
                        borderRadius: 20,
                        background: m.enabled ? `${m.color}22` : 'var(--surface2)',
                        border: `1px solid ${m.enabled ? m.color + '80' : 'var(--border)'}`,
                        opacity: m.enabled ? 1 : 0.55,
                      }}
                    >
                      <span style={{
                        width: 22, height: 22, borderRadius: '50%', background: m.color, color: '#fff',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: isEmoji ? 11 : 9, fontWeight: 700, flexShrink: 0,
                      }}>
                        {avatarContent}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 500, color: m.enabled ? 'var(--text)' : 'var(--text-dim)' }}>
                        {m.name}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          {calTypes.length > 0 && (
            <div style={{ padding: '12px 14px' }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Calendar Type
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {calTypes.map(ct => (
                  <button
                    key={ct.id}
                    onClick={() => onToggleCalType(ct.id)}
                    className="cursor-pointer border-none transition-all duration-150 text-[12px] font-medium"
                    style={{
                      padding: '5px 12px',
                      borderRadius: 20,
                      background: ct.enabled ? 'var(--accent-glow)' : 'var(--surface2)',
                      border: `1px solid ${ct.enabled ? 'var(--accent)' : 'var(--border)'}`,
                      color: ct.enabled ? 'var(--accent)' : 'var(--text-dim)',
                      opacity: ct.enabled ? 1 : 0.55,
                    }}
                  >
                    {ct.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── DayEventsPopup ─────────────────────────────────────────────────────────

function DayEventsPopup({
  date, rect, events, familyMembers, onEventClick, onAddEvent, onClose,
}: {
  date: Date
  rect: DOMRect
  events: CalendarEvent[]
  familyMembers: FamilyMemberUI[]
  onEventClick: (ev: CalendarEvent) => void
  onAddEvent: () => void
  onClose: () => void
}) {
  const POPUP_W = 290
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
  const dayEvents = events
    .filter(e => e.allDay
      ? (e.start < dayEnd && e.end > dayStart)
      : (e.start < dayEnd && e.end > dayStart))
    .sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
      return a.start.getTime() - b.start.getTime()
    })

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800

  let left = rect.right + 8
  if (left + POPUP_W > vw - 12) left = rect.left - POPUP_W - 8
  if (left < 12) left = 12

  let top = rect.top
  const MAX_H = Math.min(460, vh * 0.7)
  if (top + MAX_H > vh - 12) top = Math.max(12, vh - MAX_H - 12)

  const headerDate = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 flex flex-col overflow-hidden"
        style={{
          left, top, width: POPUP_W, maxHeight: MAX_H,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-4 pt-3 pb-2 flex-shrink-0"
             style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <div className="font-bold text-[14px]" style={{ color: 'var(--text)' }}>{headerDate}</div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-dim)' }}>
              {dayEvents.length === 0 ? 'No events' : `${dayEvents.length} event${dayEvents.length !== 1 ? 's' : ''}`}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onAddEvent}
              className="text-[11px] font-semibold border-none cursor-pointer px-2.5 py-1 rounded-[7px]"
              style={{ background: 'var(--accent-glow)', color: 'var(--accent)' }}
            >
              + Add
            </button>
            <button onClick={onClose} className="border-none cursor-pointer w-6 h-6 flex items-center justify-center rounded-full text-[16px]"
                    style={{ background: 'var(--surface2)', color: 'var(--text-dim)' }}>
              ×
            </button>
          </div>
        </div>

        {/* Events list */}
        <div className="overflow-y-auto flex-1">
          {dayEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2" style={{ color: 'var(--text-faint)' }}>
              <span style={{ fontSize: 32 }}>📅</span>
              <span className="text-[13px]">Nothing scheduled</span>
            </div>
          ) : (
            dayEvents.map(ev => {
              const member = familyMembers.find(m => m.id === ev.familyMemberId)
              const avatarContent = member ? getMemberAvatarContent(member) : null
              const isEmoji = member?.avatar?.type === 'emoji'
              return (
                <button
                  key={ev.id}
                  onClick={() => onEventClick(ev)}
                  className="flex items-center gap-3 w-full text-left px-4 py-2.5 border-none cursor-pointer transition-colors duration-100"
                  style={{ background: 'transparent', borderLeft: `3px solid ${ev.color}`, marginLeft: 0 }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--text)' }}>
                      {ev.title}
                    </div>
                    <div className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
                      {ev.allDay ? 'All day' : `${ev.start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} – ${ev.end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
                    </div>
                  </div>
                  {avatarContent !== null && (
                    <span style={{
                      width: 26, height: 26, borderRadius: '50%', background: ev.color, color: '#fff',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: isEmoji ? 12 : 9, fontWeight: 700, flexShrink: 0,
                    }}>
                      {avatarContent}
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}

// ── SearchChip ─────────────────────────────────────────────────────────────

function SearchChip({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function expand() {
    setExpanded(true)
    setTimeout(() => inputRef.current?.focus(), 30)
  }

  function clear() {
    onChange('')
    setExpanded(false)
  }

  if (!expanded && !value) {
    return (
      <button
        onClick={expand}
        className="w-8 h-8 flex items-center justify-center rounded-[7px] text-sm cursor-pointer transition-all duration-150 border-none flex-shrink-0"
        style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}
        title="Search events (/)"
      >
        🔍
      </button>
    )
  }

  return (
    <div
      className="flex items-center gap-1.5 rounded-[7px] flex-shrink-0"
      style={{ background: 'var(--surface2)', border: '1px solid var(--border)', padding: '0 8px', height: 32, minWidth: 180 }}
    >
      <span style={{ fontSize: 12, color: 'var(--text-dim)', flexShrink: 0 }}>🔍</span>
      <input
        ref={inputRef}
        data-search-input
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={() => { if (!value) setExpanded(false) }}
        onKeyDown={e => { if (e.key === 'Escape') clear() }}
        placeholder="Search events…"
        className="border-none outline-none bg-transparent text-[12px] flex-1 min-w-0"
        style={{ color: 'var(--text)' }}
      />
      {value && (
        <button
          onMouseDown={e => { e.preventDefault(); clear() }}
          className="w-4 h-4 flex items-center justify-center rounded-full text-[9px] cursor-pointer border-none flex-shrink-0"
          style={{ background: 'var(--text-faint)', color: 'var(--surface)' }}
        >
          ✕
        </button>
      )}
    </div>
  )
}

// ── MobileFiltersSheet ─────────────────────────────────────────────────────

function MobileFiltersSheet({
  familyMembers,
  calTypes,
  onToggleMember,
  onToggleCalType,
  onClose,
}: {
  familyMembers: FamilyMemberUI[]
  calTypes: { id: string; name: string; enabled: boolean }[]
  onToggleMember: (id: string) => void
  onToggleCalType: (id: string) => void
  onClose: () => void
}) {
  return (
    <>
      <div className="fixed inset-0 z-40 md:hidden" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose} />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden flex flex-col"
        style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', borderRadius: '16px 16px 0 0', maxHeight: '60dvh' }}
      >
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div style={{ width: 40, height: 4, background: 'var(--border)', borderRadius: 2 }} />
        </div>
        <div className="flex items-center justify-between px-5 pb-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="font-semibold text-base" style={{ color: 'var(--text)' }}>Filters</span>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-[8px] border-none cursor-pointer text-lg" style={{ background: 'var(--surface2)', color: 'var(--text-dim)' }}>✕</button>
        </div>
        <div className="overflow-y-auto px-5 py-4 flex flex-col gap-5">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-faint)' }}>Family</div>
            <div className="flex flex-wrap gap-2">
              {familyMembers.map(m => (
                <button
                  key={m.id}
                  onClick={() => onToggleMember(m.id)}
                  className="flex items-center gap-2 px-3 py-2 rounded-full cursor-pointer transition-all duration-150 border-none"
                  style={{ background: m.enabled ? 'var(--surface2)' : 'transparent', border: `1px solid ${m.enabled ? m.color + '80' : 'var(--border)'}`, opacity: m.enabled ? 1 : 0.5 }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: m.enabled ? m.color : 'var(--text-faint)', flexShrink: 0, display: 'inline-block' }} />
                  <span style={{ fontSize: 14, fontWeight: 500, color: m.enabled ? 'var(--text)' : 'var(--text-dim)' }}>{m.name}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-faint)' }}>Calendar Type</div>
            <div className="flex flex-col gap-1">
              {calTypes.map(ct => (
                <button
                  key={ct.id}
                  onClick={() => onToggleCalType(ct.id)}
                  className="flex items-center gap-3 px-2 py-2.5 rounded-[8px] cursor-pointer text-left w-full transition-colors duration-100 border-none"
                  style={{ background: 'transparent' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ width: 18, height: 18, borderRadius: 5, background: ct.enabled ? 'var(--accent)' : 'transparent', border: ct.enabled ? '2px solid var(--accent)' : '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, color: '#fff' }}>
                    {ct.enabled && '✓'}
                  </span>
                  <span style={{ fontSize: 15, color: ct.enabled ? 'var(--text)' : 'var(--text-dim)' }}>{ct.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
