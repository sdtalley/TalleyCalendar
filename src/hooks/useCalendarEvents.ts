'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { CalendarEvent, FamilyMember } from '@/lib/calendar/types'

const REFRESH_INTERVAL = 300_000  // 5 min polling
const EVICT_MONTHS     = 3        // drop in-memory cache entries beyond this distance
const PREFETCH_DELAY   = 500      // ms after navigation before prefetching adjacent month
const LS_CACHE_PREFIX  = 'cal-cache-'
const LS_MEMBERS_KEY   = 'cal-members'

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

function hydrateEvents(raw: unknown[]): CalendarEvent[] {
  return (raw ?? []).map((e: unknown) => {
    const ev = e as CalendarEvent & { start: string; end: string }
    return { ...ev, start: new Date(ev.start), end: new Date(ev.end) }
  })
}

// ── localStorage helpers ────────────────────────────────────────────────────

function lsReadCache(key: string): CacheEntry | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(LS_CACHE_PREFIX + key)
    if (!raw) return null
    const { events, fetchedAt } = JSON.parse(raw)
    return { events: hydrateEvents(events), fetchedAt }
  } catch { return null }
}

function lsWriteCache(key: string, events: CalendarEvent[], fetchedAt: number) {
  try {
    localStorage.setItem(LS_CACHE_PREFIX + key, JSON.stringify({ events, fetchedAt }))
  } catch { /* storage quota */ }
}

function lsReadMembers(): FamilyMember[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LS_MEMBERS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function lsWriteMembers(members: FamilyMember[]) {
  try { localStorage.setItem(LS_MEMBERS_KEY, JSON.stringify(members)) } catch { /* quota */ }
}

// ── Hook ────────────────────────────────────────────────────────────────────

export interface UseCalendarEventsResult {
  events: CalendarEvent[]
  members: FamilyMember[]
  loading: boolean
  backgroundLoading: boolean
  error: string | null
  refresh: () => void
}

export function useCalendarEvents(currentDate: Date): UseCalendarEventsResult {
  // Synchronous localStorage boot — these lazy inits run before first paint so
  // there is no spinner flash when cached data is available.
  const [lsBoot] = useState<{ key: string; entry: CacheEntry } | null>(() => {
    const key = monthKey(new Date())
    const entry = lsReadCache(key)
    return entry ? { key, entry } : null
  })

  const [events, setEvents]               = useState<CalendarEvent[]>(() => lsBoot?.entry.events ?? [])
  const [members, setMembers]             = useState<FamilyMember[]>(() => lsReadMembers())
  const [loading, setLoading]             = useState<boolean>(!lsBoot)
  const [backgroundLoading, setBgLoading] = useState(false)
  const [error, setError]                 = useState<string | null>(null)

  const cache          = useRef<Map<string, CacheEntry>>(new Map())
  const lsSeeded       = useRef(false)
  const inFlight       = useRef<Set<string>>(new Set())
  const bgCount        = useRef(0)
  const hasBooted      = useRef(!!lsBoot)
  const prevDate       = useRef(currentDate)
  const currentDateRef = useRef(currentDate)
  const intervalRef    = useRef<ReturnType<typeof setInterval>>()

  // Seed in-memory cache from LS boot entry before first effect fires.
  // Guarded by lsSeeded so this runs exactly once across all renders.
  if (!lsSeeded.current && lsBoot) {
    cache.current.set(lsBoot.key, lsBoot.entry)
    lsSeeded.current = true
  }

  useEffect(() => { currentDateRef.current = currentDate })

  // ── shimmer counter ──────────────────────────────────────────────────────

  const incBg = useCallback(() => { bgCount.current++; setBgLoading(true) }, [])
  const decBg = useCallback(() => {
    bgCount.current = Math.max(0, bgCount.current - 1)
    if (bgCount.current === 0) setBgLoading(false)
  }, [])

  // ── evict distant months from in-memory cache ────────────────────────────

  const evict = useCallback((anchor: Date) => {
    for (const key of Array.from(cache.current.keys())) {
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

    if (silent && inFlight.current.has(key)) return
    inFlight.current.add(key)

    // Shimmer only for non-silent fetches after initial boot
    if (!silent && hasBooted.current) incBg()

    const { start, end } = windowFor(targetDate)

    try {
      const [calRes, memberRes] = await Promise.all([
        fetch(`/api/calendars?start=${start.toISOString()}&end=${end.toISOString()}`),
        fetch('/api/family'),
      ])

      if (calRes.ok) {
        const data      = await calRes.json()
        const hydrated  = hydrateEvents(data.events ?? [])
        const fetchedAt = Date.now()

        cache.current.set(key, { events: hydrated, fetchedAt })
        lsWriteCache(key, hydrated, fetchedAt)

        if (monthKey(currentDateRef.current) === key) {
          setEvents(hydrated)
          setError(data.errors ? `${data.errors.length} account(s) had errors` : null)
        }
      } else if (monthKey(currentDateRef.current) === key) {
        setError('Failed to fetch calendar events')
      }

      if (memberRes.ok) {
        const memberData = await memberRes.json()
        setMembers(memberData)
        lsWriteMembers(memberData)
      }
    } catch (err) {
      if (monthKey(currentDateRef.current) === key) {
        setError(err instanceof Error ? err.message : 'Failed to fetch events')
      }
    } finally {
      inFlight.current.delete(key)
      if (!silent && hasBooted.current) decBg()

      if (!hasBooted.current && monthKey(currentDateRef.current) === key) {
        hasBooted.current = true
        setLoading(false)
      }
    }
  }, [incBg, decBg])

  // ── prefetch ─────────────────────────────────────────────────────────────

  const prefetch = useCallback((targetDate: Date) => {
    // Check both in-memory and localStorage before deciding to fetch
    const key      = monthKey(targetDate)
    const memEntry = cache.current.get(key)
    if (memEntry) return  // already have it in memory (fresh or being revalidated)
    const lsEntry  = lsReadCache(key)
    if (lsEntry) { cache.current.set(key, lsEntry); return }  // seed from LS, skip network
    fetchForDate(targetDate, { silent: true })
  }, [fetchForDate])

  // ── navigation: runs on mount and every time currentDate changes ─────────

  useEffect(() => {
    const key   = monthKey(currentDate)
    const entry = cache.current.get(key)

    evict(currentDate)

    const direction = currentDate >= prevDate.current ? 1 : -1
    prevDate.current = new Date(currentDate)

    if (entry) {
      // Have cached data → show it immediately, revalidate silently (true SWR)
      setEvents(entry.events)
      if (!hasBooted.current) { hasBooted.current = true; setLoading(false) }
      fetchForDate(currentDate, { silent: true })
    } else {
      // Nothing cached → full fetch (shimmer overlay if already booted, spinner if first load)
      fetchForDate(currentDate)
    }

    const timer = setTimeout(
      () => prefetch(shiftMonth(currentDate, direction)),
      PREFETCH_DELAY,
    )
    return () => clearTimeout(timer)
  }, [currentDate]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── post-boot: prefetch the next month forward ────────────────────────────

  useEffect(() => {
    if (!loading) prefetch(shiftMonth(currentDateRef.current, 1))
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── polling: revalidate every 5 min ──────────────────────────────────────

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
