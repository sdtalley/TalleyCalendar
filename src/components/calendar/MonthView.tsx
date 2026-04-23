'use client'

import { useRef, useState, useEffect } from 'react'
import { getMonthGridDates, sameDay, eventSpansDay, hexToRgba, formatTimeCompact } from '@/lib/utils'
import type { CalendarEvent } from '@/lib/calendar/types'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const EVENT_ROW_H = 22  // px per event pill + gap
const DATE_NUM_H = 28   // px reserved for the day-number row

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface MonthViewProps {
  currentDate: Date
  selectedDate: Date
  events: CalendarEvent[]
  onSelectDate: (date: Date) => void
  onEventClick: (event: CalendarEvent) => void
  onAddEventOnDate?: (date: Date) => void
  onMonthReschedule?: (event: CalendarEvent, newDate: Date) => void
}

export function MonthView({
  currentDate,
  selectedDate,
  events,
  onSelectDate,
  onEventClick,
  onAddEventOnDate,
  onMonthReschedule,
}: MonthViewProps) {
  const today = new Date()
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const gridDates = getMonthGridDates(year, month)
  const numRows = gridDates.length / 7

  const gridRef = useRef<HTMLDivElement>(null)
  const [maxShow, setMaxShow] = useState(3)
  const [meals, setMeals] = useState<Record<string, string>>({})

  // Fetch meals for the visible grid range
  useEffect(() => {
    const start = toDateKey(gridDates[0])
    const end = toDateKey(gridDates[gridDates.length - 1])
    fetch(`/api/meals?start=${start}&end=${end}`)
      .then(r => r.json())
      .then(data => setMeals(data))
      .catch(() => {})
  }, [year, month]) // eslint-disable-line react-hooks/exhaustive-deps

  // Long-press state (shared across cells — only one touch at a time)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressActive = useRef(false)
  const touchStartPos = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    const observer = new ResizeObserver(entries => {
      const h = entries[0].contentRect.height
      const rowH = h / numRows
      const available = rowH - DATE_NUM_H
      setMaxShow(Math.max(1, Math.floor(available / EVENT_ROW_H)))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [numRows])

  // ── Drag-to-day reschedule ──
  const monthDragRef = useRef<{
    event: CalendarEvent
    originDateKey: string
    startX: number
    startY: number
    moved: boolean
  } | null>(null)
  const monthDragTargetRef = useRef<string | null>(null)
  const [monthDragTarget, setMonthDragTarget] = useState<string | null>(null)
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null)
  const suppressClickRef = useRef<string | null>(null)

  function handleEventPillMouseDown(e: React.MouseEvent, ev: CalendarEvent, originDate: Date) {
    if (!onMonthReschedule || (ev.provider !== 'google' && ev.provider !== 'outlook')) return
    if (ev.calendarType === 'work') return

    e.stopPropagation() // prevent day-cell select
    e.preventDefault()

    monthDragRef.current = {
      event: ev,
      originDateKey: toDateKey(originDate),
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    }
    monthDragTargetRef.current = null

    function onMove(me: MouseEvent) {
      const ref = monthDragRef.current
      if (!ref) return
      if (Math.abs(me.clientX - ref.startX) > 6 || Math.abs(me.clientY - ref.startY) > 6) {
        ref.moved = true
      }
      if (!ref.moved) return

      setGhostPos({ x: me.clientX + 14, y: me.clientY - 12 })

      // Find which day cell is under the cursor using data-date attribute
      const el = document.elementFromPoint(me.clientX, me.clientY)
      const cell = el?.closest('[data-date]')
      const dateKey = cell?.getAttribute('data-date') ?? null
      monthDragTargetRef.current = dateKey
      setMonthDragTarget(dateKey)
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)

      const ref = monthDragRef.current
      const target = monthDragTargetRef.current
      monthDragRef.current = null
      monthDragTargetRef.current = null
      setMonthDragTarget(null)
      setGhostPos(null)

      if (ref?.moved && target && target !== ref.originDateKey && onMonthReschedule) {
        suppressClickRef.current = ref.event.id
        // Parse target date key into a Date
        const [y, m, d] = target.split('-').map(Number)
        onMonthReschedule(ref.event, new Date(y, m - 1, d))
      }
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Weekday header */}
      <div
        className="grid grid-cols-7 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}
      >
        {DAYS.map(d => (
          <div
            key={d}
            className="py-2.5 text-center text-[12px] font-semibold uppercase tracking-widest"
            style={{ color: 'var(--text-faint)' }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div
        ref={gridRef}
        className="grid grid-cols-7 flex-1 overflow-hidden"
        style={{ gridTemplateRows: `repeat(${numRows}, 1fr)` }}
      >
        {gridDates.map((date, i) => {
          const isOtherMonth = date.getMonth() !== month
          const isToday = sameDay(date, today)
          const isSelected = sameDay(date, selectedDate)
          const dateKey = toDateKey(date)
          const isDropTarget = monthDragTarget === dateKey && monthDragTarget !== monthDragRef.current?.originDateKey

          const dayAllDay = events.filter(
            e => (e.allDay || !sameDay(e.start, e.end)) && eventSpansDay(e.start, e.end, date, e.allDay)
          )
          const dayTimed = events.filter(
            e => !e.allDay && sameDay(e.start, e.end) && sameDay(e.start, date)
          )
          const dayEvents = [...dayAllDay, ...dayTimed]
          const dinnerName = meals[dateKey] || ''

          return (
            <div
              key={i}
              data-date={dateKey}
              onClick={() => {
                if (longPressActive.current) { longPressActive.current = false; return }
                onSelectDate(date)
              }}
              onDoubleClick={() => onAddEventOnDate?.(date)}
              onTouchStart={e => {
                touchStartPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
                longPressActive.current = false
                if (longPressTimer.current) clearTimeout(longPressTimer.current)
                longPressTimer.current = setTimeout(() => {
                  longPressActive.current = true
                  onAddEventOnDate?.(date)
                }, 600)
              }}
              onTouchMove={e => {
                const dx = e.touches[0].clientX - touchStartPos.current.x
                const dy = e.touches[0].clientY - touchStartPos.current.y
                if (Math.hypot(dx, dy) > 10 && longPressTimer.current) {
                  clearTimeout(longPressTimer.current)
                  longPressTimer.current = null
                }
              }}
              onTouchEnd={() => {
                if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
              }}
              className="flex flex-col p-1 cursor-pointer transition-colors duration-100 overflow-hidden relative"
              style={{
                borderRight: (i + 1) % 7 === 0 ? 'none' : '1px solid var(--border)',
                borderBottom: '1px solid var(--border)',
                opacity: isOtherMonth ? 0.3 : 1,
                background: isDropTarget
                  ? 'rgba(108,140,255,0.18)'
                  : isSelected
                  ? 'rgba(108,140,255,0.1)'
                  : isToday
                  ? 'var(--accent-glow)'
                  : 'transparent',
                boxShadow: isDropTarget
                  ? 'inset 0 0 0 2px var(--accent)'
                  : isSelected
                  ? 'inset 0 0 0 2px var(--accent)'
                  : undefined,
              }}
              onMouseEnter={e => {
                if (!isSelected && !isDropTarget) e.currentTarget.style.background = 'var(--surface2)'
              }}
              onMouseLeave={e => {
                if (!isDropTarget) {
                  e.currentTarget.style.background = isSelected
                    ? 'rgba(108,140,255,0.1)'
                    : isToday
                    ? 'var(--accent-glow)'
                    : 'transparent'
                }
              }}
            >
              {/* Day number */}
              <div className="flex justify-end">
                <span
                  className="text-[13px] font-semibold px-1.5 rounded-full min-w-[26px] text-center leading-[22px]"
                  style={{
                    background: isToday ? 'var(--accent)' : 'transparent',
                    color: isToday ? '#fff' : 'var(--text)',
                  }}
                >
                  {date.getDate()}
                </span>
              </div>

              {/* Events */}
              <div className="flex flex-col gap-[2px] mt-[2px] overflow-hidden flex-1" style={{ paddingBottom: dinnerName ? 18 : 0 }}>
                {dayEvents.slice(0, maxShow).map(ev => {
                  const isAllDayStyle = ev.allDay || !sameDay(ev.start, ev.end)
                  const isDragging = monthDragRef.current?.event.id === ev.id && monthDragRef.current?.moved

                  return (
                    <button
                      key={ev.id}
                      onClick={e => {
                        e.stopPropagation()
                        if (suppressClickRef.current === ev.id) { suppressClickRef.current = null; return }
                        onEventClick(ev)
                      }}
                      onMouseDown={e => handleEventPillMouseDown(e, ev, date)}
                      className="text-[11px] px-1.5 py-[2px] rounded text-left font-medium leading-[1.5] w-full border-none cursor-pointer transition-all duration-100 overflow-hidden"
                      style={{
                        opacity: isDragging ? 0.35 : 1,
                        cursor: onMonthReschedule && (ev.provider === 'google' || ev.provider === 'outlook') && ev.calendarType !== 'work' ? 'grab' : 'pointer',
                        ...(isAllDayStyle
                          ? { background: hexToRgba(ev.color, 0.3), color: ev.color, borderRadius: '3px' }
                          : { background: hexToRgba(ev.color, 0.13), color: ev.color, borderLeft: `3px solid ${ev.color}` }),
                      }}
                      onMouseEnter={e => { if (!isDragging) e.currentTarget.style.filter = 'brightness(1.2)' }}
                      onMouseLeave={e => { e.currentTarget.style.filter = '' }}
                    >
                      {isAllDayStyle ? (
                        <span className="block truncate">{ev.title}</span>
                      ) : (
                        <span className="flex items-baseline gap-0.5">
                          <span className="flex-1 min-w-0 truncate">{ev.title}</span>
                          <span className="hidden md:inline flex-shrink-0 text-[10px] opacity-60">
                            {formatTimeCompact(ev.start)}
                          </span>
                        </span>
                      )}
                    </button>
                  )
                })}
                {dayEvents.length > maxShow && (
                  <div className="text-[10px] font-semibold px-1.5" style={{ color: 'var(--text-faint)' }}>
                    +{dayEvents.length - maxShow} more
                  </div>
                )}
              </div>

              {/* Dinner pill */}
              {dinnerName && (
                <div
                  style={{
                    position: 'absolute', bottom: 2, left: 2, right: 2,
                    fontSize: 10, fontWeight: 600, color: '#f59e0b',
                    background: 'rgba(245,158,11,0.15)',
                    borderLeft: '3px solid #f59e0b',
                    borderRadius: '0 3px 3px 0',
                    padding: '1px 4px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                >
                  {dinnerName}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Floating drag ghost */}
      {ghostPos && monthDragRef.current?.moved && (
        <div
          className="fixed pointer-events-none z-50 rounded px-2 py-1 text-[11px] font-semibold shadow-lg"
          style={{
            left: ghostPos.x,
            top: ghostPos.y,
            background: monthDragRef.current.event.color,
            color: '#fff',
            maxWidth: 160,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {monthDragRef.current.event.title}
        </div>
      )}
    </div>
  )
}
