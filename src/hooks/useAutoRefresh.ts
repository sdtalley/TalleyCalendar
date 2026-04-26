'use client'

import { useCallback, useEffect, useState } from 'react'

// Returns true if the current hour falls within [from, to).
// Handles overnight ranges (e.g. from=22, to=6).
function inPauseWindow(from: number, to: number): boolean {
  const h = new Date().getHours()
  return from < to ? h >= from && h < to : h >= from || h < to
}

// Polls every intervalMs AND bumps on document visibility change (screen wake /
// browser tab focus). Skips bumps during pauseHours to avoid wasting Redis
// commands while nobody is using the display.
//
// Usage: useAutoRefresh(30_000, { from: 1, to: 5 })  // pause 1am–5am
export function useAutoRefresh(
  intervalMs = 300_000,
  pauseHours?: { from: number; to: number },
) {
  const [tick, setTick] = useState(0)

  const bump = useCallback(() => {
    if (pauseHours && inPauseWindow(pauseHours.from, pauseHours.to)) return
    setTick(t => t + 1)
  }, [pauseHours?.from, pauseHours?.to]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') bump() }
    document.addEventListener('visibilitychange', onVisible)
    const id = setInterval(bump, intervalMs)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(id)
    }
  }, [bump, intervalMs])

  return tick
}
