'use client'

import { useState, useEffect, useCallback } from 'react'
import type {
  Chore, ChoreCompletion,
  Routine, RoutineCompletion, RoutineTimeBlock,
  FamilyMember, SessionPayload,
} from '@/lib/calendar/types'
import { ChoreCard } from '@/components/tasks/ChoreCard'
import { ChoreForm, type ChoreFormData } from '@/components/tasks/ChoreForm'
import { RoutineCard } from '@/components/tasks/RoutineCard'
import { RoutineForm, type RoutineFormData } from '@/components/tasks/RoutineForm'

type SubTab = 'chores' | 'routines'

// ── Date helpers ──────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().slice(0, 10)
}

function offsetDate(base: string, days: number) {
  const d = new Date(base + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function formatViewDate(date: string) {
  const d = new Date(date + 'T12:00:00')
  const t = today()
  if (date === t) return 'Today'
  if (date === offsetDate(t, 1)) return 'Tomorrow'
  if (date === offsetDate(t, -1)) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// ── Which chores are active on a given date ───────────────────────────────

function choreIsActiveOnDate(chore: Chore, date: string): boolean {
  if (!chore.date && !chore.repeat) return true  // undated, always show

  const { repeat } = chore
  const startDate = chore.date ?? chore.createdAt.slice(0, 10)

  if (!repeat) return chore.date === date

  if (date < startDate) return false
  if (repeat.endDate && date > repeat.endDate) return false

  const d = new Date(date + 'T12:00:00')
  const s = new Date(startDate + 'T12:00:00')
  const dayDiff = Math.round((d.getTime() - s.getTime()) / 86_400_000)

  switch (repeat.frequency) {
    case 'daily':
      return dayDiff % repeat.interval === 0

    case 'weekly': {
      const weekDiff = Math.floor(dayDiff / 7)
      if (weekDiff % repeat.interval !== 0) return false
      if (repeat.daysOfWeek && repeat.daysOfWeek.length > 0) {
        return repeat.daysOfWeek.includes(d.getDay())
      }
      return d.getDay() === s.getDay()
    }

    case 'monthly': {
      const monthDiff = (d.getFullYear() - s.getFullYear()) * 12 + (d.getMonth() - s.getMonth())
      if (monthDiff % repeat.interval !== 0) return false
      return d.getDate() === s.getDate()
    }

    default:
      return false
  }
}

// ── Component ─────────────────────────────────────────────────────────────

export function TasksTab() {
  const [subTab,      setSubTab]      = useState<SubTab>('chores')
  const [viewDate,    setViewDate]    = useState(today)
  const [chores,      setChores]      = useState<Chore[]>([])
  const [completions, setCompletions] = useState<Record<string, ChoreCompletion | null>>({})
  const [members,     setMembers]     = useState<FamilyMember[]>([])
  const [session,     setSession]     = useState<SessionPayload | null>(null)
  const [filterIds,   setFilterIds]   = useState<string[]>([])   // empty = all
  const [loading,     setLoading]     = useState(true)
  const [showForm,    setShowForm]    = useState(false)
  const [editChore,   setEditChore]   = useState<Chore | null>(null)

  const isAdmin = session?.role === 'admin'

  // Load session + members once
  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then(r => r.ok ? r.json() : null),
      fetch('/api/family').then(r => r.json()),
    ]).then(([sess, mems]) => {
      setSession(sess)
      setMembers(Array.isArray(mems) ? mems : [])
    })
  }, [])

  // Load chores + completions whenever viewDate changes
  const loadChores = useCallback(async (date: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/chores?date=${date}`)
      if (res.ok) {
        const { chores: c, completions: comp } = await res.json()
        setChores(c)
        setCompletions(comp)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadChores(viewDate) }, [viewDate, loadChores])

  // ── Filter logic ────────────────────────────────────────────────────────

  const toggleFilter = (id: string) => {
    setFilterIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const visibleChores = chores.filter(c => {
    if (filterIds.length > 0 && !c.memberIds.some(id => filterIds.includes(id))) return false
    return true
  })

  const t = today()
  const activeChores  = visibleChores.filter(c => choreIsActiveOnDate(c, viewDate))
  const overdueChores = visibleChores.filter(c =>
    c.date && c.date < viewDate && !choreIsActiveOnDate(c, viewDate) && !completions[c.id]
  )

  // Sort active: incomplete → complete; by time if set
  const sortedActive = [...activeChores].sort((a, b) => {
    const aDone = !!completions[a.id]
    const bDone = !!completions[b.id]
    if (aDone !== bDone) return aDone ? 1 : -1
    if (a.time && b.time) return a.time.localeCompare(b.time)
    if (a.time) return -1
    if (b.time) return 1
    return a.title.localeCompare(b.title)
  })

  // ── Completion actions ──────────────────────────────────────────────────

  const handleComplete = useCallback(async (choreId: string, date: string, memberId?: string) => {
    const res = await fetch(`/api/chores/${choreId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, memberId }),
    })
    if (res.ok) {
      const { completion } = await res.json()
      setCompletions(prev => ({ ...prev, [choreId]: completion }))
    }
  }, [])

  const handleUncomplete = useCallback(async (choreId: string, date: string) => {
    const res = await fetch(`/api/chores/${choreId}/complete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date }),
    })
    if (res.ok) {
      setCompletions(prev => ({ ...prev, [choreId]: null }))
    }
  }, [])

  const handleSkip = useCallback(async (choreId: string, date: string, memberId?: string) => {
    const res = await fetch(`/api/chores/${choreId}/skip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, memberId }),
    })
    if (res.ok) {
      const { completion } = await res.json()
      setCompletions(prev => ({ ...prev, [choreId]: completion }))
    }
  }, [])

  // ── Create / edit ───────────────────────────────────────────────────────

  const handleSaveChore = useCallback(async (data: ChoreFormData) => {
    if (editChore) {
      await fetch(`/api/chores/${editChore.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
    } else {
      await fetch('/api/chores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
    }
    setEditChore(null)
    setShowForm(false)
    await loadChores(viewDate)
  }, [editChore, viewDate, loadChores])

  const handleDeleteChore = useCallback(async () => {
    if (!editChore) return
    await fetch(`/api/chores/${editChore.id}`, { method: 'DELETE' })
    setEditChore(null)
    setShowForm(false)
    await loadChores(viewDate)
  }, [editChore, viewDate, loadChores])

  const openEdit = useCallback((chore: Chore) => {
    setEditChore(chore)
    setShowForm(true)
  }, [])

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
      background: 'var(--bg)',
    }}>
      {/* Sub-nav: Chores | Routines */}
      <div style={{
        display: 'flex', gap: 0, borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', flexShrink: 0,
      }}>
        {(['chores', 'routines'] as SubTab[]).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setSubTab(tab)}
            style={{
              padding: '12px 24px', fontSize: 14, fontWeight: subTab === tab ? 600 : 400,
              color: subTab === tab ? 'var(--accent)' : 'var(--text-dim)',
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: subTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1, textTransform: 'capitalize', transition: 'color 0.15s',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {subTab === 'routines' ? (
        <RoutinesView
          members={members}
          session={session}
          isAdmin={isAdmin}
        />
      ) : (
        <>
          {/* Date nav + member filter */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 16px', borderBottom: '1px solid var(--border)',
            background: 'var(--surface)', flexShrink: 0, gap: 12, flexWrap: 'wrap',
          }}>
            {/* Date navigation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button type="button" onClick={() => setViewDate(d => offsetDate(d, -1))}
                style={navBtn}>←</button>
              <button
                type="button"
                onClick={() => setViewDate(today())}
                style={{
                  fontSize: 14, fontWeight: 600,
                  color: viewDate === t ? 'var(--accent)' : 'var(--text)',
                  background: 'none', border: 'none', cursor: 'pointer', minWidth: 100, textAlign: 'center',
                }}
              >
                {formatViewDate(viewDate)}
              </button>
              <button type="button" onClick={() => setViewDate(d => offsetDate(d, 1))}
                style={navBtn}>→</button>
            </div>

            {/* Member filter chips */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {members.map(m => {
                const active = filterIds.includes(m.id)
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleFilter(m.id)}
                    style={{
                      padding: '5px 10px', borderRadius: 16, fontSize: 12,
                      background: active ? `${m.color}22` : 'var(--surface2)',
                      border: `1.5px solid ${active ? m.color : 'var(--border)'}`,
                      color: active ? m.color : 'var(--text-dim)',
                      cursor: 'pointer', fontWeight: active ? 600 : 400,
                      transition: 'all 0.15s',
                    }}
                  >
                    {m.name}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Chore list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {loading ? (
              <div style={{ color: 'var(--text-dim)', textAlign: 'center', marginTop: 40 }}>Loading…</div>
            ) : (
              <>
                {/* Overdue section */}
                {overdueChores.length > 0 && (
                  <>
                    <div className="section-title" style={{ color: '#f59e0b' }}>Overdue</div>
                    {overdueChores.map(chore => (
                      <ChoreCard
                        key={chore.id}
                        chore={chore}
                        completion={completions[chore.id] ?? null}
                        members={members}
                        viewDate={viewDate}
                        currentMemberId={session?.memberId}
                        isOverdue
                        onComplete={handleComplete}
                        onUncomplete={handleUncomplete}
                        onSkip={handleSkip}
                        onEdit={isAdmin ? openEdit : undefined}
                      />
                    ))}
                    <div style={{ height: 8 }} />
                  </>
                )}

                {/* Active chores */}
                {sortedActive.length > 0 ? (
                  sortedActive.map(chore => (
                    <ChoreCard
                      key={chore.id}
                      chore={chore}
                      completion={completions[chore.id] ?? null}
                      members={members}
                      viewDate={viewDate}
                      currentMemberId={session?.memberId}
                      onComplete={handleComplete}
                      onUncomplete={handleUncomplete}
                      onSkip={handleSkip}
                      onEdit={isAdmin ? openEdit : undefined}
                    />
                  ))
                ) : (
                  <div style={{
                    flex: 1, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 8,
                    color: 'var(--text-dim)', marginTop: 60,
                  }}>
                    <span style={{ fontSize: 48 }}>✅</span>
                    <div style={{ fontSize: 16 }}>No chores for {formatViewDate(viewDate)}</div>
                    {isAdmin && (
                      <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>Tap + Add Chore to get started</div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Add Chore button (admin only) */}
          {isAdmin && (
            <div style={{
              padding: '12px 16px', borderTop: '1px solid var(--border)',
              background: 'var(--surface)', flexShrink: 0,
            }}>
              <button
                type="button"
                onClick={() => { setEditChore(null); setShowForm(true) }}
                style={{
                  width: '100%', padding: '13px 0', borderRadius: 12,
                  background: 'var(--accent)', border: 'none',
                  color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer',
                  boxShadow: '0 2px 12px rgba(108,140,255,0.3)',
                }}
              >
                + Add Chore
              </button>
            </div>
          )}
        </>
      )}

      {/* Chore form modal */}
      {showForm && (
        <ChoreForm
          chore={editChore ?? undefined}
          members={members}
          onSave={handleSaveChore}
          onDelete={editChore ? handleDeleteChore : undefined}
          onClose={() => { setShowForm(false); setEditChore(null) }}
        />
      )}
    </div>
  )
}

const navBtn: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8,
  background: 'var(--surface2)', border: '1px solid var(--border)',
  color: 'var(--text)', fontSize: 16, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}

// ── RoutinesView ──────────────────────────────────────────────────────────

const TIME_BLOCKS: { id: RoutineTimeBlock; label: string; emoji: string; color: string; hours: string }[] = [
  { id: 'morning',   label: 'Morning',   emoji: '🌅', color: '#fbbf24', hours: 'midnight – noon' },
  { id: 'afternoon', label: 'Afternoon', emoji: '☀️', color: '#34d399', hours: 'noon – 6 pm' },
  { id: 'evening',   label: 'Evening',   emoji: '🌙', color: '#818cf8', hours: '6 pm – midnight' },
]

function getCurrentTimeBlock(): RoutineTimeBlock {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  return 'evening'
}

function routineIsActiveOnDate(routine: Routine, date: string): boolean {
  if (routine.repeat === 'daily') return true
  const days = (routine.repeat as { weekly: number[] }).weekly
  const dow = new Date(date + 'T12:00:00').getDay()
  return days.includes(dow)
}

interface RoutinesViewProps {
  members:  FamilyMember[]
  session:  SessionPayload | null
  isAdmin:  boolean
}

function RoutinesView({ members, session, isAdmin }: RoutinesViewProps) {
  const [viewDate,    setViewDate]    = useState(today)
  const [routines,    setRoutines]    = useState<Routine[]>([])
  const [completions, setCompletions] = useState<Record<string, RoutineCompletion | null>>({})
  const [loading,     setLoading]     = useState(true)
  const [filterIds,   setFilterIds]   = useState<string[]>([])
  const [collapsed,   setCollapsed]   = useState<Set<RoutineTimeBlock>>(new Set())
  const [showForm,    setShowForm]    = useState(false)
  const [editRoutine, setEditRoutine] = useState<Routine | null>(null)

  const currentBlock = getCurrentTimeBlock()
  const t = today()

  const loadRoutines = useCallback(async (date: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/routines?date=${date}`)
      if (res.ok) {
        const { routines: r, completions: c } = await res.json()
        setRoutines(r)
        setCompletions(c)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadRoutines(viewDate) }, [viewDate, loadRoutines])

  const toggleFilter = (id: string) =>
    setFilterIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const toggleCollapse = (block: RoutineTimeBlock) =>
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(block) ? next.delete(block) : next.add(block)
      return next
    })

  const visibleRoutines = routines.filter(r => {
    if (!routineIsActiveOnDate(r, viewDate)) return false
    if (filterIds.length > 0 && !r.memberIds.some(id => filterIds.includes(id))) return false
    return true
  })

  // ── Completion actions ──────────────────────────────────────────────────

  const handleComplete = useCallback(async (id: string, date: string, memberId?: string) => {
    const res = await fetch(`/api/routines/${id}/complete`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, memberId }),
    })
    if (res.ok) {
      const { completion } = await res.json()
      setCompletions(prev => ({ ...prev, [id]: completion }))
    }
  }, [])

  const handleUncomplete = useCallback(async (id: string, date: string) => {
    const res = await fetch(`/api/routines/${id}/complete`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date }),
    })
    if (res.ok) setCompletions(prev => ({ ...prev, [id]: null }))
  }, [])

  const handleSkip = useCallback(async (id: string, date: string, memberId?: string) => {
    const res = await fetch(`/api/routines/${id}/skip`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, memberId }),
    })
    if (res.ok) {
      const { completion } = await res.json()
      setCompletions(prev => ({ ...prev, [id]: completion }))
    }
  }, [])

  // ── Create / edit ───────────────────────────────────────────────────────

  const handleSaveRoutine = useCallback(async (data: RoutineFormData) => {
    if (editRoutine) {
      await fetch(`/api/routines/${editRoutine.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
    } else {
      await fetch('/api/routines', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
    }
    setEditRoutine(null)
    setShowForm(false)
    await loadRoutines(viewDate)
  }, [editRoutine, viewDate, loadRoutines])

  const handleDeleteRoutine = useCallback(async () => {
    if (!editRoutine) return
    await fetch(`/api/routines/${editRoutine.id}`, { method: 'DELETE' })
    setEditRoutine(null)
    setShowForm(false)
    await loadRoutines(viewDate)
  }, [editRoutine, viewDate, loadRoutines])

  const openEdit = useCallback((r: Routine) => { setEditRoutine(r); setShowForm(true) }, [])

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Date nav + member filter */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', flexShrink: 0, gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" onClick={() => setViewDate(d => offsetDate(d, -1))} style={navBtn}>←</button>
          <button type="button" onClick={() => setViewDate(today())} style={{
            fontSize: 14, fontWeight: 600,
            color: viewDate === t ? 'var(--accent)' : 'var(--text)',
            background: 'none', border: 'none', cursor: 'pointer', minWidth: 100, textAlign: 'center',
          }}>
            {formatViewDate(viewDate)}
          </button>
          <button type="button" onClick={() => setViewDate(d => offsetDate(d, 1))} style={navBtn}>→</button>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {members.map(m => {
            const active = filterIds.includes(m.id)
            return (
              <button key={m.id} type="button" onClick={() => toggleFilter(m.id)} style={{
                padding: '5px 10px', borderRadius: 16, fontSize: 12,
                background: active ? `${m.color}22` : 'var(--surface2)',
                border: `1.5px solid ${active ? m.color : 'var(--border)'}`,
                color: active ? m.color : 'var(--text-dim)',
                cursor: 'pointer', fontWeight: active ? 600 : 400, transition: 'all 0.15s',
              }}>
                {m.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* Time block sections */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading ? (
          <div style={{ color: 'var(--text-dim)', textAlign: 'center', marginTop: 40 }}>Loading…</div>
        ) : (
          TIME_BLOCKS.map(block => {
            const blockRoutines = visibleRoutines
              .filter(r => r.timeBlock === block.id)
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title))
            const isCurrent  = block.id === currentBlock && viewDate === t
            const isCollapsed = collapsed.has(block.id)
            const doneCount  = blockRoutines.filter(r => completions[r.id]?.status === 'complete').length
            const totalCount = blockRoutines.length

            return (
              <div key={block.id} style={{
                background: 'var(--surface)',
                border: `1px solid ${isCurrent ? block.color + '55' : 'var(--border)'}`,
                borderRadius: 'var(--radius)',
                overflow: 'hidden',
                boxShadow: isCurrent ? `0 0 0 1px ${block.color}33` : 'none',
              }}>
                {/* Block header */}
                <button
                  type="button"
                  onClick={() => toggleCollapse(block.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer',
                    borderBottom: isCollapsed ? 'none' : '1px solid var(--border)',
                  }}
                >
                  <span style={{ fontSize: 20 }}>{block.emoji}</span>
                  <span style={{ fontSize: 15, fontWeight: 600, color: isCurrent ? block.color : 'var(--text)' }}>
                    {block.label}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-faint)', marginLeft: 2 }}>{block.hours}</span>
                  {isCurrent && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: block.color,
                      background: `${block.color}22`, padding: '2px 7px', borderRadius: 10,
                    }}>NOW</span>
                  )}
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-dim)' }}>
                    {doneCount}/{totalCount}
                  </span>
                  <span style={{ color: 'var(--text-faint)', fontSize: 14 }}>{isCollapsed ? '▸' : '▾'}</span>
                </button>

                {/* Routine cards */}
                {!isCollapsed && (
                  <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {blockRoutines.length === 0 ? (
                      <div style={{ color: 'var(--text-faint)', fontSize: 13, textAlign: 'center', padding: '8px 0' }}>
                        No routines for {block.label.toLowerCase()}
                        {isAdmin && ' — tap + Add Routine'}
                      </div>
                    ) : (
                      blockRoutines.map(r => (
                        <RoutineCard
                          key={r.id}
                          routine={r}
                          completion={completions[r.id] ?? null}
                          members={members}
                          viewDate={viewDate}
                          currentMemberId={session?.memberId}
                          onComplete={handleComplete}
                          onUncomplete={handleUncomplete}
                          onSkip={handleSkip}
                          onEdit={isAdmin ? openEdit : undefined}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Add Routine button (admin only) */}
      {isAdmin && (
        <div style={{
          padding: '12px 16px', borderTop: '1px solid var(--border)',
          background: 'var(--surface)', flexShrink: 0,
        }}>
          <button
            type="button"
            onClick={() => { setEditRoutine(null); setShowForm(true) }}
            style={{
              width: '100%', padding: '13px 0', borderRadius: 12,
              background: 'var(--accent)', border: 'none',
              color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 2px 12px rgba(108,140,255,0.3)',
            }}
          >
            + Add Routine
          </button>
        </div>
      )}

      {/* Routine form modal */}
      {showForm && (
        <RoutineForm
          routine={editRoutine ?? undefined}
          members={members}
          onSave={handleSaveRoutine}
          onDelete={editRoutine ? handleDeleteRoutine : undefined}
          onClose={() => { setShowForm(false); setEditRoutine(null) }}
        />
      )}
    </div>
  )
}
