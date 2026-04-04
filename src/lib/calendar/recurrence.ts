import { RRule } from 'rrule'
import type { CalendarEvent } from './types'

/**
 * Expands recurring events into individual instances within the given time range.
 * Non-recurring events are passed through unchanged.
 * The original recurring event is replaced by its expanded instances.
 */
export function expandRecurringEvents(
  events: CalendarEvent[],
  rangeStart: Date,
  rangeEnd: Date
): CalendarEvent[] {
  const result: CalendarEvent[] = []

  for (const event of events) {
    if (!event.recurring || !event.recurrenceRule) {
      result.push(event)
      continue
    }

    try {
      const duration = event.end.getTime() - event.start.getTime()
      const rule = RRule.fromString(`DTSTART:${formatRRuleDate(event.start)}\nRRULE:${event.recurrenceRule}`)

      // Get occurrences within range (with some buffer for duration)
      const occurrences = rule.between(
        new Date(rangeStart.getTime() - duration),
        rangeEnd,
        true // inclusive
      )

      // Cap at 100 instances to prevent runaway expansion
      const limited = occurrences.slice(0, 100)

      if (limited.length === 0) {
        // If no occurrences in range, include original if it falls in range
        if (event.start < rangeEnd && event.end > rangeStart) {
          result.push(event)
        }
        continue
      }

      for (const occurrence of limited) {
        const instanceStart = occurrence
        const instanceEnd = new Date(occurrence.getTime() + duration)

        // Only include if it actually overlaps the range
        if (instanceEnd > rangeStart && instanceStart < rangeEnd) {
          result.push({
            ...event,
            id: `${event.id}-${instanceStart.getTime()}`,
            start: instanceStart,
            end: instanceEnd,
          })
        }
      }
    } catch {
      // If rrule parsing fails, include the original event as-is
      result.push(event)
    }
  }

  return result
}

function formatRRuleDate(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  const h = String(date.getUTCHours()).padStart(2, '0')
  const min = String(date.getUTCMinutes()).padStart(2, '0')
  const s = String(date.getUTCSeconds()).padStart(2, '0')
  return `${y}${m}${d}T${h}${min}${s}Z`
}
