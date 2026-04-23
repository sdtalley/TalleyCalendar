'use client'

import { useEffect, useState } from 'react'

export function Clock() {
  const [dateTime, setDateTime] = useState({ date: '', time: '', ampm: '' })

  useEffect(() => {
    function tick() {
      const now = new Date()
      const h = now.getHours() % 12 || 12
      const m = String(now.getMinutes()).padStart(2, '0')
      const ampm = now.getHours() < 12 ? 'AM' : 'PM'
      const date = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      setDateTime({ date, time: `${h}:${m}`, ampm })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>
        {dateTime.date}
      </span>
      <span className="font-mono text-[14px] font-semibold" style={{ color: 'var(--text)' }}>
        {dateTime.time}
      </span>
      <span className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
        {dateTime.ampm}
      </span>
    </div>
  )
}
