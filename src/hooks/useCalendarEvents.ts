'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { CalendarEvent, FamilyMember } from '@/lib/calendar/types'

const DEFAULT_REFRESH_INTERVAL = 300_000 // 5 minutes

interface UseCalendarEventsResult {
  events: CalendarEvent[]
  members: FamilyMember[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useCalendarEvents(): UseCalendarEventsResult {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval>>()

  const fetchEvents = useCallback(async () => {
    try {
      // Fetch current month ± buffer
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 0)

      const [calRes, memberRes] = await Promise.all([
        fetch(`/api/calendars?start=${start.toISOString()}&end=${end.toISOString()}`),
        fetch('/api/family'),
      ])

      if (calRes.ok) {
        const data = await calRes.json()
        // Rehydrate Date objects from JSON strings
        const hydrated = (data.events ?? []).map((e: CalendarEvent) => ({
          ...e,
          start: new Date(e.start as unknown as string),
          end: new Date(e.end as unknown as string),
        }))
        setEvents(hydrated)
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

  useEffect(() => {
    fetchEvents()

    // Set up polling
    intervalRef.current = setInterval(fetchEvents, DEFAULT_REFRESH_INTERVAL)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchEvents])

  return { events, members, loading, error, refresh: fetchEvents }
}
