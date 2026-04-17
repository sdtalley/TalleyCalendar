'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { CalendarEvent, FamilyMember } from '@/lib/calendar/types'

const REFRESH_INTERVAL = 300_000  // 5 min polling
const CACHE_TTL        = 300_000  // SWR revalidation threshold
const EVICT_MONTHS     = 3        // drop cache entries this far from current view
const PREFETCH_DELAY   = 500      // ms to wait after navigation before prefetching

type CacheEntry = { events: CalendarEvent[]; fetchedAt: number }

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function windowFor(d: Date) {
  return {
    start: new Date(d.getFullYear(), d.getMonth() - 1, 1),
    end:   new Date(d.getFullYear(), d.getMonth() + 2, 0),
  }
}

function shiftMonth(d: Date, delta: number) {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1)
}

export interface UseCalendarEventsResult {
  events: CalendarEvent[]
  members: FamilyMember[]
  loading: boolean
  backgroundLoading: boolean
  error: string | null
  refresh: () => void
}

export function useCalendarEvents(currentDate: Date): UseCalendarEventsResult {
  const [events, setEvents]               = useState<CalendarEvent[]>([])
  const [members, setMembers]             = useState<FamilyMember[]>([])
  const [loading, setLoading]             = useState(true)
  const [backgroundLoading, setBgLoading] = useState(false)
  const [error, setError]                 = useState<string | null>(null)

  const cache          = useRef<Map<string, CacheEntry>>(new Map())
  const inFlight       = useRef<Set<string>>(new Set())
  const bgCount        = useRef(0)          // counter so overlapping fetches don't race on the shimmer
  const hasBooted      = useRef(false)      // true once the first visible month has loaded
  const prevDate       = useRef(currentDate)
  const currentDateRef = useRef(currentDate)
  const intervalRef    = useRef<ReturnType<typeof setInterval>>()

  // Keep a ref in sync for use inside intervals / timeouts
  useEffect(() => { currentDateRef.current = currentDate })

  // ── shimmer counter helpers ─────────────────────────────────────────────

  const incBg = useCallback(() => {
    bgCount.current++
    setBgLoading(true)
  }, [])

  const decBg = useCallback(() => {
    bgCount.current = Math.max(0, bgCount.current - 1)
    if (bgCount.current === 0) setBgLoading(false)
  }, [])

  // ── evict months too far from the current view ──────────────────────────

  const evict = useCallback((anchor: Date) => {
    for (const key of cache.current.keys()) {
      const [yr, mo] = key.split('-').map(Number)
      const dist = Math.abs((yr - anchor.getFullYear()) * 12 + (mo - 1 - anchor.getMonth()))
      if (dist > EVICT_MONTHS) cache.current.delete(key)
    }
  }, [])

  // ── core fetch ──────────────────────────────────────────────────────────

  const fetchForDate = useCallback(async (
    targetDate: Date,
    opts: { silent?: boolean } = {},
  ) => {
    const key    = monthKey(targetDate)
    const silent = opts.silent ?? false

    // Silent fetches (prefetch / SWR revalidation) skip if already in-flight
    if (silent && inFlight.current.has(key)) return

    inFlight.current.add(key)

    // Show shimmer only after initial boot (initial boot uses the full-page spinner)
    if (!silent && hasBooted.current) incBg()

    const { start, end } = windowFor(targetDate)

    try {
      const [calRes, memberRes] = await Promise.all([
        fetch(`/api/calendars?start=${start.toISOString()}&end=${end.toISOString()}`),
        fetch('/api/family'),
      ])

      if (calRes.ok) {
        const data     = await calRes.json()
        const hydrated = (data.events ?? []).map((e: CalendarEvent) => ({
          ...e,
          start: new Date(e.start as unknown as string),
          end:   new Date(e.end   as unknown as string),
        }))

        cache.current.set(key, { events: hydrated, fetchedAt: Date.now() })

        // Only update displayed events if this is still the visible month
        if (monthKey(currentDateRef.current) === key) {
          setEvents(hydrated)
          setError(data.errors ? `${data.errors.length} account(s) had errors` : null)
        }
      } else if (monthKey(currentDateRef.current) === key) {
        setError('Failed to fetch calendar events')
      }

      if (memberRes.ok) setMembers(await memberRes.json())
    } catch (err) {
      if (monthKey(currentDateRef.current) === key) {
        setError(err instanceof Error ? err.message : 'Failed to fetch events')
      }
    } finally {
      inFlight.current.delete(key)
      if (!silent && hasBooted.current) decBg()

      // First time the currently-visible month finishes → dismiss full-page spinner
      if (!hasBooted.current && monthKey(currentDateRef.current) === key) {
        hasBooted.current = true
        setLoading(false)
      }
    }
  }, [incBg, decBg])

  // ── prefetch: silent, skips if cache is still fresh ────────────────────

  const prefetch = useCallback((targetDate: Date) => {
    const key   = monthKey(targetDate)
    const entry = cache.current.get(key)
    if (entry && Date.now() - entry.fetchedAt < CACHE_TTL) return
    fetchForDate(targetDate, { silent: true })
  }, [fetchForDate])

  // ── navigation: fires on mount and every time currentDate changes ───────

  useEffect(() => {
    const key   = monthKey(currentDate)
    const entry = cache.current.get(key)
    const fresh = !!entry && Date.now() - entry.fetchedAt < CACHE_TTL

    evict(currentDate)

    // Determine travel direction (default forward on first mount)
    const direction = currentDate >= prevDate.current ? 1 : -1
    prevDate.current = new Date(currentDate)

    if (fresh) {
      // Cache hit → instant display; silently revalidate in background (SWR)
      setEvents(entry.events)
      setLoading(false)
      fetchForDate(currentDate, { silent: true })
    } else {
      // Cache miss → fetch (fetchForDate will show the shimmer post-boot)
      fetchForDate(currentDate)
    }

    // After the user settles on this month, prefetch the next one in their direction
    const timer = setTimeout(
      () => prefetch(shiftMonth(currentDate, direction)),
      PREFETCH_DELAY,
    )
    return () => clearTimeout(timer)
  }, [currentDate]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── post-boot: immediately prefetch the next month forward ──────────────

  useEffect(() => {
    if (!loading) prefetch(shiftMonth(currentDateRef.current, 1))
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── polling: refresh the current window every 5 min ────────────────────

  useEffect(() => {
    intervalRef.current = setInterval(
      () => fetchForDate(currentDateRef.current, { silent: true }),
      REFRESH_INTERVAL,
    )
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchForDate])

  const refresh = useCallback(
    () => fetchForDate(currentDateRef.current),
    [fetchForDate],
  )

  return { events, members, loading, backgroundLoading, error, refresh }
}
