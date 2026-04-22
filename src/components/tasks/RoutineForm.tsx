'use client'

import { useState } from 'react'
import type { Routine, FamilyMember } from '@/lib/calendar/types'
import { EmojiPicker } from './EmojiPicker'

export interface RoutineFormData {
  title:     string
  emoji?:    string
  memberIds: string[]
  timeBlock: 'morning' | 'afternoon' | 'evening'
  repeat:    'daily' | { weekly: number[] }
  starValue: number
}

interface RoutineFormProps {
  routine?:  Routine
  members:   FamilyMember[]
  onSave:    (data: RoutineFormData) => Promise<void>
  onDelete?: () => Promise<void>
  onClose:   () => void
}

const TIME_BLOCKS = [
  { id: 'morning',   label: 'Morning',   sub: 'midnight – noon',  emoji: '🌅', color: '#fbbf24' },
  { id: 'afternoon', label: 'Afternoon', sub: 'noon – 6 pm',      emoji: '☀️', color: '#34d399' },
  { id: 'evening',   label: 'Evening',   sub: '6 pm – midnight',  emoji: '🌙', color: '#818cf8' },
] as const

const DAY_LABELS   = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const STAR_PRESETS = [0, 5, 10, 25, 50, 100]

export function RoutineForm({ routine, members, onSave, onDelete, onClose }: RoutineFormProps) {
  const isEdit = !!routine

  const initWeeklyDays = (): number[] => {
    if (!routine) return []
    return typeof routine.repeat === 'object' ? routine.repeat.weekly : []
  }

  const [title,      setTitle]      = useState(routine?.title ?? '')
  const [emoji,      setEmoji]      = useState(routine?.emoji ?? '')
  const [memberIds,  setMemberIds]  = useState<string[]>(routine?.memberIds ?? [])
  const [timeBlock,  setTimeBlock]  = useState<'morning'|'afternoon'|'evening'>(routine?.timeBlock ?? 'morning')
  const [repeatType, setRepeatType] = useState<'daily'|'weekly'>(
    routine?.repeat === 'daily' || !routine ? 'daily' : 'weekly'
  )
  const [weeklyDays, setWeeklyDays] = useState<number[]>(initWeeklyDays)
  const [starValue,  setStarValue]  = useState(routine?.starValue ?? 0)
  const [customStar, setCustomStar] = useState('')
  const [showEmoji,  setShowEmoji]  = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [deleting,   setDeleting]   = useState(false)

  const toggleMember = (id: string) =>
    setMemberIds(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id])

  const toggleDay = (d: number) =>
    setWeeklyDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])

  const handleSave = async () => {
    if (!title.trim() || memberIds.length === 0 || saving) return
    setSaving(true)
    try {
      const repeat: 'daily' | { weekly: number[] } =
        repeatType === 'daily' ? 'daily' : { weekly: weeklyDays }
      await onSave({ title: title.trim(), emoji: emoji || undefined, memberIds, timeBlock, repeat, starValue })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete || deleting) return
    if (!confirm(`Delete "${routine?.title}"?`)) return
    setDeleting(true)
    try { await onDelete(); onClose() }
    finally { setDeleting(false) }
  }

  const canSave = title.trim().length > 0 && memberIds.length > 0 && (repeatType === 'daily' || weeklyDays.length > 0)

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        zIndex: 50, backdropFilter: 'blur(4px)',
      }} />

      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        maxWidth: 600, margin: '0 auto',
        background: 'var(--surface)',
        borderRadius: 'var(--radius) var(--radius) 0 0',
        border: '1px solid var(--border)', borderBottom: 'none',
        zIndex: 51, display: 'flex', flexDirection: 'column',
        maxHeight: '90vh', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
        }}>
          <h2 style={{ fontSize: 17, fontWeight: 600 }}>{isEdit ? 'Edit Routine' : 'New Routine'}</h2>
          <button type="button" onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Title + emoji */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <button type="button" onClick={() => setShowEmoji(v => !v)} style={{
              width: 52, height: 52, fontSize: 26, borderRadius: 12,
              background: 'var(--surface2)', border: '1px solid var(--border)',
              cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {emoji || '＋'}
            </button>
            <input type="text" placeholder="Routine title…" value={title}
              onChange={e => setTitle(e.target.value)} style={{ flex: 1 }} autoFocus />
          </div>

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
                  <button key={m.id} type="button" onClick={() => toggleMember(m.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 12px', borderRadius: 20,
                    background: selected ? `${m.color}22` : 'var(--surface2)',
                    border: `2px solid ${selected ? m.color : 'var(--border)'}`,
                    color: selected ? m.color : 'var(--text-dim)',
                    fontWeight: selected ? 600 : 400,
                    cursor: 'pointer', fontSize: 14, transition: 'all 0.15s',
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, display: 'inline-block' }} />
                    {m.name}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Time block */}
          <div>
            <div className="field-label" style={{ marginBottom: 10 }}>Time of day</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {TIME_BLOCKS.map(({ id, label, sub, emoji: tbEmoji, color }) => {
                const active = timeBlock === id
                return (
                  <button key={id} type="button" onClick={() => setTimeBlock(id)} style={{
                    flex: 1, padding: '12px 8px', borderRadius: 12,
                    background: active ? `${color}22` : 'var(--surface2)',
                    border: `2px solid ${active ? color : 'var(--border)'}`,
                    cursor: 'pointer', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: 4, transition: 'all 0.15s',
                  }}>
                    <span style={{ fontSize: 20 }}>{tbEmoji}</span>
                    <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? color : 'var(--text)' }}>{label}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>{sub}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Repeat */}
          <div>
            <div className="field-label" style={{ marginBottom: 10 }}>Repeat</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {(['daily', 'weekly'] as const).map(r => (
                <button key={r} type="button" onClick={() => setRepeatType(r)} style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 14,
                  background: repeatType === r ? 'var(--accent)' : 'var(--surface2)',
                  border: 'none', color: repeatType === r ? '#fff' : 'var(--text-dim)',
                  cursor: 'pointer', fontWeight: repeatType === r ? 600 : 400,
                  textTransform: 'capitalize',
                }}>
                  {r === 'daily' ? 'Every day' : 'Specific days'}
                </button>
              ))}
            </div>
            {repeatType === 'weekly' && (
              <div style={{ display: 'flex', gap: 6 }}>
                {DAY_LABELS.map((label, d) => {
                  const active = weeklyDays.includes(d)
                  return (
                    <button key={d} type="button" onClick={() => toggleDay(d)} style={{
                      flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12,
                      background: active ? 'var(--accent)' : 'var(--surface3)',
                      border: 'none', color: active ? '#fff' : 'var(--text-dim)',
                      cursor: 'pointer', fontWeight: active ? 600 : 400,
                    }}>
                      {label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Stars */}
          <div>
            <div className="field-label" style={{ marginBottom: 10 }}>Stars ⭐</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {STAR_PRESETS.map(v => (
                <button key={v} type="button" onClick={() => { setStarValue(v); setCustomStar('') }} style={{
                  padding: '8px 14px', borderRadius: 8, fontSize: 14,
                  background: starValue === v && !customStar ? 'var(--accent)' : 'var(--surface2)',
                  border: `2px solid ${starValue === v && !customStar ? 'var(--accent)' : 'var(--border)'}`,
                  color: starValue === v && !customStar ? '#fff' : 'var(--text-dim)',
                  cursor: 'pointer', fontWeight: starValue === v && !customStar ? 600 : 400,
                }}>
                  {v === 0 ? 'None' : v}
                </button>
              ))}
              <input type="number" min={0} placeholder="Custom" value={customStar}
                onChange={e => { setCustomStar(e.target.value); setStarValue(Number(e.target.value) || 0) }}
                style={{ width: 90 }} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', gap: 10, padding: '16px 20px',
          borderTop: '1px solid var(--border)',
        }}>
          {isEdit && onDelete && (
            <button type="button" onClick={handleDelete} disabled={deleting} style={{
              padding: '12px 18px', borderRadius: 10, fontSize: 14, fontWeight: 600,
              background: 'rgba(255,60,60,0.1)', border: '1px solid rgba(255,60,60,0.3)',
              color: '#ff6060', cursor: 'pointer',
            }}>
              {deleting ? '…' : 'Delete'}
            </button>
          )}
          <button type="button" onClick={onClose} style={{
            flex: 1, padding: '12px 0', borderRadius: 10, fontSize: 15, fontWeight: 500,
            background: 'var(--surface2)', border: '1px solid var(--border)',
            color: 'var(--text-dim)', cursor: 'pointer',
          }}>Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving || !canSave} style={{
            flex: 2, padding: '12px 0', borderRadius: 10, fontSize: 15, fontWeight: 600,
            background: 'var(--accent)', border: 'none', color: '#fff', cursor: 'pointer',
            opacity: saving || !canSave ? 0.5 : 1,
          }}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Routine'}
          </button>
        </div>
      </div>
    </>
  )
}
