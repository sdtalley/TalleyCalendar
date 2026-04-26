'use client'

import { useState, useEffect, useCallback } from 'react'
import { InfoBar } from '@/components/layout/InfoBar'
import type { DayMeals, MealCategory, MealEntry } from '@/lib/calendar/types'

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: MealCategory[] = ['breakfast', 'lunch', 'dinner', 'snack']

const CAT_LABELS: Record<MealCategory, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

const CAT_COLORS: Record<MealCategory, string> = {
  breakfast: '#3b82f6',
  lunch: '#22c55e',
  dinner: '#f59e0b',
  snack: '#a855f7',
}

const CAT_EMOJIS: Record<MealCategory, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🍽️',
  snack: '🍎',
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ── Helpers ──────────────────────────────────────────────────────────────────

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function weekStartFor(d: Date): Date {
  const s = new Date(d)
  s.setHours(0, 0, 0, 0)
  s.setDate(s.getDate() - s.getDay())  // start on Sunday
  return s
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function formatWeekLabel(start: Date): string {
  const end = addDays(start, 6)
  const sm = start.toLocaleDateString('en-US', { month: 'short' })
  const em = end.toLocaleDateString('en-US', { month: 'short' })
  const sd = start.getDate()
  const ed = end.getDate()
  return sm === em ? `${sm} ${sd}–${ed}` : `${sm} ${sd} – ${em} ${ed}`
}

// ── Meal Entry Modal ─────────────────────────────────────────────────────────

interface ModalState {
  date: string
  category: MealCategory
  entry: MealEntry | null  // null = adding new
}

function MealModal({
  state,
  onClose,
  onSave,
  onDelete,
}: {
  state: ModalState
  onClose: () => void
  onSave: (date: string, category: MealCategory, entry: MealEntry) => void
  onDelete: (date: string, category: MealCategory, entryId: string) => void
}) {
  const [name, setName] = useState(state.entry?.name ?? '')
  const [note, setNote] = useState(state.entry?.note ?? '')
  const [repeatEnabled, setRepeatEnabled] = useState(!!state.entry?.repeat)
  const [repeatDays, setRepeatDays] = useState<number[]>(state.entry?.repeat?.daysOfWeek ?? [])

  const isEditing = !!state.entry

  function toggleDay(d: number) {
    setRepeatDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  function handleSave() {
    if (!name.trim()) return
    const entry: MealEntry = {
      id: state.entry?.id ?? `${Date.now()}`,
      name: name.trim(),
      note: note.trim() || undefined,
      repeat: repeatEnabled && repeatDays.length > 0
        ? { frequency: 'weekly', daysOfWeek: repeatDays }
        : undefined,
    }
    onSave(state.date, state.category, entry)
  }

  const color = CAT_COLORS[state.category]
  const label = CAT_LABELS[state.category]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="rounded-xl shadow-2xl p-5 flex flex-col gap-4"
        style={{ background: 'var(--surface2)', width: 360, maxWidth: '90vw' }}
      >
        {/* Header */}
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 20 }}>{CAT_EMOJIS[state.category]}</span>
          <span className="font-bold text-lg" style={{ color: 'var(--text)' }}>
            {isEditing ? `Edit ${label}` : `Add ${label}`}
          </span>
        </div>

        {/* Name */}
        <input
          autoFocus
          placeholder={`${label} name`}
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
          className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
          style={{
            background: 'var(--surface)',
            border: `2px solid ${color}`,
            color: 'var(--text)',
          }}
        />

        {/* Note */}
        <input
          placeholder="Note (optional)"
          value={note}
          onChange={e => setNote(e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-sm outline-none"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
          }}
        />

        {/* Repeat */}
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={repeatEnabled}
              onChange={e => setRepeatEnabled(e.target.checked)}
            />
            <span className="text-sm" style={{ color: 'var(--text)' }}>Repeat weekly</span>
          </label>
          {repeatEnabled && (
            <div className="flex gap-1 mt-2 flex-wrap">
              {DOW.map((d, i) => (
                <button
                  key={i}
                  onClick={() => toggleDay(i)}
                  className="rounded-full text-xs font-semibold px-2.5 py-1 border transition-colors"
                  style={{
                    background: repeatDays.includes(i) ? color : 'transparent',
                    color: repeatDays.includes(i) ? '#fff' : 'var(--text-dim)',
                    borderColor: repeatDays.includes(i) ? color : 'var(--border)',
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-1">
          {isEditing && (
            <button
              onClick={() => onDelete(state.date, state.category, state.entry!.id)}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold"
              style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}
            >
              Delete
            </button>
          )}
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold"
            style={{ background: 'var(--surface)', color: 'var(--text-dim)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-4 py-1.5 rounded-lg text-sm font-bold"
            style={{
              background: color,
              color: '#fff',
              opacity: name.trim() ? 1 : 0.4,
            }}
          >
            {isEditing ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── MealsTab ─────────────────────────────────────────────────────────────────

export function MealsTab() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [weekStart, setWeekStart] = useState(() => weekStartFor(today))
  const [meals, setMeals] = useState<Record<string, DayMeals>>({})
  const [modal, setModal] = useState<ModalState | null>(null)

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekEnd = weekDates[6]

  // Fetch meals for this week
  useEffect(() => {
    const start = toDateKey(weekStart)
    const end = toDateKey(weekEnd)
    fetch(`/api/meals?start=${start}&end=${end}`)
      .then(r => r.json())
      .then((data: Record<string, DayMeals>) => setMeals(data))
      .catch(() => {})
  }, [weekStart.toISOString()]) // eslint-disable-line react-hooks/exhaustive-deps

  const prevWeek = useCallback(() => setWeekStart(s => addDays(s, -7)), [])
  const nextWeek = useCallback(() => setWeekStart(s => addDays(s, 7)), [])
  const goToday = useCallback(() => setWeekStart(weekStartFor(today)), []) // eslint-disable-line react-hooks/exhaustive-deps

  function openAdd(date: string, category: MealCategory) {
    setModal({ date, category, entry: null })
  }

  function openEdit(date: string, category: MealCategory, entry: MealEntry) {
    setModal({ date, category, entry })
  }

  async function handleSave(date: string, category: MealCategory, entry: MealEntry) {
    setModal(null)
    const res = await fetch(`/api/meals/${date}/${category}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    })
    if (!res.ok) return
    setMeals(prev => {
      const day = prev[date] ?? { breakfast: [], lunch: [], dinner: [], snack: [] }
      const list = day[category]
      const idx = list.findIndex(e => e.id === entry.id)
      const updated = idx >= 0 ? list.map((e, i) => i === idx ? entry : e) : [...list, entry]
      return { ...prev, [date]: { ...day, [category]: updated } }
    })
  }

  async function handleDelete(date: string, category: MealCategory, entryId: string) {
    setModal(null)
    await fetch(`/api/meals/${date}/${category}?entryId=${entryId}`, { method: 'DELETE' })
    setMeals(prev => {
      const day = prev[date]
      if (!day) return prev
      return { ...prev, [date]: { ...day, [category]: day[category].filter(e => e.id !== entryId) } }
    })
  }

  const weekLabel = formatWeekLabel(weekStart)

  const infoRight = (
    <div className="flex items-center gap-1">
      <button
        onClick={prevWeek}
        className="px-2 py-1 rounded text-sm font-bold transition-colors hover:bg-white/10"
        style={{ color: 'var(--text)' }}
      >‹</button>
      <button
        onClick={goToday}
        className="px-2 py-1 rounded text-xs font-semibold transition-colors hover:bg-white/10"
        style={{ color: 'var(--text-dim)' }}
      >Today</button>
      <button
        onClick={nextWeek}
        className="px-2 py-1 rounded text-sm font-bold transition-colors hover:bg-white/10"
        style={{ color: 'var(--text)' }}
      >›</button>
    </div>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <InfoBar rightSlot={infoRight} />

      {/* Week label */}
      <div
        className="flex-shrink-0 px-4 py-2 text-sm font-semibold"
        style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--border)' }}
      >
        {weekLabel}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse" style={{ minWidth: 560 }}>
          {/* Day headers */}
          <thead>
            <tr>
              <th
                className="text-xs font-semibold text-left px-2 py-2 sticky left-0 z-10"
                style={{ width: 90, background: 'var(--surface2)', color: 'var(--text-dim)', borderBottom: '1px solid var(--border)' }}
              />
              {weekDates.map((d, i) => {
                const isToday = sameDay(d, today)
                return (
                  <th
                    key={i}
                    className="text-center py-2 px-1 text-xs font-semibold"
                    style={{
                      borderBottom: '1px solid var(--border)',
                      borderLeft: '1px solid var(--border)',
                      color: isToday ? 'var(--accent)' : 'var(--text-dim)',
                      minWidth: 90,
                    }}
                  >
                    <div className="uppercase tracking-wide text-[10px]">{DOW[d.getDay()]}</div>
                    <div
                      className="text-lg font-bold leading-tight"
                      style={{
                        color: isToday ? '#fff' : 'var(--text)',
                        background: isToday ? 'var(--accent)' : 'transparent',
                        borderRadius: isToday ? '50%' : 0,
                        width: isToday ? 28 : 'auto',
                        height: isToday ? 28 : 'auto',
                        lineHeight: isToday ? '28px' : undefined,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto',
                      }}
                    >
                      {d.getDate()}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>

          {/* Category rows */}
          <tbody>
            {CATEGORIES.map(cat => {
              const color = CAT_COLORS[cat]
              return (
                <tr key={cat}>
                  {/* Category label */}
                  <td
                    className="px-2 py-2 sticky left-0 z-10"
                    style={{
                      background: 'var(--surface2)',
                      borderBottom: '1px solid var(--border)',
                      borderRight: '1px solid var(--border)',
                      verticalAlign: 'top',
                    }}
                  >
                    <div className="flex flex-col items-start gap-0.5">
                      <span style={{ fontSize: 14 }}>{CAT_EMOJIS[cat]}</span>
                      <span
                        className="text-[10px] font-bold uppercase tracking-wide"
                        style={{ color }}
                      >
                        {CAT_LABELS[cat]}
                      </span>
                    </div>
                  </td>

                  {weekDates.map((d, di) => {
                    const dateKey = toDateKey(d)
                    const dayMeals = meals[dateKey]
                    const entries = dayMeals?.[cat] ?? []
                    const isToday = sameDay(d, today)

                    return (
                      <td
                        key={di}
                        className="px-1 py-1 align-top"
                        style={{
                          borderBottom: '1px solid var(--border)',
                          borderLeft: '1px solid var(--border)',
                          minHeight: 56,
                          background: isToday ? 'rgba(108,140,255,0.04)' : 'transparent',
                        }}
                      >
                        <div className="flex flex-col gap-1 min-h-[48px]">
                          {entries.map(entry => (
                            <button
                              key={entry.id}
                              onClick={() => openEdit(dateKey, cat, entry)}
                              className="text-left text-[11px] font-semibold px-1.5 py-[2px] rounded w-full truncate transition-all"
                              style={{
                                background: `${color}22`,
                                color,
                                borderLeft: `3px solid ${color}`,
                                borderRadius: '0 3px 3px 0',
                              }}
                              title={entry.name}
                            >
                              {entry.repeat && <span className="mr-0.5 opacity-60">↻</span>}
                              {entry.name}
                            </button>
                          ))}
                          <button
                            onClick={() => openAdd(dateKey, cat)}
                            className="text-[10px] opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity px-1.5 py-[1px] rounded"
                            style={{ color: 'var(--text-faint)' }}
                            title={`Add ${CAT_LABELS[cat]}`}
                          >
                            + add
                          </button>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <MealModal
          state={modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
