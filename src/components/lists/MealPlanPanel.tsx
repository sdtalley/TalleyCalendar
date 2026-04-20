'use client'

import { useEffect, useRef, useState } from 'react'

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  d.setHours(0, 0, 0, 0)
  return d
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function MealPlanPanel() {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const [meals, setMeals] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const todayKey = toDateKey(new Date())

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekDates = days.map(toDateKey)
  const start = weekDates[0]
  const end = weekDates[6]

  useEffect(() => {
    fetch(`/api/meals?start=${start}&end=${end}`)
      .then(r => r.json())
      .then(data => setMeals(data))
      .catch(() => {})
  }, [start, end])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  function startEdit(date: string) {
    setEditing(date)
    setEditValue(meals[date] ?? '')
  }

  async function saveEdit(date: string) {
    const name = editValue.trim()
    setMeals(prev => ({ ...prev, [date]: name }))
    setEditing(null)
    await fetch('/api/meals', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, name }),
    }).catch(() => {})
  }

  function cancelEdit() {
    setEditing(null)
  }

  function prevWeek() {
    setWeekStart(d => addDays(d, -7))
  }

  function nextWeek() {
    setWeekStart(d => addDays(d, 7))
  }

  const weekLabel = `${days[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${days[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Week navigation */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <button
          onClick={prevWeek}
          style={{
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--text-dim)',
            cursor: 'pointer',
            fontSize: 16,
          }}
        >
          ‹
        </button>
        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-dim)' }}>
          {weekLabel}
        </span>
        <button
          onClick={nextWeek}
          style={{
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--text-dim)',
            cursor: 'pointer',
            fontSize: 16,
          }}
        >
          ›
        </button>
      </div>

      {/* Day rows */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {days.map((day, i) => {
          const dateKey = weekDates[i]
          const isEditing = editing === dateKey
          const isToday = dateKey === todayKey
          const mealName = meals[dateKey] ?? ''

          return (
            <div
              key={dateKey}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                borderBottom: '1px solid var(--border)',
                background: isToday ? 'rgba(108,140,255,0.05)' : 'transparent',
              }}
            >
              {/* Day label */}
              <div
                style={{
                  flexShrink: 0,
                  width: 36,
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 10, color: 'var(--text-faint)', lineHeight: 1.2 }}>
                  {DAY_LABELS[i]}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: isToday ? 'var(--accent)' : 'var(--text)',
                    lineHeight: 1.3,
                  }}
                >
                  {day.getDate()}
                </div>
              </div>

              {/* Amber dinner indicator */}
              <div
                style={{
                  width: 3,
                  alignSelf: 'stretch',
                  borderRadius: 2,
                  background: mealName ? '#f59e0b' : 'var(--border)',
                  flexShrink: 0,
                }}
              />

              {/* Edit field or display */}
              {isEditing ? (
                <input
                  ref={inputRef}
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={() => saveEdit(dateKey)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveEdit(dateKey)
                    if (e.key === 'Escape') cancelEdit()
                  }}
                  style={{
                    flex: 1,
                    fontSize: 12,
                    padding: '4px 8px',
                    borderRadius: 6,
                    background: 'var(--surface2)',
                    border: '1px solid var(--accent)',
                    color: 'var(--text)',
                    outline: 'none',
                  }}
                  placeholder="What's for dinner?"
                />
              ) : (
                <button
                  onClick={() => startEdit(dateKey)}
                  style={{
                    flex: 1,
                    textAlign: 'left',
                    fontSize: 12,
                    padding: '4px 8px',
                    borderRadius: 6,
                    background: 'transparent',
                    border: '1px solid transparent',
                    color: mealName ? 'var(--text)' : 'var(--text-faint)',
                    cursor: 'pointer',
                    transition: 'background 0.1s, border-color 0.1s',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'var(--surface2)'
                    e.currentTarget.style.borderColor = 'var(--border)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.borderColor = 'transparent'
                  }}
                >
                  {mealName || 'Add dinner…'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
