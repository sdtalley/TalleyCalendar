'use client'

import { useEffect, useState } from 'react'

export function Clock() {
  const [time, setTime] = useState('')

  useEffect(() => {
    function tick() {
      const now = new Date()
      const h = now.getHours() % 12 || 12
      const m = String(now.getMinutes()).padStart(2, '0')
      setTime(`${h}:${m}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <span
      className="font-mono text-base min-w-[52px] text-right"
      style={{ color: 'var(--text-dim)' }}
    >
      {time}
    </span>
  )
}
