'use client'

import { Clock } from './Clock'
import { WeatherWidget } from './WeatherWidget'

interface InfoBarProps {
  rightSlot?: React.ReactNode
}

export function InfoBar({ rightSlot }: InfoBarProps) {
  return (
    <header
      className="flex-shrink-0 z-30 flex items-center px-4 gap-3"
      style={{
        height: 52,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Left: date + time + weather — always visible on all tabs */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <Clock />
        <WeatherWidget />
      </div>

      {/* Right: tab-specific controls — desktop only.
          No overflow-x-auto: clips absolutely-positioned dropdown popups. */}
      {rightSlot && (
        <div className="hidden md:flex items-center gap-2 flex-1 min-w-0">
          {rightSlot}
        </div>
      )}
    </header>
  )
}
