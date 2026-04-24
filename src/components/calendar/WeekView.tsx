'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useDrag } from '@use-gesture/react'
import { getWeekDates, sameDay, eventSpansDay, hexToRgba, formatTime, formatTimeRange } from '@/lib/utils'
import type { CalendarEvent, FamilyMemberUI } from '@/lib/calendar/types'

function getMemberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return (parts[0][0] ?? '?').toUpperCase()
  return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase()
}

function getAvatarContent(m: FamilyMemberUI): { content: string; isEmoji: boolean } {
  if (m.avatar?.type === 'emoji') return { content: m.avatar.value, isEmoji: true }
  if (m.avatar?.type === 'initials' && m.avatar.value) return { content: m.avatar.value, isEmoji: false }
  return { content: getMemberInitials(m.name), isEmoji: false }
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const HOUR_HEIGHT = 60 // px per hour

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function snapToQuarter(minutes: number): number {
  return Math.round(minutes / 15) * 15
}

interface WeekViewProps {
  currentDate: Date
  events: CalendarEvent[]
  familyMembers?: FamilyMemberUI[]
  onEventClick: (event: CalendarEvent) => void
  onReschedule?: (event: CalendarEvent, newDate: Date, newStartMinutes: number) => void
  numDays?: number
}

// ── Overlap layout ─────────────────────────────────────────────────────────
// Assigns each event a column index and total column count so overlapping
// events render side-by-side instead of stacking.

function layoutDayEvents(
  events: CalendarEvent[]
): Array<{ event: CalendarEvent; col: number; totalCols: number }> {
  if (!events.length) return []
  const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime())
  const colEndTimes: number[] = []
  const cols: number[] = []

  for (const ev of sorted) {
    let col = 0
    while (col < colEndTimes.length && colEndTimes[col] > ev.start.getTime()) col++
    cols.push(col)
    colEndTimes[col] = ev.end.getTime()
  }

  return sorted.map((event, i) => {
    let totalCols = cols[i] + 1
    for (let j = 0; j < sorted.length; j++) {
      if (i === j) continue
      if (sorted[i].start.getTime() < sorted[j].end.getTime() &&
          sorted[i].end.getTime() > sorted[j].start.getTime()) {
        totalCols = Math.max(totalCols, cols[j] + 1)
      }
    }
    return { event, col: cols[i], totalCols }
  })
}

// ── DraggableEventBlock ────────────────────────────────────────────────────

interface DraggableEventBlockProps {
  ev: CalendarEvent
  top: number
  height: number
  colLeft: number
  colWidth: number
  dayIndex: number
  columnRefs: React.MutableRefObject<(HTMLDivElement | null)[]>
  bodyRef: React.RefObject<HTMLDivElement>
  weekDates: Date[]
  familyMembers: FamilyMemberUI[]
  onEventClick: (ev: CalendarEvent) => void
  onReschedule?: (ev: CalendarEvent, newDate: Date, topMin: number) => void
  onGhostChange: (ghost: { dayIndex: number; topMin: number; event: CalendarEvent } | null) => void
  isGhosting: boolean
}

function DraggableEventBlock({
  ev, top, height, colLeft, colWidth, dayIndex, columnRefs, bodyRef, weekDates, familyMembers,
  onEventClick, onReschedule, onGhostChange, isGhosting,
}: DraggableEventBlockProps) {
  const member = familyMembers.find(m => m.id === ev.familyMemberId)
  const avatar = member ? getAvatarContent(member) : null
  const isDraggable = !!onReschedule &&
    (ev.provider === 'google' || ev.provider === 'outlook') &&
    ev.calendarType !== 'work'

  const startMin = ev.start.getHours() * 60 + ev.start.getMinutes()
  const durationMin = Math.max(15, (ev.end.getTime() - ev.start.getTime()) / 60000)

  const clickOffsetRef = useRef(0)
  const ghostPosRef = useRef<{ dayIndex: number; topMin: number } | null>(null)
  const lastXYRef = useRef<[number, number] | null>(null)
  const scrollAnimRef = useRef<number | null>(null)

  function computeGhost(clientX: number, clientY: number) {
    let targetDayIndex = dayIndex
    let targetCol = columnRefs.current[targetDayIndex]
    for (let i = 0; i < columnRefs.current.length; i++) {
      const c = columnRefs.current[i]
      if (!c) continue
      const r = c.getBoundingClientRect()
      if (clientX >= r.left && clientX <= r.right) {
        targetDayIndex = i
        targetCol = c
        break
      }
    }
    if (!targetCol) return
    const rect = targetCol.getBoundingClientRect()
    const y = clientY - rect.top + (bodyRef.current?.scrollTop ?? 0)
    const topMin = snapToQuarter(
      Math.max(0, Math.min(24 * 60 - durationMin, (y / (24 * HOUR_HEIGHT)) * 1440 - clickOffsetRef.current))
    )
    ghostPosRef.current = { dayIndex: targetDayIndex, topMin }
    onGhostChange({ dayIndex: targetDayIndex, topMin, event: ev })
  }

  function stopEdgeScroll() {
    if (scrollAnimRef.current !== null) {
      cancelAnimationFrame(scrollAnimRef.current)
      scrollAnimRef.current = null
    }
  }

  function startEdgeScroll() {
    if (scrollAnimRef.current !== null) return
    const EDGE_ZONE = 60
    const MAX_SPEED = 10
    function tick() {
      const xy = lastXYRef.current
      const body = bodyRef.current
      if (!xy || !body) { scrollAnimRef.current = null; return }
      const rect = body.getBoundingClientRect()
      const distTop = xy[1] - rect.top
      const distBot = rect.bottom - xy[1]
      let delta = 0
      if (distTop < EDGE_ZONE && distTop >= 0) delta = -MAX_SPEED * (1 - distTop / EDGE_ZONE)
      else if (distBot < EDGE_ZONE && distBot >= 0) delta = MAX_SPEED * (1 - distBot / EDGE_ZONE)
      if (delta !== 0) {
        body.scrollTop += delta
        computeGhost(xy[0], xy[1])
      }
      scrollAnimRef.current = requestAnimationFrame(tick)
    }
    scrollAnimRef.current = requestAnimationFrame(tick)
  }

  const bind = useDrag(
    ({ first, last, tap, xy: [cx, cy] }) => {
      if (tap) return

      if (first) {
        const col = columnRefs.current[dayIndex]
        const rect = col?.getBoundingClientRect()
        const scrollTop = bodyRef.current?.scrollTop ?? 0
        const clickMin = rect
          ? snapToQuarter(((cy - rect.top + scrollTop) / (24 * HOUR_HEIGHT)) * 1440)
          : startMin
        clickOffsetRef.current = Math.max(0, clickMin - startMin)
      }

      lastXYRef.current = [cx, cy]

      if (last) {
        stopEdgeScroll()
        lastXYRef.current = null
        const finalPos = ghostPosRef.current
        ghostPosRef.current = null
        onGhostChange(null)
        if (finalPos && onReschedule) {
          if (ev.calendarType === 'personal') {
            const time = formatTime(new Date(0, 0, 0, Math.floor(finalPos.topMin / 60), finalPos.topMin % 60))
            if (!window.confirm(`Move "${ev.title}" to ${time}?\n\nThis is a personal event.`)) return
          }
          onReschedule(ev, weekDates[finalPos.dayIndex], finalPos.topMin)
        }
        return
      }

      computeGhost(cx, cy)
      startEdgeScroll()
    },
    { filterTaps: true, pointer: { capture: true }, enabled: isDraggable }
  )

  return (
    <button
      {...bind()}
      data-event-id={ev.id}
      onClick={() => onEventClick(ev)}
      className="absolute rounded-md px-2 py-1 text-[11px] font-medium overflow-hidden border-none text-left transition-all duration-100"
      style={{
        top,
        height,
        left: `calc(${colLeft * 100}% + 2px)`,
        width: `calc(${colWidth * 100}% - 4px)`,
        background: hexToRgba(ev.color, isGhosting ? 0.08 : 0.2),
        color: ev.color,
        borderLeft: `3px solid ${ev.color}`,
        opacity: isGhosting ? 0.4 : 1,
        zIndex: 2,
        lineHeight: 1.3,
        cursor: isDraggable ? 'grab' : 'pointer',
        touchAction: isDraggable ? 'none' : 'auto',
      }}
      onMouseEnter={e => {
        if (!isGhosting) {
          e.currentTarget.style.filter = 'brightness(1.2)'
          e.currentTarget.style.zIndex = '3'
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.filter = ''
        e.currentTarget.style.zIndex = '2'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, height: '100%' }}>
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <div style={{ fontWeight: 600, fontSize: 11, lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {ev.title}
          </div>
          {height > 28 && !ev.allDay && (
            <div style={{ fontSize: 9.5, marginTop: 1, lineHeight: 1.2, opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {formatTimeRange(ev.start, ev.end)}
            </div>
          )}
        </div>
        {avatar && (
          <span style={{
            width: 13, height: 13, borderRadius: '50%', background: ev.color, color: '#fff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: avatar.isEmoji ? 7 : 5, fontWeight: 700, flexShrink: 0, lineHeight: 1,
          }}>
            {avatar.content}
          </span>
        )}
      </div>
    </button>
  )
}

// ── WeekView ───────────────────────────────────────────────────────────────

export function WeekView({ currentDate, events, familyMembers = [], onEventClick, onReschedule, numDays = 7 }: WeekViewProps) {
  const today = new Date()
  const weekDates = getWeekDates(currentDate).slice(0, numDays)
  const bodyRef = useRef<HTMLDivElement>(null)
  const columnRefs = useRef<(HTMLDivElement | null)[]>([])

  const allDayEvents = events.filter(e => e.allDay || !sameDay(e.start, e.end))
  const timedEvents = events.filter(e => !e.allDay && sameDay(e.start, e.end))

  const allDayByDay = weekDates.map(day =>
    allDayEvents.filter(e => eventSpansDay(e.start, e.end, day, e.allDay))
  )
  const maxAllDay = Math.max(0, ...allDayByDay.map(d => d.length))

  const [meals, setMeals] = useState<Record<string, string>>({})
  const [reschedView, setReschedView] = useState<{ dayIndex: number; topMin: number; event: CalendarEvent } | null>(null)

  useEffect(() => {
    const start = toDateKey(weekDates[0])
    const end = toDateKey(weekDates[weekDates.length - 1])
    fetch(`/api/meals?start=${start}&end=${end}`)
      .then(r => r.json())
      .then(data => setMeals(data))
      .catch(() => {})
  }, [weekDates[0].toISOString()]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 7 * HOUR_HEIGHT
  }, [])

  const handleGhostChange = useCallback(
    (ghost: { dayIndex: number; topMin: number; event: CalendarEvent } | null) => setReschedView(ghost),
    []
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header row */}
      <div
        className="flex-shrink-0 grid"
        style={{
          gridTemplateColumns: `60px repeat(${numDays}, 1fr)`,
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
        }}
      >
        <div />
        {weekDates.map((d, i) => {
          const isToday = sameDay(d, today)
          return (
            <div key={i} className="py-2.5 px-2 text-center text-[12px]" style={{ color: 'var(--text-dim)' }}>
              <div className="uppercase tracking-wider text-[11px]">
                {d.toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
              <div
                className="text-[24px] font-bold leading-tight mt-0.5"
                style={{ color: isToday ? 'var(--accent)' : 'var(--text)' }}
              >
                {d.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* All-day section */}
      {maxAllDay > 0 && (
        <div
          className="flex-shrink-0 grid"
          style={{
            gridTemplateColumns: `60px repeat(${numDays}, 1fr)`,
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
          }}
        >
          <div
            className="font-mono text-[10px] text-right pr-2 flex items-center justify-end"
            style={{ color: 'var(--text-faint)' }}
          >
            all day
          </div>
          {weekDates.map((day, di) => (
            <div
              key={di}
              className="flex flex-col gap-[2px] py-1 px-[2px]"
              style={{ borderLeft: '1px solid var(--border)', minHeight: 28 }}
            >
              {allDayByDay[di].map(ev => (
                <button
                  key={ev.id}
                  onClick={() => onEventClick(ev)}
                  className="text-[10px] px-1.5 py-[1px] rounded font-medium truncate w-full border-none cursor-pointer text-left transition-all duration-100"
                  style={{
                    background: hexToRgba(ev.color, 0.3),
                    color: ev.color,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.2)')}
                  onMouseLeave={e => (e.currentTarget.style.filter = '')}
                >
                  {ev.title}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Dinner band row */}
      <div
        className="flex-shrink-0 grid"
        style={{
          gridTemplateColumns: `60px repeat(${numDays}, 1fr)`,
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
        }}
      >
        <div
          className="font-mono text-[10px] text-right pr-2 flex items-center justify-end"
          style={{ color: 'var(--text-faint)' }}
        >
          dinner
        </div>
        {weekDates.map((day, di) => {
          const dinnerName = meals[toDateKey(day)] ?? ''
          return (
            <div
              key={di}
              className="py-1 px-[2px]"
              style={{ borderLeft: '1px solid var(--border)', minHeight: 24 }}
            >
              {dinnerName && (
                <div
                  className="text-[10px] px-1.5 py-[1px] rounded font-semibold truncate"
                  style={{
                    background: 'rgba(245,158,11,0.15)',
                    color: '#f59e0b',
                    borderLeft: '3px solid #f59e0b',
                    borderRadius: '0 3px 3px 0',
                  }}
                >
                  {dinnerName}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Scrollable body */}
      <div
        ref={bodyRef}
        className="flex-1 overflow-y-auto relative"
        style={{ display: 'grid', gridTemplateColumns: `60px repeat(${numDays}, 1fr)`, touchAction: 'pan-y' }}
      >
        {/* Time labels */}
        <div className="flex flex-col">
          {HOURS.map(h => (
            <div
              key={h}
              className="font-mono text-[11px] text-right pr-2 flex-shrink-0"
              style={{
                height: HOUR_HEIGHT,
                color: 'var(--text-faint)',
                paddingTop: 0,
                transform: 'translateY(-7px)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'flex-end',
              }}
            >
              {h === 0 ? '' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {weekDates.map((day, di) => {
          const dayEvents = timedEvents.filter(e => sameDay(e.start, day))
          const layout = layoutDayEvents(dayEvents)
          const nowMinutes = today.getHours() * 60 + today.getMinutes()

          return (
            <div
              key={di}
              ref={el => { columnRefs.current[di] = el }}
              className="relative select-none"
              style={{ borderLeft: '1px solid var(--border)' }}
            >
              {/* Hour lines */}
              {HOURS.map(h => (
                <div
                  key={h}
                  style={{ height: HOUR_HEIGHT, borderBottom: '1px solid var(--border)' }}
                />
              ))}

              {/* Events — side-by-side when overlapping */}
              {layout.map(({ event: ev, col, totalCols }) => {
                const startMin = ev.start.getHours() * 60 + ev.start.getMinutes()
                const endMin = ev.end.getHours() * 60 + ev.end.getMinutes()
                const top = (startMin / 60) * HOUR_HEIGHT
                const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 20)

                return (
                  <DraggableEventBlock
                    key={ev.id}
                    ev={ev}
                    top={top}
                    height={height}
                    colLeft={col / totalCols}
                    colWidth={1 / totalCols}
                    dayIndex={di}
                    columnRefs={columnRefs}
                    bodyRef={bodyRef}
                    weekDates={weekDates}
                    familyMembers={familyMembers}
                    onEventClick={onEventClick}
                    onReschedule={onReschedule}
                    onGhostChange={handleGhostChange}
                    isGhosting={reschedView?.event.id === ev.id}
                  />
                )
              })}

              {/* Drag-to-reschedule ghost */}
              {reschedView && reschedView.dayIndex === di && (() => {
                const ghostHeight = Math.max(
                  (reschedView.event.end.getTime() - reschedView.event.start.getTime()) / 60000 / 60 * HOUR_HEIGHT,
                  20
                )
                return (
                  <div
                    className="absolute left-[2px] right-[2px] rounded-md px-2 py-1 text-[11px] font-medium overflow-hidden pointer-events-none"
                    style={{
                      top: (reschedView.topMin / 60) * HOUR_HEIGHT,
                      height: ghostHeight,
                      background: hexToRgba(reschedView.event.color, 0.35),
                      color: reschedView.event.color,
                      border: `2px dashed ${reschedView.event.color}`,
                      zIndex: 10,
                      lineHeight: 1.3,
                    }}
                  >
                    <div>{reschedView.event.title}</div>
                  </div>
                )
              })()}

              {/* Current time line */}
              {sameDay(day, today) && (
                <div
                  className="now-line"
                  style={{ top: (nowMinutes / 60) * HOUR_HEIGHT }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
