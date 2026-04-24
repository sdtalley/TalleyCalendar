/** Returns true if two dates fall on the same calendar day */
export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Format a time as "9a", "9:30a", "12p", "3:45p" — compact month-cell format */
export function formatTimeCompact(date: Date): string {
  const h = date.getHours()
  const m = date.getMinutes()
  const suffix = h >= 12 ? 'p' : 'a'
  const hh = h % 12 || 12
  return m === 0 ? `${hh}${suffix}` : `${hh}:${String(m).padStart(2, '0')}${suffix}`
}

/** Format a time as "9:00 AM" */
export function formatTime(date: Date): string {
  const h = date.getHours()
  const m = date.getMinutes()
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hh = h % 12 || 12
  return `${hh}:${String(m).padStart(2, '0')} ${ampm}`
}

/** Format a date as "Mon, Apr 3" */
export function formatDateShort(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/** Format a date as "April 2026" */
export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

/** Return Monday-start array of 42 dates for a month grid */
export function getMonthGridDates(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1).getDay() // 0=Sun
  const dates: Date[] = []
  for (let i = 0; i < 42; i++) {
    dates.push(new Date(year, month, 1 - firstDay + i))
  }
  return dates
}

/** Return the 7 dates of the week containing `date` (Sun→Sat) */
export function getWeekDates(date: Date): Date[] {
  const start = new Date(date)
  start.setDate(start.getDate() - start.getDay())
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return d
  })
}

/** Convert hex color to rgba with given opacity */
export function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${opacity})`
}

/** Format a time without :00 for whole hours — "9 AM", "9:30 AM" */
export function formatTimeShort(date: Date): string {
  const h = date.getHours() % 12 || 12
  const m = date.getMinutes()
  const suffix = date.getHours() < 12 ? 'AM' : 'PM'
  return m === 0 ? `${h} ${suffix}` : `${h}:${String(m).padStart(2, '0')} ${suffix}`
}

/** Format a time range — "9 – 10:30 AM" or "11 AM – 1 PM" */
export function formatTimeRange(start: Date, end: Date): string {
  const startSuffix = start.getHours() < 12 ? 'AM' : 'PM'
  const endSuffix = end.getHours() < 12 ? 'AM' : 'PM'
  const fmt = (d: Date, showSuffix: boolean): string => {
    const h = d.getHours() % 12 || 12
    const m = d.getMinutes()
    const s = showSuffix ? ` ${d.getHours() < 12 ? 'AM' : 'PM'}` : ''
    return m === 0 ? `${h}${s}` : `${h}:${String(m).padStart(2, '0')}${s}`
  }
  if (startSuffix === endSuffix) return `${fmt(start, false)} – ${fmt(end, true)}`
  return `${fmt(start, true)} – ${fmt(end, true)}`
}

/** Returns true if an event overlaps with a given calendar day.
 *  Pass allDay=true for all-day events so UTC day boundaries are used,
 *  avoiding timezone-induced day-shift (e.g. UTC midnight → prev day local). */
export function eventSpansDay(
  eventStart: Date,
  eventEnd: Date,
  day: Date,
  allDay = false
): boolean {
  if (allDay) {
    // All-day event dates are stored as UTC midnight; compare against UTC day boundaries
    const dayUTC = Date.UTC(day.getFullYear(), day.getMonth(), day.getDate())
    const dayEndUTC = dayUTC + 86_400_000
    return eventStart.getTime() < dayEndUTC && eventEnd.getTime() > dayUTC
  }
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate())
  const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)
  return eventStart < dayEnd && eventEnd > dayStart
}

/** Add `minutes` to a Date and return a new Date */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}

/** Clamp a number between min and max */
export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}
