'use client'

import { useEffect, useState, useCallback } from 'react'
import type { AppSettings } from '@/lib/calendar/types'

interface DimState {
  enabled: boolean
  dimStart: string  // HH:MM
  dimEnd: string    // HH:MM
  isDimmed: boolean
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function isInDimWindow(start: string, end: string): boolean {
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const startMin = timeToMinutes(start)
  const endMin = timeToMinutes(end)

  // Handle overnight spans (e.g. 22:00 → 06:00)
  if (startMin > endMin) {
    return nowMin >= startMin || nowMin < endMin
  }
  return nowMin >= startMin && nowMin < endMin
}

export function useScreenDim() {
  const [state, setState] = useState<DimState>({
    enabled: true,
    dimStart: '22:00',
    dimEnd: '06:00',
    isDimmed: false,
  })

  // Fetch settings on mount
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then((settings: AppSettings) => {
        setState(prev => ({
          ...prev,
          dimStart: settings.dimSchedule.start,
          dimEnd: settings.dimSchedule.end,
          isDimmed: isInDimWindow(settings.dimSchedule.start, settings.dimSchedule.end),
        }))
      })
      .catch(() => {})
  }, [])

  // Check every minute if we're in the dim window
  useEffect(() => {
    if (!state.enabled) return

    function check() {
      setState(prev => ({
        ...prev,
        isDimmed: isInDimWindow(prev.dimStart, prev.dimEnd),
      }))
    }

    check()
    const interval = setInterval(check, 60_000)
    return () => clearInterval(interval)
  }, [state.enabled, state.dimStart, state.dimEnd])

  // Apply CSS filter to body
  useEffect(() => {
    if (state.enabled && state.isDimmed) {
      document.documentElement.style.filter = 'brightness(0.5)'
      document.documentElement.style.transition = 'filter 2s ease'
    } else {
      document.documentElement.style.filter = ''
      document.documentElement.style.transition = 'filter 2s ease'
    }
    return () => {
      document.documentElement.style.filter = ''
      document.documentElement.style.transition = ''
    }
  }, [state.enabled, state.isDimmed])

  const toggle = useCallback(() => {
    setState(prev => ({ ...prev, enabled: !prev.enabled }))
  }, [])

  return {
    isDimmed: state.enabled && state.isDimmed,
    dimEnabled: state.enabled,
    toggleDim: toggle,
  }
}
