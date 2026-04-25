'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type {
  Chore, ChoreCompletion,
  Routine, RoutineCompletion,
  FamilyMember, SessionPayload,
} from '@/lib/calendar/types'

const SECTION_DEFS = [
  { id: 'morning',   label: 'Morning',   emoji: '🌅', color: '#fbbf24' },
  { id: 'afternoon', label: 'Afternoon', emoji: '☀️', color: '#34d399' },
  { id: 'evening',   label: 'Evening',   emoji: '🌙', color: '#818cf8' },
  { id: 'chores',    label: 'Chores',    emoji: '📋', color: '#60a5fa' },
] as const
type SectionId = typeof SECTION_DEFS[number]['id']

function getCurrentSection(): Exclude<SectionId, 'chores'> {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  return 'evening'
}

function memberInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function memberDisplayAvatar(member: FamilyMember): string {
  if (member.avatar?.type === 'emoji') return member.avatar.value
  if (member.avatar?.type === 'initials') return member.avatar.value
  return memberInitials(member.name)
}

function routineIsActiveOnDate(routine: Routine, date: string): boolean {
  if (routine.endDate && date > routine.endDate) return false
  if (routine.repeat === 'daily') return true
  const days = (routine.repeat as { weekly: number[] }).weekly
  const dow = new Date(date + 'T12:00:00').getDay()
  return days.includes(dow)
}

function choreIsActiveOnDate(chore: Chore, date: string): boolean {
  if (!chore.date && !chore.repeat) return true
  const { repeat } = chore
  const startDate = chore.date ?? chore.createdAt.slice(0, 10)
  if (!repeat) return chore.date === date
  if (date < startDate) return false
  if (repeat.endDate && date > repeat.endDate) return false
  if (chore.exceptions?.includes(date)) return false
  const d = new Date(date + 'T12:00:00')
  const s = new Date(startDate + 'T12:00:00')
  const dayDiff = Math.round((d.getTime() - s.getTime()) / 86_400_000)
  switch (repeat.frequency) {
    case 'daily': return dayDiff % repeat.interval === 0
    case 'weekly': {
      const weekDiff = Math.floor(dayDiff / 7)
      if (weekDiff % repeat.interval !== 0) return false
      if (repeat.daysOfWeek?.length) return repeat.daysOfWeek.includes(d.getDay())
      return d.getDay() === s.getDay()
    }
    case 'monthly': {
      const mDiff = (d.getFullYear() - s.getFullYear()) * 12 + (d.getMonth() - s.getMonth())
      if (mDiff % repeat.interval !== 0) return false
      return d.getDate() === s.getDate()
    }
    default: return false
  }
}

// ── Completion Ring ──────────────────────────────────────────────────────────

function CompletionRing({ done, total, color, size = 34 }: {
  done: number; total: number; color: string; size?: number
}) {
  const sw = 3
  const r = (size - sw * 2) / 2
  const circ = 2 * Math.PI * r
  const frac = total === 0 ? 0 : done / total
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={sw} />
      {total > 0 && (
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={sw}
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - frac)}
          strokeLinecap="round"
        />
      )}
    </svg>
  )
}

// ── Task Row ─────────────────────────────────────────────────────────────────

interface TaskRowProps {
  emoji:        string
  title:        string
  isDone:       boolean
  isSkipped:    boolean
  isBusy:       boolean
  sectionColor: string
  onComplete:   () => void
  onUncomplete: () => void
  onSkip:       () => void
  onUnskip:     () => void
  onEdit?:      () => void
}

function TaskRow({
  emoji, title, isDone, isSkipped, isBusy, sectionColor,
  onComplete, onUncomplete, onSkip, onUnskip, onEdit,
}: TaskRowProps) {
  const [celebrating, setCelebrating] = useState(false)
  const [showSkipMenu, setShowSkipMenu] = useState(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleCircleClick = async () => {
    if (isBusy) return
    setShowSkipMenu(false)
    if (isDone) {
      onUncomplete()
    } else if (isSkipped) {
      onUnskip()
    } else {
      setCelebrating(true)
      onComplete()
      setTimeout(() => setCelebrating(false), 600)
    }
  }

  const handlePointerDown = () => {
    longPressTimer.current = setTimeout(() => setShowSkipMenu(true), 500)
  }
  const handlePointerUp = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
  }

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 6px', borderRadius: 8, position: 'relative',
        background: isDone ? 'var(--surface)' : 'transparent',
        opacity: isSkipped ? 0.5 : 1, transition: 'opacity 0.2s',
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <span style={{ fontSize: 16, flexShrink: 0 }}>{emoji}</span>
      <span style={{
        flex: 1, fontSize: 13, fontWeight: 500,
        color: isDone || isSkipped ? 'var(--text-dim)' : 'var(--text)',
        textDecoration: isSkipped ? 'line-through' : 'none',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{title}</span>

      {onEdit && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onEdit() }}
          style={{
            background: 'none', border: 'none', fontSize: 11,
            color: 'var(--text-faint)', cursor: 'pointer', padding: '2px 4px', flexShrink: 0,
          }}
        >✏️</button>
      )}

      <button
        type="button"
        onClick={handleCircleClick}
        disabled={isBusy}
        style={{
          width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
          border: isDone ? 'none' : `2px solid ${isSkipped ? 'var(--border)' : 'var(--border)'}`,
          background: isDone ? sectionColor : 'transparent',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, color: isDone ? '#fff' : 'var(--text-faint)',
          transition: 'all 0.15s', opacity: isBusy ? 0.5 : 1,
        }}
      >
        {isDone ? '✓' : isSkipped ? '−' : ''}
      </button>

      {celebrating && (
        <div style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
          <span style={{ fontSize: 14 }}>✨</span>
        </div>
      )}

      {showSkipMenu && (
        <div
          style={{
            position: 'absolute', right: 36, top: '50%', transform: 'translateY(-50%)',
            background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: 8, boxShadow: 'var(--shadow)', zIndex: 20, overflow: 'hidden',
          }}
          onClick={e => e.stopPropagation()}
        >
          <button type="button"
            onClick={() => { setShowSkipMenu(false); onSkip() }}
            style={{
              display: 'block', width: '100%', padding: '8px 16px', background: 'none',
              border: 'none', color: 'var(--text)', fontSize: 13, cursor: 'pointer',
              textAlign: 'left', whiteSpace: 'nowrap',
            }}>Skip today</button>
          <button type="button"
            onClick={() => setShowSkipMenu(false)}
            style={{
              display: 'block', width: '100%', padding: '8px 16px', background: 'none',
              border: 'none', color: 'var(--text-dim)', fontSize: 13, cursor: 'pointer', textAlign: 'left',
            }}>Cancel</button>
        </div>
      )}
    </div>
  )
}

// ── TasksDayView ─────────────────────────────────────────────────────────────

export interface TasksDayViewProps {
  viewDate:      string
  members:       FamilyMember[]
  filterIds:     string[]
  session:       SessionPayload | null
  isAdmin:       boolean
  refreshKey:    number
  onEditChore:   (chore: Chore) => void
  onEditRoutine: (routine: Routine) => void
}

export function TasksDayView({
  viewDate, members, filterIds, session, isAdmin, refreshKey, onEditChore, onEditRoutine,
}: TasksDayViewProps) {
  const [chores,    setChores]    = useState<Chore[]>([])
  const [cComp,     setCComp]     = useState<Record<string, ChoreCompletion | null>>({})
  const [routines,  setRoutines]  = useState<Routine[]>([])
  const [rComp,     setRComp]     = useState<Record<string, RoutineCompletion | null>>({})
  const [loading,   setLoading]   = useState(true)
  const [collapsed, setCollapsed] = useState<Record<string, Set<SectionId>>>({})
  const [busy,      setBusy]      = useState<Record<string, boolean>>({})
  const [initDone,  setInitDone]  = useState(false)

  useEffect(() => {
    if (!initDone && members.length > 0) {
      const cur = getCurrentSection()
      const initial: Record<string, Set<SectionId>> = {}
      members.forEach(m => {
        const s = new Set<SectionId>()
        if (cur !== 'morning')   s.add('morning')
        if (cur !== 'afternoon') s.add('afternoon')
        if (cur !== 'evening')   s.add('evening')
        initial[m.id] = s
      })
      setCollapsed(initial)
      setInitDone(true)
    }
  }, [members, initDone])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cRes, rRes] = await Promise.all([
        fetch(`/api/chores?date=${viewDate}`),
        fetch(`/api/routines?date=${viewDate}`),
      ])
      const [cData, rData] = await Promise.all([cRes.json(), rRes.json()])
      setChores(cData.chores ?? [])
      setCComp(cData.completions ?? {})
      setRoutines(rData.routines ?? [])
      setRComp(rData.completions ?? {})
    } finally {
      setLoading(false)
    }
  }, [viewDate])

  useEffect(() => { load() }, [load, refreshKey])

  const toggleSection = (memberId: string, sid: SectionId) => {
    setCollapsed(prev => {
      const m = new Set(prev[memberId] ?? [])
      m.has(sid) ? m.delete(sid) : m.add(sid)
      return { ...prev, [memberId]: m }
    })
  }

  const setBusyFor = (id: string, val: boolean) =>
    setBusy(prev => ({ ...prev, [id]: val }))

  // ── Completion actions ────────────────────────────────────────────────────

  const completeChore = useCallback(async (id: string, memberId?: string) => {
    setBusyFor(id, true)
    const res = await fetch(`/api/chores/${id}/complete`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: viewDate, memberId }),
    })
    if (res.ok) { const { completion } = await res.json(); setCComp(p => ({ ...p, [id]: completion })) }
    setBusyFor(id, false)
  }, [viewDate])

  const uncompleteChore = useCallback(async (id: string) => {
    setBusyFor(id, true)
    await fetch(`/api/chores/${id}/complete`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: viewDate }),
    })
    setCComp(p => ({ ...p, [id]: null }))
    setBusyFor(id, false)
  }, [viewDate])

  const skipChore = useCallback(async (id: string, memberId?: string) => {
    setBusyFor(id, true)
    const res = await fetch(`/api/chores/${id}/skip`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: viewDate, memberId }),
    })
    if (res.ok) { const { completion } = await res.json(); setCComp(p => ({ ...p, [id]: completion })) }
    setBusyFor(id, false)
  }, [viewDate])

  const unskipChore = useCallback(async (id: string) => {
    setBusyFor(id, true)
    await fetch(`/api/chores/${id}/unskip`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: viewDate }),
    })
    setCComp(p => ({ ...p, [id]: null }))
    setBusyFor(id, false)
  }, [viewDate])

  const completeRoutine = useCallback(async (id: string, memberId?: string) => {
    setBusyFor(id, true)
    const res = await fetch(`/api/routines/${id}/complete`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: viewDate, memberId }),
    })
    if (res.ok) { const { completion } = await res.json(); setRComp(p => ({ ...p, [id]: completion })) }
    setBusyFor(id, false)
  }, [viewDate])

  const uncompleteRoutine = useCallback(async (id: string) => {
    setBusyFor(id, true)
    await fetch(`/api/routines/${id}/complete`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: viewDate }),
    })
    setRComp(p => ({ ...p, [id]: null }))
    setBusyFor(id, false)
  }, [viewDate])

  const skipRoutine = useCallback(async (id: string, memberId?: string) => {
    setBusyFor(id, true)
    const res = await fetch(`/api/routines/${id}/skip`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: viewDate, memberId }),
    })
    if (res.ok) { const { completion } = await res.json(); setRComp(p => ({ ...p, [id]: completion })) }
    setBusyFor(id, false)
  }, [viewDate])

  const unskipRoutine = useCallback(async (id: string) => {
    setBusyFor(id, true)
    await fetch(`/api/routines/${id}/unskip`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: viewDate }),
    })
    setRComp(p => ({ ...p, [id]: null }))
    setBusyFor(id, false)
  }, [viewDate])

  // ── Render ────────────────────────────────────────────────────────────────

  const visibleMembers = filterIds.length > 0
    ? members.filter(m => filterIds.includes(m.id))
    : members

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
      Loading…
    </div>
  )

  if (visibleMembers.length === 0) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 32 }}>👥</span>
      <div>No profiles match the filter</div>
    </div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', overflowX: 'auto', overflowY: 'hidden', alignItems: 'stretch' }}>
      {visibleMembers.map(member => {
        const memberCollapsed = collapsed[member.id] ?? new Set<SectionId>()
        const memberId = session?.memberId ?? undefined

        const morningRoutines = routines
          .filter(r => routineIsActiveOnDate(r, viewDate) && r.memberIds.includes(member.id) &&
            (r.timeBlocks ?? (r.timeBlock ? [r.timeBlock] : [])).includes('morning'))
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title))

        const afternoonRoutines = routines
          .filter(r => routineIsActiveOnDate(r, viewDate) && r.memberIds.includes(member.id) &&
            (r.timeBlocks ?? (r.timeBlock ? [r.timeBlock] : [])).includes('afternoon'))
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title))

        const eveningRoutines = routines
          .filter(r => routineIsActiveOnDate(r, viewDate) && r.memberIds.includes(member.id) &&
            (r.timeBlocks ?? (r.timeBlock ? [r.timeBlock] : [])).includes('evening'))
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title))

        const memberChores = chores
          .filter(c => choreIsActiveOnDate(c, viewDate) && c.memberIds.includes(member.id))
          .sort((a, b) => {
            const aDone = cComp[a.id]?.status === 'complete'
            const bDone = cComp[b.id]?.status === 'complete'
            if (aDone !== bDone) return aDone ? 1 : -1
            if (a.time && b.time) return a.time.localeCompare(b.time)
            if (a.time) return -1
            if (b.time) return 1
            return a.title.localeCompare(b.title)
          })

        const mDone = morningRoutines.filter(r => rComp[r.id]?.status === 'complete').length
        const aDone = afternoonRoutines.filter(r => rComp[r.id]?.status === 'complete').length
        const eDone = eveningRoutines.filter(r => rComp[r.id]?.status === 'complete').length
        const cDone = memberChores.filter(c => cComp[c.id]?.status === 'complete').length
        const totalDone = mDone + aDone + eDone + cDone
        const totalAll  = morningRoutines.length + afternoonRoutines.length + eveningRoutines.length + memberChores.length

        const sections = [
          { id: 'morning'   as SectionId, label: 'Morning',   color: '#fbbf24', emoji: '🌅', done: mDone, total: morningRoutines.length,   tasks: morningRoutines,   type: 'routine' as const },
          { id: 'afternoon' as SectionId, label: 'Afternoon', color: '#34d399', emoji: '☀️', done: aDone, total: afternoonRoutines.length, tasks: afternoonRoutines, type: 'routine' as const },
          { id: 'evening'   as SectionId, label: 'Evening',   color: '#818cf8', emoji: '🌙', done: eDone, total: eveningRoutines.length,   tasks: eveningRoutines,   type: 'routine' as const },
          { id: 'chores'    as SectionId, label: 'Chores',    color: '#60a5fa', emoji: '📋', done: cDone, total: memberChores.length,      tasks: memberChores as (Routine | Chore)[], type: 'chore' as const },
        ]

        const avatarDisplay = memberDisplayAvatar(member)
        const isEmojiAvatar = member.avatar?.type === 'emoji'

        return (
          <div key={member.id} style={{
            minWidth: 210, maxWidth: 300, flex: '1 0 210px',
            borderRight: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', background: 'var(--bg)',
          }}>
            {/* Column header */}
            <div style={{
              padding: '12px 14px 10px', borderBottom: '1px solid var(--border)',
              background: 'var(--surface)', flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', background: member.color,
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: isEmojiAvatar ? 18 : 13, fontWeight: 700, flexShrink: 0,
                }}>
                  {avatarDisplay}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {member.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    {totalDone}/{totalAll} done
                  </div>
                </div>
              </div>

              {/* Section icons with completion rings */}
              <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                {sections.map(s => {
                  const isCollapsed = memberCollapsed.has(s.id)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSection(member.id, s.id)}
                      title={`${s.label} (${s.done}/${s.total})`}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                        position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: isCollapsed ? 0.35 : 1, transition: 'opacity 0.15s',
                      }}
                    >
                      <CompletionRing done={s.done} total={s.total} color={s.color} size={34} />
                      <span style={{ position: 'absolute', fontSize: 14, lineHeight: 1 }}>{s.emoji}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Task sections */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {sections.map(s => {
                if (memberCollapsed.has(s.id)) return null
                if (s.tasks.length === 0) return null
                return (
                  <div key={s.id}>
                    <div style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                      color: s.color, textTransform: 'uppercase', padding: '8px 6px 3px',
                    }}>{s.label}</div>
                    {s.tasks.map(task => {
                      if (s.type === 'routine') {
                        const r = task as Routine
                        const comp = rComp[r.id]
                        return (
                          <TaskRow
                            key={r.id}
                            emoji={r.emoji ?? '🔄'}
                            title={r.title}
                            isDone={comp?.status === 'complete'}
                            isSkipped={comp?.status === 'skipped'}
                            isBusy={!!busy[r.id]}
                            sectionColor={s.color}
                            onComplete={() => completeRoutine(r.id, memberId)}
                            onUncomplete={() => uncompleteRoutine(r.id)}
                            onSkip={() => skipRoutine(r.id, memberId)}
                            onUnskip={() => unskipRoutine(r.id)}
                            onEdit={isAdmin ? () => onEditRoutine(r) : undefined}
                          />
                        )
                      } else {
                        const c = task as Chore
                        const comp = cComp[c.id]
                        return (
                          <TaskRow
                            key={c.id}
                            emoji={c.emoji ?? '✅'}
                            title={c.title}
                            isDone={comp?.status === 'complete'}
                            isSkipped={comp?.status === 'skipped'}
                            isBusy={!!busy[c.id]}
                            sectionColor={s.color}
                            onComplete={() => completeChore(c.id, memberId)}
                            onUncomplete={() => uncompleteChore(c.id)}
                            onSkip={() => skipChore(c.id, memberId)}
                            onUnskip={() => unskipChore(c.id)}
                            onEdit={isAdmin ? () => onEditChore(c) : undefined}
                          />
                        )
                      }
                    })}
                  </div>
                )
              })}

              {totalAll === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-faint)', fontSize: 12, marginTop: 20, padding: '0 8px' }}>
                  Nothing today
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
