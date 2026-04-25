'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
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

// ── Date helpers ──────────────────────────────────────────────────────────────

function getWeekDays(viewDate: string): string[] {
  const d = new Date(viewDate + 'T12:00:00')
  const dow = d.getDay()
  const mondayOffset = dow === 0 ? -6 : 1 - dow
  const monday = new Date(d)
  monday.setDate(d.getDate() + mondayOffset)
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday)
    day.setDate(monday.getDate() + i)
    return day.toISOString().slice(0, 10)
  })
}

function dayHeader(date: string): { dow: string; num: number } {
  const d = new Date(date + 'T12:00:00')
  const dayOfWeek = d.getDay()
  const dowLabel = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek]
  return { dow: dowLabel, num: d.getDate() }
}

// ── Active checks ─────────────────────────────────────────────────────────────

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

// ── Day data types ────────────────────────────────────────────────────────────

type DayData = {
  cComp: Record<string, ChoreCompletion | null>
  rComp: Record<string, RoutineCompletion | null>
}

// ── TasksWeekView ─────────────────────────────────────────────────────────────

export interface TasksWeekViewProps {
  viewDate:   string
  members:    FamilyMember[]
  filterIds:  string[]
  session:    SessionPayload | null
  isAdmin:    boolean
  refreshKey: number
}

export function TasksWeekView({
  viewDate, members, filterIds, session, isAdmin, refreshKey,
}: TasksWeekViewProps) {
  const [selectedMemberId,  setSelectedMemberId]  = useState('')
  const [chores,            setChores]            = useState<Chore[]>([])
  const [routines,          setRoutines]          = useState<Routine[]>([])
  const [dayData,           setDayData]           = useState<Record<string, DayData>>({})
  const [loading,           setLoading]           = useState(true)
  const [hiddenSections,    setHiddenSections]    = useState<Set<SectionId>>(new Set())
  const [busy,              setBusy]              = useState<Record<string, Record<string, boolean>>>({})

  const todayStr = new Date().toISOString().slice(0, 10)
  const weekDays = getWeekDays(viewDate)

  // Default selected member: session member or first
  useEffect(() => {
    if (members.length === 0) return
    if (selectedMemberId && members.find(m => m.id === selectedMemberId)) return
    const sessionMember = session?.memberId
    setSelectedMemberId(
      sessionMember && members.find(m => m.id === sessionMember) ? sessionMember : members[0].id
    )
  }, [members, session, selectedMemberId])

  // Respect filterIds: if selected member is filtered out, switch to first visible
  const visibleMembers = filterIds.length > 0 ? members.filter(m => filterIds.includes(m.id)) : members
  useEffect(() => {
    if (visibleMembers.length > 0 && !visibleMembers.find(m => m.id === selectedMemberId)) {
      setSelectedMemberId(visibleMembers[0].id)
    }
  }, [visibleMembers, selectedMemberId])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const days = getWeekDays(viewDate)
      const results = await Promise.all(
        days.map(d => Promise.all([
          fetch(`/api/chores?date=${d}`).then(r => r.json()),
          fetch(`/api/routines?date=${d}`).then(r => r.json()),
        ]))
      )

      const allChores = new Map<string, Chore>()
      const allRoutines = new Map<string, Routine>()
      const newDayData: Record<string, DayData> = {}

      results.forEach(([cRes, rRes], i) => {
        const day = days[i];
        (cRes.chores ?? []).forEach((c: Chore) => allChores.set(c.id, c));
        (rRes.routines ?? []).forEach((r: Routine) => allRoutines.set(r.id, r))
        newDayData[day] = {
          cComp: cRes.completions ?? {},
          rComp: rRes.completions ?? {},
        }
      })

      setChores(Array.from(allChores.values()))
      setRoutines(Array.from(allRoutines.values()))
      setDayData(newDayData)
    } finally {
      setLoading(false)
    }
  }, [viewDate])

  useEffect(() => { load() }, [load, refreshKey])

  const toggleSection = (id: SectionId) => {
    setHiddenSections(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleComplete = useCallback(async (
    type: 'chore' | 'routine', id: string, date: string
  ) => {
    const comp = type === 'chore' ? dayData[date]?.cComp[id] : dayData[date]?.rComp[id]
    const isDone = comp?.status === 'complete'

    setBusy(prev => ({ ...prev, [date]: { ...(prev[date] ?? {}), [id]: true } }))
    const base = type === 'chore' ? `/api/chores/${id}` : `/api/routines/${id}`
    const compKey = type === 'chore' ? 'cComp' : 'rComp'

    try {
      if (isDone) {
        await fetch(`${base}/complete`, {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date }),
        })
        setDayData(prev => ({
          ...prev,
          [date]: { ...prev[date], [compKey]: { ...(prev[date]?.[compKey] ?? {}), [id]: null } },
        }))
      } else {
        const res = await fetch(`${base}/complete`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date, memberId: session?.memberId }),
        })
        if (res.ok) {
          const { completion } = await res.json()
          setDayData(prev => ({
            ...prev,
            [date]: { ...prev[date], [compKey]: { ...(prev[date]?.[compKey] ?? {}), [id]: completion } },
          }))
        }
      }
    } finally {
      setBusy(prev => ({ ...prev, [date]: { ...(prev[date] ?? {}), [id]: false } }))
    }
  }, [dayData, session?.memberId])

  // ── Build task rows for selected member ───────────────────────────────────

  const selectedMember = members.find(m => m.id === selectedMemberId)
  const memberRoutines = routines.filter(r => r.memberIds.includes(selectedMemberId))
  const memberChores   = chores.filter(c => c.memberIds.includes(selectedMemberId))

  const sectionRows: {
    section: SectionId
    label: string
    color: string
    tasks: Array<{ type: 'routine' | 'chore'; item: Routine | Chore }>
  }[] = [
    {
      section: 'morning', label: 'Morning', color: '#fbbf24',
      tasks: memberRoutines
        .filter(r => (r.timeBlocks ?? (r.timeBlock ? [r.timeBlock] : [])).includes('morning'))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title))
        .map(r => ({ type: 'routine' as const, item: r })),
    },
    {
      section: 'afternoon', label: 'Afternoon', color: '#34d399',
      tasks: memberRoutines
        .filter(r => (r.timeBlocks ?? (r.timeBlock ? [r.timeBlock] : [])).includes('afternoon'))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title))
        .map(r => ({ type: 'routine' as const, item: r })),
    },
    {
      section: 'evening', label: 'Evening', color: '#818cf8',
      tasks: memberRoutines
        .filter(r => (r.timeBlocks ?? (r.timeBlock ? [r.timeBlock] : [])).includes('evening'))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title))
        .map(r => ({ type: 'routine' as const, item: r })),
    },
    {
      section: 'chores', label: 'Chores', color: '#60a5fa',
      tasks: memberChores
        .sort((a, b) => a.title.localeCompare(b.title))
        .map(c => ({ type: 'chore' as const, item: c })),
    },
  ]

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
      Loading…
    </div>
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Profile selector + section filters */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
        borderBottom: '1px solid var(--border)', background: 'var(--surface)',
        overflowX: 'auto', flexShrink: 0,
      }}>
        {visibleMembers.map(m => {
          const isSelected = m.id === selectedMemberId
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedMemberId(m.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 20, fontSize: 13,
                background: isSelected ? `${m.color}22` : 'var(--surface2)',
                border: `2px solid ${isSelected ? m.color : 'var(--border)'}`,
                color: isSelected ? m.color : 'var(--text-dim)',
                fontWeight: isSelected ? 600 : 400,
                cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, display: 'inline-block' }} />
              {m.name}
            </button>
          )
        })}

        {/* Section filter icons */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, flexShrink: 0 }}>
          {SECTION_DEFS.map(s => {
            const hidden = hiddenSections.has(s.id)
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleSection(s.id)}
                title={hidden ? `Show ${s.label}` : `Hide ${s.label}`}
                style={{
                  background: hidden ? 'var(--surface2)' : `${s.color}22`,
                  border: `1.5px solid ${hidden ? 'var(--border)' : s.color}`,
                  borderRadius: 8, padding: '4px 8px', cursor: 'pointer', fontSize: 14,
                  opacity: hidden ? 0.5 : 1, transition: 'all 0.15s',
                }}
              >{s.emoji}</button>
            )
          })}
        </div>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
          <colgroup>
            <col style={{ width: 160 }} />
            {weekDays.map(d => <col key={d} />)}
          </colgroup>
          <thead>
            <tr style={{ position: 'sticky', top: 0, zIndex: 5 }}>
              <th style={{
                padding: '10px 14px', textAlign: 'left', fontSize: 11,
                color: 'var(--text-dim)', fontWeight: 600,
                borderBottom: '1px solid var(--border)', background: 'var(--surface)',
              }}>
                {selectedMember?.name ?? ''}
              </th>
              {weekDays.map(d => {
                const { dow, num } = dayHeader(d)
                const isToday = d === todayStr
                return (
                  <th key={d} style={{
                    padding: '8px 6px', textAlign: 'center', fontSize: 11,
                    borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)',
                    background: isToday ? 'var(--surface2)' : 'var(--surface)',
                    color: isToday ? 'var(--accent)' : 'var(--text-dim)',
                    fontWeight: isToday ? 700 : 600, minWidth: 46,
                  }}>
                    <div>{dow}</div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{num}</div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sectionRows.map(({ section, label, color, tasks }) => {
              if (hiddenSections.has(section)) return null
              if (tasks.length === 0) return null

              const visibleTasks = tasks.filter(({ type, item }) =>
                weekDays.some(d =>
                  type === 'routine'
                    ? routineIsActiveOnDate(item as Routine, d)
                    : choreIsActiveOnDate(item as Chore, d)
                )
              )
              if (visibleTasks.length === 0) return null

              return (
                <Fragment key={section}>
                  <tr>
                    <td colSpan={8} style={{
                      padding: '8px 14px 4px', fontSize: 10, fontWeight: 700,
                      letterSpacing: '0.08em', color, textTransform: 'uppercase',
                      background: `${color}11`, borderTop: '1px solid var(--border)',
                    }}>{label}</td>
                  </tr>

                  {visibleTasks.map(({ type, item }) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>

                      <td style={{
                        padding: '8px 14px', fontSize: 12, fontWeight: 500,
                        color: 'var(--text)', whiteSpace: 'nowrap',
                        overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160,
                      }}>
                        {(item as Routine).emoji ?? (type === 'chore' ? '✅' : '🔄')} {item.title}
                      </td>
                      {weekDays.map(d => {
                        const isActive = type === 'routine'
                          ? routineIsActiveOnDate(item as Routine, d)
                          : choreIsActiveOnDate(item as Chore, d)
                        const comp = type === 'routine'
                          ? dayData[d]?.rComp[item.id]
                          : dayData[d]?.cComp[item.id]
                        const isDone    = comp?.status === 'complete'
                        const isSkipped = comp?.status === 'skipped'
                        const isBusy    = !!busy[d]?.[item.id]
                        const isToday   = d === todayStr

                        return (
                          <td key={d} style={{
                            padding: '6px', textAlign: 'center',
                            borderLeft: '1px solid var(--border)',
                            background: isToday ? 'var(--surface2)' : 'transparent',
                          }}>
                            {isActive ? (
                              <button
                                type="button"
                                onClick={() => toggleComplete(type, item.id, d)}
                                disabled={isBusy}
                                title={isDone ? 'Tap to uncomplete' : 'Tap to complete'}
                                style={{
                                  width: 28, height: 28, borderRadius: '50%',
                                  border: isDone ? 'none' : '2px solid var(--border)',
                                  background: isDone ? color : isSkipped ? 'var(--surface2)' : 'transparent',
                                  cursor: 'pointer', display: 'inline-flex',
                                  alignItems: 'center', justifyContent: 'center',
                                  fontSize: 12, color: isDone ? '#fff' : 'var(--text-faint)',
                                  transition: 'all 0.15s', opacity: isBusy ? 0.5 : 1,
                                }}
                              >
                                {isDone ? '✓' : isSkipped ? '−' : ''}
                              </button>
                            ) : (
                              <span style={{ color: 'var(--text-faint)', fontSize: 14 }}>—</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
