'use client'

export function TasksTab() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: 'var(--text-dim)' }}>
      <span style={{ fontSize: 48 }}>✅</span>
      <div className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Tasks</div>
      <div className="text-sm">Chores &amp; routines — coming in Phase 3B</div>
    </div>
  )
}
