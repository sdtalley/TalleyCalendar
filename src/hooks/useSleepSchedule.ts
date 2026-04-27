'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { AppSettings } from '@/lib/calendar/types'

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function isInSleepWindow(from: string, to: string): boolean {
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const fromMin = timeToMinutes(from)
  const toMin = timeToMinutes(to)
  // Handle overnight spans (e.g. 00:00 → 06:00, or 22:00 → 06:00)
  if (fromMin >= toMin) {
    return nowMin >= fromMin || nowMin < toMin
  }
  return nowMin >= fromMin && nowMin < toMin
}

export function useSleepSchedule() {
  const [from, setFrom] = useState('00:00')
  const [to, setTo]     = useState('06:00')
  const [enabled, setEnabled]     = useState(false)
  const [isSleeping, setIsSleeping] = useState(false)
  // Prevents firing the hardware sleep call more than once per sleep window entry
  const hasFiredRef = useRef(false)

  // Fetch settings on mount
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then((s: AppSettings) => {
        if (s.sleepSchedule) {
          setFrom(s.sleepSchedule.from)
          setTo(s.sleepSchedule.to)
          setEnabled(s.sleepSchedule.enabled)
        }
      })
      .catch(() => {})
  }, [])

  // Check every 60s whether we're in the sleep window
  useEffect(() => {
    function check() {
      const sleeping = enabled && isInSleepWindow(from, to)
      setIsSleeping(sleeping)

      if (sleeping && !hasFiredRef.current) {
        hasFiredRef.current = true
        // Fire hardware sleep — only works on local instance with ENABLE_SYSTEM_SLEEP=true
        // On Vercel returns 501; the CSS overlay (rendered in AppShell) covers that case
        fetch('/api/sleep', { method: 'POST' }).catch(() => {})
      }

      if (!sleeping) {
        hasFiredRef.current = false
      }
    }

    check()
    const interval = setInterval(check, 60_000)
    return () => clearInterval(interval)
  }, [enabled, from, to])

  const wakeNow = useCallback(() => {
    setIsSleeping(false)
    hasFiredRef.current = false
  }, [])

  return { isSleeping, wakeNow }
}
