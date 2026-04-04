'use client'

import type { FamilyMemberUI } from '@/lib/calendar/types'
import { MiniCalendar } from '@/components/calendar/MiniCalendar'

interface SidebarProps {
  familyMembers: FamilyMemberUI[]
  calTypes: { id: string; name: string; enabled: boolean }[]
  selectedDate: Date
  onToggleMember: (id: string) => void
  onToggleCalType: (id: string) => void
  onSelectDate: (date: Date) => void
}

export function Sidebar({
  familyMembers,
  calTypes,
  selectedDate,
  onToggleMember,
  onToggleCalType,
  onSelectDate,
}: SidebarProps) {
  return (
    <aside
      className="flex flex-col gap-5 p-4 flex-shrink-0 overflow-y-auto"
      style={{
        width: 220,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* Mini Calendar */}
      <div
        className="pb-3 mb-1"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <MiniCalendar selectedDate={selectedDate} onSelectDate={onSelectDate} />
      </div>

      {/* Family */}
      <div>
        <div className="section-title">Family</div>
        <div className="flex flex-col gap-1">
          {familyMembers.map(member => (
            <button
              key={member.id}
              onClick={() => onToggleMember(member.id)}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-[8px] text-left w-full border-none cursor-pointer transition-all duration-150"
              style={{
                background: 'transparent',
                opacity: member.enabled ? 1 : 0.35,
              }}
              onMouseEnter={e =>
                (e.currentTarget.style.background = 'var(--surface2)')
              }
              onMouseLeave={e =>
                (e.currentTarget.style.background = 'transparent')
              }
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0 transition-all duration-150"
                style={{
                  background: member.enabled ? member.color : 'var(--text-faint)',
                }}
              />
              <div>
                <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                  {member.name}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Calendar Types */}
      <div>
        <div className="section-title">Calendar Type</div>
        <div className="flex flex-col gap-1">
          {calTypes.map(ct => (
            <button
              key={ct.id}
              onClick={() => onToggleCalType(ct.id)}
              className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-[8px] text-[13px] text-left w-full border-none cursor-pointer transition-all duration-150"
              style={{
                background: 'transparent',
                color: 'var(--text-dim)',
                opacity: ct.enabled ? 1 : 0.35,
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
              <span
                className="w-4 h-4 rounded flex items-center justify-center text-[10px] flex-shrink-0 transition-all duration-150"
                style={{
                  background: ct.enabled ? 'var(--accent)' : 'transparent',
                  border: ct.enabled ? '2px solid var(--accent)' : '2px solid var(--border)',
                  color: '#fff',
                }}
              >
                {ct.enabled && '✓'}
              </span>
              {ct.name}
            </button>
          ))}
        </div>
      </div>
    </aside>
  )
}
