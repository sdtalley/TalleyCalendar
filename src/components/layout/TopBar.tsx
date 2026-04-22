'use client'

import { Clock } from './Clock'
import { WeatherWidget } from './WeatherWidget'

interface TopBarProps {
  rightSlot?: React.ReactNode
}

export function TopBar({ rightSlot }: TopBarProps) {
  return (
    <header
      className="flex-shrink-0 z-10 flex items-center justify-between px-4"
      style={{
        height: 48,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div className="font-bold text-base tracking-tight" style={{ color: 'var(--accent)' }}>
        FamilyHub{' '}
        <span className="font-normal" style={{ color: 'var(--text-dim)' }}>
          Calendar
        </span>
      </div>

      <div className="flex items-center gap-3">
        <WeatherWidget />
        <Clock />
      </div>

      {rightSlot && <div className="flex items-center gap-2">{rightSlot}</div>}
    </header>
  )
}
