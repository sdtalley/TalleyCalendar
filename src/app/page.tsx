'use client'

import { useEffect, useState, useRef } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { ListsPanel, MobileListsDrawer } from '@/components/lists/ListsPanel'
import { MonthView } from '@/components/calendar/MonthView'
import { WeekView } from '@/components/calendar/WeekView'
import { DayView } from '@/components/calendar/DayView'
import { AgendaSidebar } from '@/components/calendar/AgendaSidebar'
import { EventModal } from '@/components/calendar/EventModal'
import { EventDetailModal } from '@/components/calendar/EventDetailModal'
import { MobileDayDrawer } from '@/components/calendar/MobileDayDrawer'
import { useCalendarNavigation } from '@/hooks/useCalendarNavigation'
import { useEventFilters } from '@/hooks/useEventFilters'
import { useCalendarEvents } from '@/hooks/useCalendarEvents'
import { useScreenDim } from '@/hooks/useScreenDim'
import { generateSampleEvents, DEFAULT_FAMILY_MEMBERS } from '@/lib/sampleData'
import type { CalendarEvent, FamilyMemberUI, NewEventDraft } from '@/lib/calendar/types'

export default function CalendarPage() {
  const { currentDate, selectedDate, view, goToday, goPrev, goNext, selectDate, changeView } =
    useCalendarNavigation()

  useScreenDim()

  const { events: liveEvents, members: liveMembers, loading, backgroundLoading, error: calError } = useCalendarEvents(currentDate)

  const [sampleEvents] = useState<CalendarEvent[]>(() => generateSampleEvents())
  const [localEvents, setLocalEvents] = useState<CalendarEvent[]>([])
  // IDs of events deleted locally (hidden until next poll reconciles)
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => new Set())
  // Optimistic reschedule overrides: eventId → { start, end }
  const [rescheduleOverrides, setRescheduleOverrides] = useState<Map<string, { start: Date; end: Date }>>(() => new Map())
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
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [mobileListsOpen, setMobileListsOpen] = useState(false)

  // Apply deletions and reschedule overrides before display
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
        case 'ArrowLeft': goPrev(); break
        case 'ArrowRight': goNext(); break
        case 't': case 'T': goToday(); break
        case 'n': case 'N': setModalOpen(true); break
        case 'm': changeView('month'); break
        case 'w': changeView('week'); break
        case 'd': changeView('day'); break
        case '/': {
          e.preventDefault()
          const searchInput = document.querySelector<HTMLInputElement>('input[placeholder="Search"]')
          searchInput?.focus()
          break
        }
        case 'Escape': setSearchQuery(''); break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goPrev, goNext, goToday, changeView])

  function handleSelectDate(date: Date) {
    selectDate(date)
    setMobileDrawerOpen(true)
  }

  function handleAddEvent() {
    setModalInitialDate(selectedDate)
    setModalOpen(true)
  }

  function handleAddEventOnDate(date: Date) {
    setModalInitialDate(date)
    setDragTimeRange(null)
    setModalOpen(true)
  }

  function handleDragCreate(date: Date, startMinutes: number, endMinutes: number) {
    const sh = Math.floor(startMinutes / 60)
    const sm = startMinutes % 60
    const eh = Math.floor(endMinutes / 60)
    const em = endMinutes % 60
    setModalInitialDate(date)
    setDragTimeRange({
      startTime: `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`,
      endTime: `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`,
    })
    setModalOpen(true)
  }

  async function handleSaveEvent(draft: NewEventDraft) {
    const member = familyMembers.find(m => m.id === draft.familyMemberId)
    if (!member) return

    // Optimistic local event while API call is in flight
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

    // Only attempt write-back if there are real accounts (not sample mode)
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
        // Remove optimistic event on failure
        setLocalEvents(prev => prev.filter(e => e.id !== optimisticId))
      }
      // On success, leave the optimistic event; next poll will bring the real one
    } catch {
      showWriteError('Failed to reach server — event not saved')
      setLocalEvents(prev => prev.filter(e => e.id !== optimisticId))
    }
  }

  async function handleDeleteEvent(event: CalendarEvent) {
    if (!event.externalId) return

    // Optimistic removal
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
        // Restore event on failure
        setDeletedIds(prev => {
          const next = new Set(prev)
          next.delete(event.id)
          return next
        })
      }
    } catch {
      showWriteError('Failed to reach server — event not deleted')
      setDeletedIds(prev => {
        const next = new Set(prev)
        next.delete(event.id)
        return next
      })
    }
  }

  async function handleRescheduleEvent(event: CalendarEvent, newDate: Date, newStartMinutes: number) {
    if (!event.externalId) return

    const durationMs = event.end.getTime() - event.start.getTime()
    const newStart = new Date(newDate)
    newStart.setHours(Math.floor(newStartMinutes / 60), newStartMinutes % 60, 0, 0)
    const newEnd = new Date(newStart.getTime() + durationMs)

    // Optimistic update
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
        // Revert optimistic update on failure
        setRescheduleOverrides(prev => {
          const next = new Map(prev)
          next.delete(event.id)
          return next
        })
      }
    } catch {
      showWriteError('Failed to reach server — event not rescheduled')
      setRescheduleOverrides(prev => {
        const next = new Map(prev)
        next.delete(event.id)
        return next
      })
    }
  }

  function handleEventClick(event: CalendarEvent) {
    setDetailEvent(event)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <TopBar
          currentDate={currentDate}
          view={view}
          onPrev={goPrev}
          onNext={goNext}
          onToday={goToday}
          onViewChange={changeView}
          onAddEvent={handleAddEvent}
          searchQuery=""
          onSearchChange={() => {}}
        />
        <div className="flex items-center justify-center flex-1" style={{ color: 'var(--text-dim)' }}>
          Loading calendar...
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <TopBar
        currentDate={currentDate}
        view={view}
        onPrev={goPrev}
        onNext={goNext}
        onToday={goToday}
        onViewChange={changeView}
        onAddEvent={handleAddEvent}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        familyMembers={familyMembers}
        calTypes={calTypes}
        onToggleMember={toggleMember}
        onToggleCalType={toggleCalType}
        onOpenListsDrawer={() => setMobileListsOpen(true)}
      />

      {calError && (
        <div
          className="px-4 py-2 text-xs text-center"
          style={{ background: 'rgba(255,107,107,0.1)', color: '#ff6b6b' }}
        >
          {calError}
        </div>
      )}

      {writeError && (
        <div
          className="px-4 py-2 text-xs text-center flex items-center justify-between"
          style={{ background: 'rgba(255,107,107,0.1)', color: '#ff6b6b' }}
        >
          <span>{writeError}</span>
          <button
            onClick={() => setWriteError(null)}
            style={{ background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer', padding: '0 4px' }}
          >
            ×
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Lists panel — desktop only */}
        <div className="hidden md:flex">
          <ListsPanel />
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
          {backgroundLoading && <div className="calendar-shimmer" />}
          {view === 'month' && (
            <MonthView
              currentDate={currentDate}
              selectedDate={selectedDate}
              events={displayEvents}
              onSelectDate={handleSelectDate}
              onEventClick={handleEventClick}
              onAddEventOnDate={handleAddEventOnDate}
            />
          )}
          {view === 'week' && (
            <WeekView
              currentDate={currentDate}
              events={displayEvents}
              onEventClick={handleEventClick}
              onDragCreate={handleDragCreate}
              onReschedule={handleRescheduleEvent}
            />
          )}
          {view === 'day' && (
            <DayView
              currentDate={currentDate}
              events={displayEvents}
              onEventClick={handleEventClick}
              onDragCreate={handleDragCreate}
            />
          )}
        </div>

        {/* Right agenda sidebar — desktop only */}
        <div className="hidden md:flex">
          <AgendaSidebar
            selectedDate={selectedDate}
            events={displayEvents}
            onEventClick={handleEventClick}
            onDragCreate={handleDragCreate}
          />
        </div>
      </div>

      {/* Mobile drawers */}
      <MobileDayDrawer
        open={mobileDrawerOpen}
        date={selectedDate}
        events={displayEvents}
        onClose={() => setMobileDrawerOpen(false)}
        onEventClick={handleEventClick}
      />

      <MobileListsDrawer
        open={mobileListsOpen}
        onClose={() => setMobileListsOpen(false)}
      />

      <EventModal
        open={modalOpen}
        initialDate={modalInitialDate}
        initialStartTime={dragTimeRange?.startTime}
        initialEndTime={dragTimeRange?.endTime}
        familyMembers={familyMembers}
        onClose={() => { setModalOpen(false); setDragTimeRange(null) }}
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
