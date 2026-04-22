'use client'

import Link from 'next/link'

export type TabId = 'calendar' | 'tasks' | 'rewards' | 'meals' | 'lists' | 'sleep'

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'calendar', label: 'Calendar', icon: '🗓' },
  { id: 'tasks',    label: 'Tasks',    icon: '✅' },
  { id: 'rewards',  label: 'Stars',    icon: '⭐' },
  { id: 'meals',    label: 'Meals',    icon: '🍽' },
  { id: 'lists',    label: 'Lists',    icon: '📋' },
  { id: 'sleep',    label: 'Sleep',    icon: '🌙' },
]

interface NavSidebarProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}

export function NavSidebar({ activeTab, onTabChange }: NavSidebarProps) {
  return (
    // Mobile: full-width bottom bar (h-[60px], border-t)
    // Desktop: left column (w-[72px], h-full, border-r)
    // order-last on mobile → below content; md:order-first on desktop → left of content
    <nav
      className={[
        'flex-shrink-0 flex flex-row md:flex-col',
        'order-last md:order-first',
        'w-full md:w-[72px]',
        'h-[60px] md:h-auto',
        'border-t md:border-t-0 md:border-r',
        'z-20',
      ].join(' ')}
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Scrollable tab list */}
      <div className="flex flex-row md:flex-col flex-1 overflow-x-auto md:overflow-x-visible overflow-y-hidden md:overflow-y-auto">
        {TABS.map(tab => {
          const active = tab.id === activeTab
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              title={tab.label}
              className="relative flex flex-col items-center justify-center gap-[3px] flex-1 md:flex-none cursor-pointer transition-colors duration-150 border-none"
              style={{
                minWidth: 56,
                height: 60,
                background: active ? 'var(--accent-glow)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-dim)',
              }}
              onMouseEnter={e => {
                if (!active) e.currentTarget.style.background = 'var(--surface2)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = active ? 'var(--accent-glow)' : 'transparent'
              }}
            >
              {/* Active indicator: left bar on desktop, top bar on mobile */}
              {active && (
                <span
                  className="absolute md:left-0 md:inset-y-2 md:w-[3px] md:h-auto bottom-0 inset-x-3 h-[3px] w-auto md:rounded-r-full rounded-t-full"
                  style={{ background: 'var(--accent)' }}
                />
              )}
              <span style={{ fontSize: 20, lineHeight: 1 }}>{tab.icon}</span>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Settings — pinned to right (mobile) / bottom (desktop) */}
      <Link
        href="/settings"
        title="Settings"
        className="relative flex flex-col items-center justify-center gap-[3px] flex-shrink-0 cursor-pointer transition-colors duration-150 no-underline"
        style={{
          minWidth: 56,
          height: 60,
          color: 'var(--text-dim)',
          background: 'transparent',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'var(--surface2)'
          e.currentTarget.style.color = 'var(--text)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = 'var(--text-dim)'
        }}
      >
        <span style={{ fontSize: 20, lineHeight: 1 }}>⚙</span>
        <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Settings
        </span>
      </Link>
    </nav>
  )
}
