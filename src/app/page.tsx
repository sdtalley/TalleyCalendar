'use client'

import { useEffect, useMemo, useCallback, useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Sidebar } from '@/components/layout/Sidebar'
import { MonthView } from '@/components/calendar/MonthView'
import { WeekView } from '@/components/calendar/WeekView'
import { DayView } from '@/components/calendar/DayView'
import { AgendaSidebar } from '@/components/calendar/AgendaSidebar'
import { EventModal } from '@/components/calendar/EventModal'
import { useCalendarNavigation } from '@/hooks/useCalendarNavigation'
import { useEventFilters } from '@/hooks/useEventFilters'
import { generateSampleEvents, DEFAULT_FAMILY_MEMBERS } from '@/lib/sampleData'
import type { CalendarEvent, NewEventDraft } from '@/lib/calendar/types'

export default function CalendarPage() {
  const { currentDate, selectedDate, view, goToday, goPrev, goNext, selectDate, changeView } =
    useCalendarNavigation()

  // Stable sample events seeded once
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([])
  useEffect(() => {
    setAllEvents(generateSampleEvents())
  }, [])

  const { familyMembers, calTypes, visibleEvents, toggleMember, toggleCalType } =
    useEventFilters(allEvents, DEFAULT_FAMILY_MEMBERS)

  const [modalOpen, setModalOpen] = useState(false)
  const [modalInitialDate, setModalInitialDate] = useState<Date | undefined>()

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Don't fire shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return

      switch (e.key) {
        case 'ArrowLeft':
          goPrev()
          break
        case 'ArrowRight':
          goNext()
          break
        case 't':
        case 'T':
          goToday()
          break
        case 'n':
        case 'N':
          setModalOpen(true)
          break
        case 'm':
          changeView('month')
          break
        case 'w':
          changeView('week')
          break
        case 'd':
          changeView('day')
          break
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

    setAllEvents(prev => [...prev, newEvent])
  }

  function handleEventClick(event: CalendarEvent) {
    // Placeholder — event detail view will go here
    console.log('Event clicked:', event.title)
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

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar
          familyMembers={familyMembers}
          calTypes={calTypes}
          onToggleMember={toggleMember}
          onToggleCalType={toggleCalType}
        />

        {/* Calendar area */}
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
    </div>
  )
}
