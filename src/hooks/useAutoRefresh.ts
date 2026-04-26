'use client'

import { useCallback, useEffect, useState } from 'react'

// Polls every intervalMs AND bumps on document visibility change (e.g. screen
// wake, browser tab regain focus). Returns a monotonically-increasing tick
// counter that tabs can add to their fetch effect dependency arrays.
export function useAutoRefresh(intervalMs = 300_000) {
  const [tick, setTick] = useState(0)
  const bump = useCallback(() => setTick(t => t + 1), [])

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
