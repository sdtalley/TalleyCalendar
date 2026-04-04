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
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null)

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      switch (e.key) {
        case 'ArrowLeft': goPrev(); break
        case 'ArrowRight': goNext(); break
        case 't': case 'T': goToday(); break
        case 'n': case 'N': setModalOpen(true); break
        case 'm': changeView('month'); break
        case 'w': changeView('week'); break
        case 'd': changeView('day'); break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goPrev, goNext, goToday, changeView])

  function handleSelectDate(date: Date) {
    selectDate(date)
    changeView('day')
  }

  function handleAddEvent() {
    setModalInitialDate(selectedDate)
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
        <Sidebar
          familyMembers={familyMembers}
          calTypes={calTypes}
          onToggleMember={toggleMember}
          onToggleCalType={toggleCalType}
        />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {view === 'month' && (
            <MonthView
              currentDate={currentDate}
              selectedDate={selectedDate}
              events={visibleEvents}
              onSelectDate={handleSelectDate}
              onEventClick={handleEventClick}
            />
          )}
          {view === 'week' && (
            <WeekView
              currentDate={currentDate}
              events={visibleEvents}
              onEventClick={handleEventClick}
            />
          )}
          {view === 'day' && (
            <DayView
              currentDate={currentDate}
              events={visibleEvents}
              onEventClick={handleEventClick}
            />
          )}
        </div>

        <AgendaSidebar
          selectedDate={selectedDate}
          events={visibleEvents}
          onEventClick={handleEventClick}
        />
      </div>

      <EventModal
        open={modalOpen}
        initialDate={modalInitialDate}
        familyMembers={familyMembers}
        onClose={() => setModalOpen(false)}
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
