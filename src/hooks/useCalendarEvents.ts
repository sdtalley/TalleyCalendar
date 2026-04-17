'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { CalendarEvent, FamilyMember } from '@/lib/calendar/types'

const DEFAULT_REFRESH_INTERVAL = 300_000 // 5 minutes
const MONTH_BUFFER = 1 // months on each side of currentDate to load

interface UseCalendarEventsResult {
  events: CalendarEvent[]
  members: FamilyMember[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

function windowFor(date: Date): { start: Date; end: Date } {
  return {
    start: new Date(date.getFullYear(), date.getMonth() - MONTH_BUFFER, 1),
    end: new Date(date.getFullYear(), date.getMonth() + MONTH_BUFFER + 1, 0),
  }
}

export function useCalendarEvents(currentDate: Date): UseCalendarEventsResult {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadedRange = useRef<{ start: Date; end: Date } | null>(null)
  const currentDateRef = useRef(currentDate)
  const intervalRef = useRef<ReturnType<typeof setInterval>>()

  // Keep ref in sync so the polling interval always uses the latest currentDate
  useEffect(() => {
    currentDateRef.current = currentDate
  })

  const fetchEvents = useCallback(async (targetDate: Date) => {
    const { start, end } = windowFor(targetDate)

    try {
      const [calRes, memberRes] = await Promise.all([
        fetch(`/api/calendars?start=${start.toISOString()}&end=${end.toISOString()}`),
        fetch('/api/family'),
      ])

      if (calRes.ok) {
        const data = await calRes.json()
        const hydrated = (data.events ?? []).map((e: CalendarEvent) => ({
          ...e,
          start: new Date(e.start as unknown as string),
          end: new Date(e.end as unknown as string),
        }))
        setEvents(hydrated)
        loadedRange.current = { start, end }
        setError(data.errors ? `${data.errors.length} account(s) had errors` : null)
      } else {
        setError('Failed to fetch calendar events')
      }

      if (memberRes.ok) {
        setMembers(await memberRes.json())
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch events')
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch on mount and whenever currentDate navigates outside the loaded window
  useEffect(() => {
    const range = loadedRange.current
    if (!range || currentDate < range.start || currentDate > range.end) {
      fetchEvents(currentDate)
    }
  }, [currentDate, fetchEvents])

  // Polling interval — always refreshes whatever window is currently visible
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      fetchEvents(currentDateRef.current)
    }, DEFAULT_REFRESH_INTERVAL)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchEvents])

  const refresh = useCallback(() => fetchEvents(currentDateRef.current), [fetchEvents])

  return { events, members, loading, error, refresh }
}
