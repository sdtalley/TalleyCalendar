'use client'

import { useState, useEffect } from 'react'
import type { Chore, FamilyMember } from '@/lib/calendar/types'
import { EmojiPicker } from './EmojiPicker'

type DeleteScope = 'all' | 'this' | 'future'

interface ChoreFormProps {
  chore?:    Chore       // if provided → edit mode
  members:   FamilyMember[]
  viewDate?: string      // YYYY-MM-DD — used for "delete this instance" scope
  onSave:    (data: ChoreFormData) => Promise<void>
  onDelete?: (scope: DeleteScope, date?: string) => Promise<void>
  onClose:   () => void
}

export interface ChoreFormData {
  title:     string
  emoji?:    string
  memberIds: string[]
  date?:     string
  time?:     string
  repeat?:   {
    frequency:  'daily' | 'weekly' | 'monthly'
    interval:   number
    daysOfWeek?: number[]
    endDate?:   string
  }
  starValue: number
}

const STAR_PRESETS = [0, 5, 10, 25, 50, 100]
const DAY_LABELS   = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export function ChoreForm({ chore, members, viewDate, onSave, onDelete, onClose }: ChoreFormProps) {
  const isEdit = !!chore

  const [title,      setTitle]      = useState(chore?.title ?? '')
  const [emoji,      setEmoji]      = useState(chore?.emoji ?? '')
  const [memberIds,  setMemberIds]  = useState<string[]>(chore?.memberIds ?? [])
  const [hasDate,    setHasDate]    = useState(!!chore?.date)
  const [date,       setDate]       = useState(chore?.date ?? '')
  const [hasTime,    setHasTime]    = useState(!!chore?.time)
  const [time,       setTime]       = useState(chore?.time ?? '')
  const [hasRepeat,  setHasRepeat]  = useState(!!chore?.repeat)
  const [frequency,  setFrequency]  = useState<'daily'|'weekly'|'monthly'>(chore?.repeat?.frequency ?? 'weekly')
  const [interval,   setInterval]   = useState(chore?.repeat?.interval ?? 1)
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(chore?.repeat?.daysOfWeek ?? [])
  const [repeatEnd,  setRepeatEnd]  = useState(chore?.repeat?.endDate ?? '')
  const [starValue,  setStarValue]  = useState(chore?.starValue ?? 0)
  const [customStar, setCustomStar] = useState('')
  const [showEmoji,  setShowEmoji]  = useState(false)
  const [saving,          setSaving]          = useState(false)
  const [deleting,        setDeleting]        = useState(false)
  const [showScopeModal,  setShowScopeModal]  = useState(false)

  // Default today's date when date toggle is first enabled
  useEffect(() => {
    if (hasDate && !date) {
      setDate(new Date().toISOString().slice(0, 10))
    }
  }, [hasDate, date])

  const toggleMember = (id: string) => {
    setMemberIds(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    )
  }

  const toggleDay = (d: number) => {
    setDaysOfWeek(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
    )
  }

  const handleSave = async () => {
    if (!title.trim() || memberIds.length === 0 || saving) return
    setSaving(true)
    try {
      const data: ChoreFormData = {
        title: title.trim(),
        emoji: emoji || undefined,
        memberIds,
        date:  hasDate && date ? date : undefined,
        time:  hasTime && time ? time : undefined,
        starValue,
      }
      if (hasRepeat) {
        data.repeat = {
          frequency,
          interval,
          daysOfWeek: frequency === 'weekly' && daysOfWeek.length > 0 ? daysOfWeek : undefined,
          endDate:    repeatEnd || undefined,
        }
      }
      await onSave(data)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteClick = () => {
    if (!onDelete || deleting) return
    if (chore?.repeat) {
      setShowScopeModal(true)
    } else {
      handleDeleteConfirm('all')
    }
  }

  const handleDeleteConfirm = async (scope: DeleteScope) => {
    if (!onDelete || deleting) return
    setShowScopeModal(false)
    setDeleting(true)
    try {
      await onDelete(scope, viewDate)
      onClose()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          zIndex: 50, backdropFilter: 'blur(4px)',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        maxWidth: 600,
        margin: '0 auto',
        background: 'var(--surface)',
        borderRadius: 'var(--radius) var(--radius) 0 0',
        border: '1px solid var(--border)',
        borderBottom: 'none',
        zIndex: 51,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '90vh',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
        }}>
          <h2 style={{ fontSize: 17, fontWeight: 600 }}>{isEdit ? 'Edit Chore' : 'New Chore'}</h2>
          <button type="button" onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 22, cursor: 'pointer' }}>
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Title + emoji */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <button
              type="button"
              onClick={() => setShowEmoji(v => !v)}
              style={{
                width: 52, height: 52, fontSize: 26, borderRadius: 12,
                background: 'var(--surface2)', border: '1px solid var(--border)',
                cursor: 'pointer', flexShrink: 0, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              {emoji || '＋'}
            </button>
            <input
              type="text"
              placeholder="Chore title…"
              value={title}
              onChange={e => setTitle(e.target.value)}
              style={{ flex: 1 }}
              autoFocus
            />
          </div>

          {/* Emoji picker */}
          {showEmoji && (
            <div style={{ background: 'var(--surface2)', borderRadius: 12, padding: 16 }}>
              <EmojiPicker value={emoji} onChange={e => { setEmoji(e); setShowEmoji(false) }} />
            </div>
          )}

          {/* Assign to */}
          <div>
            <div className="field-label" style={{ marginBottom: 10 }}>Assign to</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {members.map(m => {
                const selected = memberIds.includes(m.id)
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleMember(m.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '7px 12px', borderRadius: 20,
                      background: selected ? `${m.color}22` : 'var(--surface2)',
                      border: `2px solid ${selected ? m.color : 'var(--border)'}`,
                      color: selected ? m.color : 'var(--text-dim)',
                      fontWeight: selected ? 600 : 400,
                      cursor: 'pointer', fontSize: 14,
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, display: 'inline-block' }} />
                    {m.name}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Date (optional) */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div className="field-label">Date</div>
              <Toggle value={hasDate} onChange={setHasDate} />
            </div>
            {hasDate && (
              <input type="date" value={date} onChange={e => setDate(e.target.value)} />
            )}
          </div>

          {/* Time (optional) */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div className="field-label">Time</div>
              <Toggle value={hasTime} onChange={setHasTime} />
            </div>
            {hasTime && (
              <input type="time" value={time} onChange={e => setTime(e.target.value)} />
            )}
          </div>

          {/* Repeat */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div className="field-label">Repeat</div>
              <Toggle value={hasRepeat} onChange={setHasRepeat} />
            </div>
            {hasRepeat && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--surface2)', borderRadius: 10, padding: 14 }}>
                {/* Frequency */}
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['daily', 'weekly', 'monthly'] as const).map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFrequency(f)}
                      style={{
                        flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13,
                        background: frequency === f ? 'var(--accent)' : 'var(--surface3)',
                        border: 'none', color: frequency === f ? '#fff' : 'var(--text-dim)',
                        cursor: 'pointer', fontWeight: frequency === f ? 600 : 400,
                        textTransform: 'capitalize',
                      }}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                {/* Interval */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>Every</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button type="button" onClick={() => setInterval(i => Math.max(1, i - 1))}
                      style={stepperBtn}>−</button>
                    <span style={{ minWidth: 28, textAlign: 'center', fontSize: 16, fontWeight: 600 }}>{interval}</span>
                    <button type="button" onClick={() => setInterval(i => i + 1)}
                      style={stepperBtn}>+</button>
                  </div>
                  <span style={{ color: 'var(--text-dim)', fontSize: 14 }}>
                    {frequency === 'daily' ? 'day(s)' : frequency === 'weekly' ? 'week(s)' : 'month(s)'}
                  </span>
                </div>

                {/* Days of week (weekly only) */}
                {frequency === 'weekly' && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    {DAY_LABELS.map((label, d) => {
                      const active = daysOfWeek.includes(d)
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => toggleDay(d)}
                          style={{
                            flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12,
                            background: active ? 'var(--accent)' : 'var(--surface3)',
                            border: 'none', color: active ? '#fff' : 'var(--text-dim)',
                            cursor: 'pointer', fontWeight: active ? 600 : 400,
                          }}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* End date */}
                <div>
                  <div className="field-label" style={{ marginBottom: 6 }}>End date (optional)</div>
                  <input type="date" value={repeatEnd} onChange={e => setRepeatEnd(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          {/* Stars */}
          <div>
            <div className="field-label" style={{ marginBottom: 10 }}>Stars ⭐</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {STAR_PRESETS.map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => { setStarValue(v); setCustomStar('') }}
                  style={{
                    padding: '8px 14px', borderRadius: 8, fontSize: 14,
                    background: starValue === v && !customStar ? 'var(--accent)' : 'var(--surface2)',
                    border: `2px solid ${starValue === v && !customStar ? 'var(--accent)' : 'var(--border)'}`,
                    color: starValue === v && !customStar ? '#fff' : 'var(--text-dim)',
                    cursor: 'pointer', fontWeight: starValue === v && !customStar ? 600 : 400,
                  }}
                >
                  {v === 0 ? 'None' : v}
                </button>
              ))}
              <input
                type="number"
                min={0}
                placeholder="Custom"
                value={customStar}
                onChange={e => { setCustomStar(e.target.value); setStarValue(Number(e.target.value) || 0) }}
                style={{ width: 90 }}
              />
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div style={{
          display: 'flex', gap: 10, padding: '16px 20px',
          borderTop: '1px solid var(--border)',
        }}>
          {isEdit && onDelete && (
            <button
              type="button"
              onClick={handleDeleteClick}
              disabled={deleting}
              style={{
                padding: '12px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                background: 'rgba(255,60,60,0.1)', border: '1px solid rgba(255,60,60,0.3)',
                color: '#ff6060', cursor: 'pointer',
              }}
            >
              {deleting ? '…' : 'Delete'}
            </button>
          )}
          <button type="button" onClick={onClose}
            style={{
              flex: 1, padding: '12px 0', borderRadius: 10, fontSize: 15, fontWeight: 500,
              background: 'var(--surface2)', border: '1px solid var(--border)',
              color: 'var(--text-dim)', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !title.trim() || memberIds.length === 0}
            style={{
              flex: 2, padding: '12px 0', borderRadius: 10, fontSize: 15, fontWeight: 600,
              background: 'var(--accent)', border: 'none', color: '#fff', cursor: 'pointer',
              opacity: saving || !title.trim() || memberIds.length === 0 ? 0.5 : 1,
            }}
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Chore'}
          </button>
        </div>
      </div>

      {/* Delete scope modal (repeating chores only) */}
      {showScopeModal && (
        <>
          <div
            onClick={() => setShowScopeModal(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
              zIndex: 60,
            }}
          />
          <div style={{
            position: 'fixed',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            padding: 24,
            zIndex: 61,
            width: 320,
            maxWidth: 'calc(100vw - 32px)',
            boxShadow: 'var(--shadow)',
          }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              Delete repeating chore
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 20 }}>
              This chore repeats. How would you like to delete it?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {viewDate && (
                <button
                  type="button"
                  onClick={() => handleDeleteConfirm('this')}
                  style={scopeBtn}
                >
                  <span style={{ fontWeight: 600 }}>Just this time</span>
                  <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Remove from {viewDate} only</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => handleDeleteConfirm('future')}
                style={scopeBtn}
              >
                <span style={{ fontWeight: 600 }}>This and all future</span>
                <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Stop repeating from this date on</span>
              </button>
              <button
                type="button"
                onClick={() => handleDeleteConfirm('all')}
                style={{ ...scopeBtn, borderColor: 'rgba(255,60,60,0.3)', color: '#ff6060' }}
              >
                <span style={{ fontWeight: 600 }}>All occurrences</span>
                <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>Delete the chore entirely</span>
              </button>
              <button
                type="button"
                onClick={() => setShowScopeModal(false)}
                style={{
                  padding: '11px 0', borderRadius: 10, fontSize: 14, fontWeight: 500,
                  background: 'none', border: '1px solid var(--border)',
                  color: 'var(--text-dim)', cursor: 'pointer', marginTop: 4,
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}

const scopeBtn: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2,
  padding: '12px 16px', borderRadius: 10, width: '100%', textAlign: 'left',
  background: 'var(--surface2)', border: '1px solid var(--border)',
  color: 'var(--text)', cursor: 'pointer', fontSize: 14,
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        width: 44, height: 26, borderRadius: 13, border: 'none',
        background: value ? 'var(--accent)' : 'var(--surface3)',
        cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 3,
        left: value ? 21 : 3,
        width: 20, height: 20, borderRadius: '50%',
        background: '#fff', transition: 'left 0.2s',
      }} />
    </button>
  )
}

const stepperBtn: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8,
  background: 'var(--surface3)', border: 'none',
  color: 'var(--text)', fontSize: 18, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
