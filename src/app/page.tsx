'use client'

import { useEffect, useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Sidebar } from '@/components/layout/Sidebar'
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

  // Screen dimming for kiosk mode
  useScreenDim()

  // Fetch real events from connected accounts
  const { events: liveEvents, members: liveMembers, loading, error: calError } = useCalendarEvents()

  // Sample events as fallback when no accounts connected
  const [sampleEvents] = useState<CalendarEvent[]>(() => generateSampleEvents())
  const [localEvents, setLocalEvents] = useState<CalendarEvent[]>([])

  // Use live data if family members exist in Redis, otherwise show sample data
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

  // Apply search filter on top of member/type filters
  const displayEvents = searchQuery.trim()
    ? visibleEvents.filter(e => {
        const q = searchQuery.toLowerCase()
        return (
          e.title.toLowerCase().includes(q) ||
          (e.location?.toLowerCase().includes(q) ?? false) ||
          (e.description?.toLowerCase().includes(q) ?? false)
        )
      })
    : visibleEvents

  // Keyboard shortcuts
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

  // Selecting a date (month grid or mini-calendar) updates the sidebar.
  // On mobile, also opens the day drawer.
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

  function handleSaveEvent(draft: NewEventDraft) {
    const member = familyMembers.find(m => m.id === draft.familyMemberId)
    if (!member) return

    const [sh, sm] = draft.startTime.split(':').map(Number)
    const [eh, em] = draft.endTime.split(':').map(Number)
    const [yr, mo, dy] = draft.date.split('-').map(Number)

    const start = new Date(yr, mo - 1, dy, sh, sm)
    const end = new Date(yr, mo - 1, dy, eh, em)

    const newEvent: CalendarEvent = {
      id: `local-${Date.now()}`,
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

    setLocalEvents(prev => [...prev, newEvent])
  }

  function handleEventClick(event: CalendarEvent) {
    setDetailEvent(event)
  }

  // Full-page loading state — no sample data flash
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
      />

      {calError && (
        <div
          className="px-4 py-2 text-xs text-center"
          style={{ background: 'rgba(255,107,107,0.1)', color: '#ff6b6b' }}
        >
          {calError}
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left sidebar — hidden on mobile */}
        <div className="hidden md:flex">
          <Sidebar
            familyMembers={familyMembers}
            calTypes={calTypes}
            selectedDate={selectedDate}
            onToggleMember={toggleMember}
            onToggleCalType={toggleCalType}
            onSelectDate={handleSelectDate}
          />
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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

        {/* Right agenda sidebar — hidden on mobile */}
        <div className="hidden md:flex">
          <AgendaSidebar
            selectedDate={selectedDate}
            events={displayEvents}
            onEventClick={handleEventClick}
            onDragCreate={handleDragCreate}
          />
        </div>
      </div>

      {/* Mobile day drawer — slides up on day tap, invisible on desktop via CSS */}
      <MobileDayDrawer
        open={mobileDrawerOpen}
        date={selectedDate}
        events={displayEvents}
        onClose={() => setMobileDrawerOpen(false)}
        onEventClick={handleEventClick}
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
      />
    </div>
  )
}
