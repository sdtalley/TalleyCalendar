'use client'

import { useState } from 'react'
import { sameDay, getMonthGridDates } from '@/lib/utils'

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

interface MiniCalendarProps {
  selectedDate: Date
  onSelectDate: (date: Date) => void
}

export function MiniCalendar({ selectedDate, onSelectDate }: MiniCalendarProps) {
  const today = new Date()
  const [viewDate, setViewDate] = useState(new Date(selectedDate))
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const gridDates = getMonthGridDates(year, month)

  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

  function prevMonth() {
    setViewDate(new Date(year, month - 1, 1))
  }
  function nextMonth() {
    setViewDate(new Date(year, month + 1, 1))
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <button
          onClick={prevMonth}
          className="w-5 h-5 flex items-center justify-center rounded text-[11px] border-none cursor-pointer"
          style={{ background: 'transparent', color: 'var(--text-dim)' }}
        >
          ‹
        </button>
        <span className="text-[11px] font-semibold" style={{ color: 'var(--text-dim)' }}>
          {monthLabel}
        </span>
        <button
          onClick={nextMonth}
          className="w-5 h-5 flex items-center justify-center rounded text-[11px] border-none cursor-pointer"
          style={{ background: 'transparent', color: 'var(--text-dim)' }}
        >
          ›
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-0">
        {DAYS.map((d, i) => (
          <div
            key={i}
            className="text-[9px] font-semibold text-center py-0.5"
            style={{ color: 'var(--text-faint)' }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-7 gap-0">
        {gridDates.map((date, i) => {
          const isOtherMonth = date.getMonth() !== month
          const isToday = sameDay(date, today)
          const isSelected = sameDay(date, selectedDate)

          return (
            <button
              key={i}
              onClick={() => onSelectDate(date)}
              className="w-full aspect-square flex items-center justify-center text-[10px] rounded-full border-none cursor-pointer transition-all duration-100"
              style={{
                background: isSelected
                  ? 'var(--accent)'
                  : isToday
                  ? 'var(--accent-glow)'
                  : 'transparent',
                color: isSelected
                  ? '#fff'
                  : isOtherMonth
                  ? 'var(--text-faint)'
                  : isToday
                  ? 'var(--accent)'
                  : 'var(--text-dim)',
                fontWeight: isToday || isSelected ? 700 : 400,
              }}
            >
              {date.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}
