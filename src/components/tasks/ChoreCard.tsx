'use client'

import { useState, useRef, useCallback } from 'react'
import type { Chore, ChoreCompletion, FamilyMember } from '@/lib/calendar/types'

interface ChoreCardProps {
  chore:       Chore
  completion:  ChoreCompletion | null
  members:     FamilyMember[]
  viewDate:    string   // YYYY-MM-DD
  currentMemberId?: string | null
  isOverdue?:  boolean
  onComplete:  (choreId: string, date: string, memberId?: string) => Promise<void>
  onUncomplete:(choreId: string, date: string) => Promise<void>
  onSkip:      (choreId: string, date: string, memberId?: string) => Promise<void>
  onUnskip:    (choreId: string, date: string) => Promise<void>
  onEdit?:     (chore: Chore) => void
}

export function ChoreCard({
  chore,
  completion,
  members,
  viewDate,
  currentMemberId,
  isOverdue,
  onComplete,
  onUncomplete,
  onSkip,
  onUnskip,
  onEdit,
}: ChoreCardProps) {
  const [celebrating, setCelebrating] = useState(false)
  const [showSkipMenu, setShowSkipMenu] = useState(false)
  const [busy, setBusy] = useState(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const assignedMembers = members.filter(m => chore.memberIds.includes(m.id))

  const handleCircleClick = useCallback(async () => {
    if (busy) return
    setBusy(true)
    setShowSkipMenu(false)
    try {
      if (completion?.status === 'complete') {
        await onUncomplete(chore.id, viewDate)
      } else if (completion?.status === 'skipped') {
        await onUnskip(chore.id, viewDate)
      } else {
        setCelebrating(true)
        await onComplete(chore.id, viewDate, currentMemberId ?? undefined)
        setTimeout(() => setCelebrating(false), 900)
      }
    } finally {
      setBusy(false)
    }
  }, [busy, completion, chore.id, viewDate, currentMemberId, onComplete, onUncomplete, onUnskip])

  const handlePointerDown = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      setShowSkipMenu(true)
    }, 500)
  }, [])

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const handleSkip = useCallback(async () => {
    if (busy) return
    setShowSkipMenu(false)
    setBusy(true)
    try {
      await onSkip(chore.id, viewDate, currentMemberId ?? undefined)
    } finally {
      setBusy(false)
    }
  }, [busy, chore.id, viewDate, currentMemberId, onSkip])

  const isComplete = completion?.status === 'complete'
  const isSkipped  = completion?.status === 'skipped'

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        background: isComplete ? 'var(--surface)' : isOverdue ? 'rgba(255,166,0,0.07)' : 'var(--surface)',
        border: `1px solid ${isOverdue && !isComplete ? 'rgba(255,166,0,0.3)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        opacity: isSkipped ? 0.5 : 1,
        transition: 'opacity 0.2s',
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Emoji */}
      <div style={{ fontSize: 28, width: 36, textAlign: 'center', flexShrink: 0 }}>
        {chore.emoji ?? '📋'}
      </div>

      {/* Title + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 16,
          fontWeight: 500,
          color: isComplete || isSkipped ? 'var(--text-dim)' : 'var(--text)',
          textDecoration: isSkipped ? 'line-through' : 'none',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {chore.title}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          {/* Member dots */}
          <div style={{ display: 'flex', gap: 4 }}>
            {assignedMembers.map(m => (
              <div
                key={m.id}
                title={m.name}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: m.color,
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
          {/* Time */}
          {chore.time && (
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{chore.time}</span>
          )}
          {/* Overdue badge */}
          {isOverdue && !isComplete && (
            <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>OVERDUE</span>
          )}
          {/* Repeat indicator */}
          {chore.repeat && (
            <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>↻</span>
          )}
          {/* Stars */}
          {chore.starValue > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>⭐ {chore.starValue}</span>
          )}
        </div>
      </div>

      {/* Edit button (shown on hover via CSS, always accessible on touch) */}
      {onEdit && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onEdit(chore) }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-faint)',
            fontSize: 14,
            padding: '4px 6px',
            borderRadius: 6,
            flexShrink: 0,
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
          width: 32,
          height: 32,
          borderRadius: '50%',
          border: isComplete
            ? 'none'
            : `2.5px solid ${isOverdue ? '#f59e0b' : 'var(--border)'}`,
          background: isComplete ? 'var(--accent)' : 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: 16,
          transition: 'all 0.15s',
        }}
      >
        {isComplete ? '✓' : isSkipped ? '−' : ''}
      </button>

      {/* Celebration burst */}
      {celebrating && <CelebrationBurst />}

      {/* Skip menu */}
      {showSkipMenu && (
        <div
          style={{
            position: 'absolute',
            right: 56,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: 'var(--shadow)',
            zIndex: 10,
            overflow: 'hidden',
          }}
          onClick={e => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={handleSkip}
            style={{
              display: 'block',
              width: '100%',
              padding: '10px 20px',
              background: 'none',
              border: 'none',
              color: 'var(--text)',
              fontSize: 14,
              cursor: 'pointer',
              textAlign: 'left',
              whiteSpace: 'nowrap',
            }}
          >
            Skip this time
          </button>
          <button
            type="button"
            onClick={() => setShowSkipMenu(false)}
            style={{
              display: 'block',
              width: '100%',
              padding: '10px 20px',
              background: 'none',
              border: 'none',
              color: 'var(--text-dim)',
              fontSize: 14,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

function CelebrationBurst() {
  const COLORS = ['#6c8cff', '#ff6b8a', '#4ecdc4', '#ffd166', '#a78bfa', '#ff8c42']
  const pieces = Array.from({ length: 10 }, (_, i) => {
    const angle = (i / 10) * 360
    const color = COLORS[i % COLORS.length]
    return { angle, color }
  })

  return (
    <div style={{ position: 'absolute', right: 16, top: '50%', pointerEvents: 'none', zIndex: 20 }}>
      {pieces.map(({ angle, color }, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: color,
            transform: 'translate(-50%, -50%)',
            animation: `burst-${i} 0.8s ease-out forwards`,
            '--tx': `${Math.cos((angle * Math.PI) / 180) * 40}px`,
            '--ty': `${Math.sin((angle * Math.PI) / 180) * 40}px`,
          } as React.CSSProperties}
        />
      ))}
      <style>{`
        ${pieces.map((_, i) => {
          const a = (i / 10) * 360
          const tx = Math.cos((a * Math.PI) / 180) * 45
          const ty = Math.sin((a * Math.PI) / 180) * 45
          return `
            @keyframes burst-${i} {
              0%   { transform: translate(-50%,-50%) scale(1); opacity: 1; }
              100% { transform: translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(0); opacity: 0; }
            }
          `
        }).join('')}
      `}</style>
    </div>
  )
}
