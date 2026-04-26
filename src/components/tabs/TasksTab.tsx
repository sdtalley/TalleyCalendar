'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Chore, Routine, FamilyMember, SessionPayload } from '@/lib/calendar/types'
import { InfoBar } from '@/components/layout/InfoBar'
import { useAutoRefresh } from '@/hooks/useAutoRefresh'
import { ChoreForm, type ChoreFormData } from '@/components/tasks/ChoreForm'
import { RoutineForm, type RoutineFormData } from '@/components/tasks/RoutineForm'
import { TasksDayView } from '@/components/tasks/TasksDayView'
import { TasksWeekView } from '@/components/tasks/TasksWeekView'

type TaskView = 'day' | 'week'

// ── Date helpers ──────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function offsetDate(base: string, days: number): string {
  const d = new Date(base + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function formatViewDate(date: string): string {
  const d = new Date(date + 'T12:00:00')
  const t = today()
  if (date === t) return 'Today'
  if (date === offsetDate(t, 1)) return 'Tomorrow'
  if (date === offsetDate(t, -1)) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function getWeekRange(viewDate: string): string {
  const d = new Date(viewDate + 'T12:00:00')
  const dow = d.getDay()
  const mondayOffset = dow === 0 ? -6 : 1 - dow
  const monday = new Date(d)
  monday.setDate(d.getDate() + mondayOffset)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${monday.toLocaleDateString('en-US', opts)} – ${sunday.getDate()}`
}

// ── TasksTab ──────────────────────────────────────────────────────────────────

export function TasksTab() {
  const [taskView,        setTaskView]        = useState<TaskView>('day')
  const [viewDate,        setViewDate]        = useState(today)
  const [members,         setMembers]         = useState<FamilyMember[]>([])
  const [session,         setSession]         = useState<SessionPayload | null>(null)
  const [filterIds,       setFilterIds]       = useState<string[]>([])
  const [showFilter,      setShowFilter]      = useState(false)
  const [refreshKey,      setRefreshKey]      = useState(0)
  const [showChoreForm,   setShowChoreForm]   = useState(false)
  const [editChore,       setEditChore]       = useState<Chore | null>(null)
  const [showRoutineForm, setShowRoutineForm] = useState(false)
  const [editRoutine,     setEditRoutine]     = useState<Routine | null>(null)

  const isAdmin = session?.role === 'admin'
  const t = today()

  const autoTick = useAutoRefresh()

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then(r => r.ok ? r.json() : null),
      fetch('/api/family').then(r => r.json()),
    ]).then(([sess, mems]) => {
      setSession(sess)
      setMembers(Array.isArray(mems) ? mems : [])
    })
  }, [])

  // Bump refreshKey on visibility change / 5-min poll so chores+routines stay fresh
  useEffect(() => {
    if (autoTick > 0) setRefreshKey(k => k + 1)
  }, [autoTick])

  const refresh = () => setRefreshKey(k => k + 1)

  const navigate = useCallback((direction: -1 | 1) => {
    setViewDate(d => offsetDate(d, taskView === 'week' ? 7 * direction : direction))
  }, [taskView])

  // ── Form handlers ─────────────────────────────────────────────────────────

  const handleSaveChore = useCallback(async (data: ChoreFormData) => {
    if (editChore) {
      await fetch(`/api/chores/${editChore.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
    } else {
      await fetch('/api/chores', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
    }
    setEditChore(null)
    setShowChoreForm(false)
    refresh()
  }, [editChore])

  const handleDeleteChore = useCallback(async (scope: 'all' | 'this' | 'future', date?: string) => {
    if (!editChore) return
    await fetch(`/api/chores/${editChore.id}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope, date }),
    })
    setEditChore(null)
    setShowChoreForm(false)
    refresh()
  }, [editChore])

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
    setShowRoutineForm(false)
    refresh()
  }, [editRoutine])

  const handleDeleteRoutine = useCallback(async (scope: 'future' | 'all', date?: string) => {
    if (!editRoutine) return
    await fetch(`/api/routines/${editRoutine.id}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope, date }),
    })
    setEditRoutine(null)
    setShowRoutineForm(false)
    refresh()
  }, [editRoutine])

  // ── InfoBar right slot ────────────────────────────────────────────────────

  const dateLabel = taskView === 'day' ? formatViewDate(viewDate) : getWeekRange(viewDate)

  const tasksRightSlot = (
    <>
      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
        {dateLabel}
      </span>
      <div style={{ flex: 1 }} />

      {/* Day / Week toggle */}
      <div style={{
        display: 'flex', gap: 2,
        background: 'var(--surface2)', border: '1px solid var(--border)',
        borderRadius: 8, padding: 2,
      }}>
        <button
          type="button"
          onClick={() => setTaskView('day')}
          style={{
            padding: '5px 12px', borderRadius: 6, fontSize: 12,
            fontWeight: taskView === 'day' ? 600 : 400,
            background: taskView === 'day' ? 'var(--accent)' : 'transparent',
            color: taskView === 'day' ? '#fff' : 'var(--text-dim)',
            border: 'none', cursor: 'pointer', transition: 'all 0.15s',
          }}
        >○ Day</button>
        <button
          type="button"
          onClick={() => setTaskView('week')}
          style={{
            padding: '5px 12px', borderRadius: 6, fontSize: 12,
            fontWeight: taskView === 'week' ? 600 : 400,
            background: taskView === 'week' ? 'var(--accent)' : 'transparent',
            color: taskView === 'week' ? '#fff' : 'var(--text-dim)',
            border: 'none', cursor: 'pointer', transition: 'all 0.15s',
          }}
        >□ Week</button>
      </div>

      {/* Filter */}
      <button
        type="button"
        onClick={() => setShowFilter(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
          background: showFilter || filterIds.length > 0 ? 'var(--accent)' : 'var(--surface2)',
          color: showFilter || filterIds.length > 0 ? '#fff' : 'var(--text-dim)',
          border: `1px solid ${showFilter || filterIds.length > 0 ? 'var(--accent)' : 'var(--border)'}`,
          cursor: 'pointer',
        }}
      >
        ⊞{filterIds.length > 0 ? ` (${filterIds.length})` : ' Filter'}
      </button>

      {/* Date nav */}
      <button type="button" onClick={() => navigate(-1)} style={navBtnStyle}>‹</button>
      <button
        type="button"
        onClick={() => setViewDate(today())}
        style={{
          padding: '6px 12px', borderRadius: 8, fontSize: 12,
          fontWeight: viewDate === t ? 700 : 500,
          background: 'var(--surface2)', border: '1px solid var(--border)',
          color: viewDate === t ? 'var(--accent)' : 'var(--text-dim)',
          cursor: 'pointer',
        }}
      >Today</button>
      <button type="button" onClick={() => navigate(1)} style={navBtnStyle}>›</button>
    </>
  )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      overflow: 'hidden', background: 'var(--bg)',
    }}>
      <InfoBar rightSlot={tasksRightSlot} />

      {/* Filter panel */}
      {showFilter && (
        <div style={{
          display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
          padding: '10px 16px', borderBottom: '1px solid var(--border)',
          background: 'var(--surface)', flexShrink: 0,
        }}>
          <span style={{ fontSize: 12, color: 'var(--text-dim)', fontWeight: 500 }}>Profiles:</span>
          {members.map(m => {
            const active = filterIds.includes(m.id)
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setFilterIds(prev =>
                  prev.includes(m.id) ? prev.filter(x => x !== m.id) : [...prev, m.id]
                )}
                style={{
                  padding: '5px 10px', borderRadius: 16, fontSize: 12,
                  background: active ? `${m.color}22` : 'var(--surface2)',
                  border: `1.5px solid ${active ? m.color : 'var(--border)'}`,
                  color: active ? m.color : 'var(--text-dim)',
                  cursor: 'pointer', fontWeight: active ? 600 : 400,
                }}
              >{m.name}</button>
            )
          })}
          {filterIds.length > 0 && (
            <button
              type="button"
              onClick={() => setFilterIds([])}
              style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}
            >Clear all</button>
          )}
        </div>
      )}

      {/* Main view */}
      {taskView === 'day' ? (
        <TasksDayView
          viewDate={viewDate}
          members={members}
          filterIds={filterIds}
          session={session}
          isAdmin={isAdmin}
          refreshKey={refreshKey}
          onEditChore={chore => { setEditChore(chore); setShowChoreForm(true) }}
          onEditRoutine={routine => { setEditRoutine(routine); setShowRoutineForm(true) }}
        />
      ) : (
        <TasksWeekView
          viewDate={viewDate}
          members={members}
          filterIds={filterIds}
          session={session}
          isAdmin={isAdmin}
          refreshKey={refreshKey}
        />
      )}

      {/* Admin: add buttons */}
      {isAdmin && (
        <div style={{
          display: 'flex', gap: 8, padding: '12px 16px',
          borderTop: '1px solid var(--border)',
          background: 'var(--surface)', flexShrink: 0,
        }}>
          <button
            type="button"
            onClick={() => { setEditRoutine(null); setShowRoutineForm(true) }}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 10,
              background: 'var(--surface2)', border: '1px solid var(--border)',
              color: 'var(--text-dim)', fontSize: 14, fontWeight: 500, cursor: 'pointer',
            }}
          >+ Routine</button>
          <button
            type="button"
            onClick={() => { setEditChore(null); setShowChoreForm(true) }}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 10,
              background: 'var(--accent)', border: 'none',
              color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 2px 12px rgba(108,140,255,0.3)',
            }}
          >+ Chore</button>
        </div>
      )}

      {/* Forms */}
      {showChoreForm && (
        <ChoreForm
          chore={editChore ?? undefined}
          members={members}
          viewDate={viewDate}
          onSave={handleSaveChore}
          onDelete={editChore ? handleDeleteChore : undefined}
          onClose={() => { setShowChoreForm(false); setEditChore(null) }}
        />
      )}
      {showRoutineForm && (
        <RoutineForm
          routine={editRoutine ?? undefined}
          members={members}
          viewDate={viewDate}
          onSave={handleSaveRoutine}
          onDelete={editRoutine ? handleDeleteRoutine : undefined}
          onClose={() => { setShowRoutineForm(false); setEditRoutine(null) }}
        />
      )}
    </div>
  )
}

// ── Style constants ───────────────────────────────────────────────────────────

const navBtnStyle: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 8,
  background: 'var(--surface2)', border: '1px solid var(--border)',
  color: 'var(--text)', fontSize: 16, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
