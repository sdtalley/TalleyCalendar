'use client'

export function SleepTab() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: 'var(--text-dim)' }}>
      <span style={{ fontSize: 48 }}>🌙</span>
      <div className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Sleep</div>
      <div className="text-sm">Sleep schedule &amp; display dimming — coming in Phase 3D</div>
    </div>
  )
}
