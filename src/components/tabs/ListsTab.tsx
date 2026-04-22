'use client'

export function ListsTab() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: 'var(--text-dim)' }}>
      <span style={{ fontSize: 48 }}>📋</span>
      <div className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Lists</div>
      <div className="text-sm">Shopping, to-do, and custom lists — coming in Phase 3B</div>
    </div>
  )
}
