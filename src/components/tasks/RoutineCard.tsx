'use client'

import { useState, useRef, useCallback } from 'react'
import type { Routine, RoutineCompletion, FamilyMember } from '@/lib/calendar/types'
import type { ReactNode } from 'react'

const TIME_BLOCK_LABELS = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' }
const TIME_BLOCK_COLORS = { morning: '#fbbf24', afternoon: '#34d399', evening: '#818cf8' }

interface RoutineCardProps {
  routine:    Routine
  completion: RoutineCompletion | null
  members:    FamilyMember[]
  viewDate:   string
  currentMemberId?: string | null
  onComplete:  (id: string, date: string, memberId?: string) => Promise<void>
  onUncomplete:(id: string, date: string) => Promise<void>
  onSkip:      (id: string, date: string, memberId?: string) => Promise<void>
  onUnskip:    (id: string, date: string) => Promise<void>
  onEdit?:     (routine: Routine) => void
  dragHandle?: ReactNode
}

export function RoutineCard({
  routine,
  completion,
  members,
  viewDate,
  currentMemberId,
  onComplete,
  onUncomplete,
  onSkip,
  onUnskip,
  onEdit,
  dragHandle,
}: RoutineCardProps) {
  const [celebrating, setCelebrating] = useState(false)
  const [showSkipMenu, setShowSkipMenu] = useState(false)
  const [busy, setBusy] = useState(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const assignedMembers = members.filter(m => routine.memberIds.includes(m.id))
  const isComplete = completion?.status === 'complete'
  const isSkipped  = completion?.status === 'skipped'

  const handleCircleClick = useCallback(async () => {
    if (busy) return
    setBusy(true)
    setShowSkipMenu(false)
    try {
      if (isComplete) {
        await onUncomplete(routine.id, viewDate)
      } else if (isSkipped) {
        await onUnskip(routine.id, viewDate)
      } else {
        setCelebrating(true)
        await onComplete(routine.id, viewDate, currentMemberId ?? undefined)
        setTimeout(() => setCelebrating(false), 900)
      }
    } finally {
      setBusy(false)
    }
  }, [busy, isComplete, isSkipped, routine.id, viewDate, currentMemberId, onComplete, onUncomplete, onUnskip])

  const handlePointerDown = useCallback(() => {
    longPressTimer.current = setTimeout(() => setShowSkipMenu(true), 500)
  }, [])

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
  }, [])

  const handleSkip = useCallback(async () => {
    if (busy) return
    setShowSkipMenu(false)
    setBusy(true)
    try { await onSkip(routine.id, viewDate, currentMemberId ?? undefined) }
    finally { setBusy(false) }
  }, [busy, routine.id, viewDate, currentMemberId, onSkip])

  const repeatLabel = routine.repeat === 'daily'
    ? 'Daily'
    : `Weekly · ${(routine.repeat as { weekly: number[] }).weekly
        .map(d => ['Su','Mo','Tu','We','Th','Fr','Sa'][d]).join(' ')}`

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        background: isComplete ? 'var(--surface)' : 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        opacity: isSkipped ? 0.5 : 1,
        transition: 'opacity 0.2s',
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Drag handle (admin only, injected from SortableBlock) */}
      {dragHandle}

      {/* Emoji */}
      <div style={{ fontSize: 24, width: 32, textAlign: 'center', flexShrink: 0 }}>
        {routine.emoji ?? '🔄'}
      </div>

      {/* Title + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 15,
          fontWeight: 500,
          color: isComplete || isSkipped ? 'var(--text-dim)' : 'var(--text)',
          textDecoration: isSkipped ? 'line-through' : 'none',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {routine.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {assignedMembers.map(m => (
              <div key={m.id} title={m.name} style={{
                width: 7, height: 7, borderRadius: '50%', background: m.color, flexShrink: 0,
              }} />
            ))}
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{repeatLabel}</span>
          {routine.starValue > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>⭐ {routine.starValue}</span>
          )}
        </div>
      </div>

      {/* Edit button */}
      {onEdit && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onEdit(routine) }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-faint)', fontSize: 13, padding: '4px 6px',
            borderRadius: 6, flexShrink: 0,
          }}
        >
          ✏️
        </button>
      )}

      {/* Circle checkbox */}
      <button
        type="button"
        onClick={handleCircleClick}
        disabled={busy}
        style={{
          width: 30, height: 30, borderRadius: '50%',
          border: isComplete ? 'none' : '2.5px solid var(--border)',
          background: isComplete ? TIME_BLOCK_COLORS[(routine.timeBlocks?.[0] ?? routine.timeBlock) as keyof typeof TIME_BLOCK_COLORS ?? 'morning'] : 'transparent',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, fontSize: 14, transition: 'all 0.15s',
          color: isComplete ? '#fff' : 'transparent',
        }}
      >
        {isComplete ? '✓' : isSkipped ? '−' : ''}
      </button>

      {/* Celebration burst */}
      {celebrating && <MiniCelebration color={TIME_BLOCK_COLORS[(routine.timeBlocks?.[0] ?? routine.timeBlock) as keyof typeof TIME_BLOCK_COLORS ?? 'morning']} />}

      {/* Skip menu */}
      {showSkipMenu && (
        <div
          style={{
            position: 'absolute', right: 50, top: '50%', transform: 'translateY(-50%)',
            background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: 8, boxShadow: 'var(--shadow)', zIndex: 10, overflow: 'hidden',
          }}
          onClick={e => e.stopPropagation()}
        >
          <button type="button" onClick={handleSkip}
            style={{ display: 'block', width: '100%', padding: '10px 20px', background: 'none',
              border: 'none', color: 'var(--text)', fontSize: 14, cursor: 'pointer', textAlign: 'left', whiteSpace: 'nowrap' }}>
            Skip today
          </button>
          <button type="button" onClick={() => setShowSkipMenu(false)}
            style={{ display: 'block', width: '100%', padding: '10px 20px', background: 'none',
              border: 'none', color: 'var(--text-dim)', fontSize: 14, cursor: 'pointer', textAlign: 'left' }}>
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

function MiniCelebration({ color }: { color: string }) {
  const pieces = Array.from({ length: 8 }, (_, i) => ({
    angle: (i / 8) * 360,
    tx: Math.cos(((i / 8) * 360 * Math.PI) / 180) * 36,
    ty: Math.sin(((i / 8) * 360 * Math.PI) / 180) * 36,
  }))
  return (
    <div style={{ position: 'absolute', right: 14, top: '50%', pointerEvents: 'none', zIndex: 20 }}>
      {pieces.map(({ tx, ty }, i) => (
        <div key={i} style={{
          position: 'absolute', width: 7, height: 7, borderRadius: '50%', background: color,
          transform: 'translate(-50%,-50%)',
          animation: `mini-burst-${i} 0.75s ease-out forwards`,
        }} />
      ))}
      <style>{pieces.map(({ tx, ty }, i) => `
        @keyframes mini-burst-${i} {
          0%   { transform: translate(-50%,-50%) scale(1); opacity:1; }
          100% { transform: translate(calc(-50% + ${tx}px),calc(-50% + ${ty}px)) scale(0); opacity:0; }
        }
      `).join('')}</style>
    </div>
  )
}
