'use client'

import { useState, useCallback } from 'react'
import type { CalendarView } from '@/lib/calendar/types'

export function useCalendarNavigation(weekStep = 7) {
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [view, setView] = useState<CalendarView>('month')

  const goToday = useCallback(() => {
    const today = new Date()
    setCurrentDate(today)
    setSelectedDate(today)
  }, [])

  const goPrev = useCallback(() => {
    setCurrentDate(prev => {
      const d = new Date(prev)
      if (view === 'month') {
        d.setMonth(d.getMonth() - 1)
      } else if (view === 'week') {
        d.setDate(d.getDate() - 7)
      } else if (view === 'schedule') {
        d.setDate(d.getDate() - weekStep)
      } else {
        d.setDate(d.getDate() - 1)
      }
      return d
    })
  }, [view, weekStep])

  const goNext = useCallback(() => {
    setCurrentDate(prev => {
      const d = new Date(prev)
      if (view === 'month') {
        d.setMonth(d.getMonth() + 1)
      } else if (view === 'week') {
        d.setDate(d.getDate() + 7)
      } else if (view === 'schedule') {
        d.setDate(d.getDate() + weekStep)
      } else {
        d.setDate(d.getDate() + 1)
      }
      return d
    })
  }, [view, weekStep])

  const selectDate = useCallback((date: Date) => {
    setSelectedDate(date)
    setCurrentDate(date)
  }, [])

  const changeView = useCallback((v: CalendarView) => {
    setView(v)
  }, [])

  return {
    currentDate,
    selectedDate,
    view,
    goToday,
    goPrev,
    goNext,
    selectDate,
    changeView,
  }
}
