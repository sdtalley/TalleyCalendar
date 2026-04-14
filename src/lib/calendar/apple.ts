import { createDAVClient, DAVCalendar } from 'tsdav'
import type { CalendarEvent, ConnectedAccount, CalDAVCredentials } from './types'

const ICLOUD_SERVER = 'https://caldav.icloud.com'

// ── Create CalDAV client ───────────────────────────────────────────────────

async function createClient(account: ConnectedAccount) {
  if (account.auth.type !== 'caldav') throw new Error('Apple account has non-CalDAV auth')
  const auth = account.auth as CalDAVCredentials
  return createDAVClient({
    serverUrl: ICLOUD_SERVER,
    credentials: {
      username: auth.username,
      password: auth.appPassword,
    },
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
  })
}

// ── Discover calendars ─────────────────────────────────────────────────────

export async function discoverAppleCalendars(
  username: string,
  appPassword: string
): Promise<{ calendarId: string; name: string }[]> {
  const client = await createDAVClient({
    serverUrl: ICLOUD_SERVER,
    credentials: { username, password: appPassword },
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
  })

  const calendars = await client.fetchCalendars()
  return calendars.map((c: DAVCalendar) => ({
    calendarId: c.url,
    name: typeof c.displayName === 'string'
      ? c.displayName
      : c.url.split('/').filter(Boolean).pop() ?? 'Calendar',
  }))
}

// ── Fetch events ───────────────────────────────────────────────────────────

export async function fetchAppleEvents(
  account: ConnectedAccount,
  timeMin: Date,
  timeMax: Date
): Promise<CalendarEvent[]> {
  const client = await createClient(account)
  const events: CalendarEvent[] = []

  const enabledCals = account.enabledCalendars.filter(c => c.enabled)

  // tsdav expects ISO strings for timeRange
  const start = timeMin.toISOString()
  const end = timeMax.toISOString()

  for (const cal of enabledCals) {
    try {
      // First try with timeRange filter
      let calObjects = await client.fetchCalendarObjects({
        calendar: { url: cal.calendarId } as DAVCalendar,
        timeRange: { start, end },
      })

      // If no results, try fetching all objects (some CalDAV servers don't support time-range)
      if (calObjects.length === 0) {
        calObjects = await client.fetchCalendarObjects({
          calendar: { url: cal.calendarId } as DAVCalendar,
        })
      }

      for (const obj of calObjects) {
        if (!obj.data) continue
        const parsed = parseVEvent(obj.data, account, cal)
        if (parsed) {
          // Manual time filter for the fallback case
          if (parsed.end >= timeMin && parsed.start <= timeMax) {
            events.push(parsed)
          }
        }
      }
    } catch (err) {
      console.error(`[Apple] Failed to fetch calendar ${cal.name}:`, err instanceof Error ? err.message : err)
    }
  }

  return events
}

// ── Parse iCalendar VEVENT ─────────────────────────────────────────────────

function parseVEvent(
  icalData: string,
  account: ConnectedAccount,
  cal: { calendarId: string; name: string }
): CalendarEvent | null {
  // Unfold RFC 5545 continuation lines (CRLF + whitespace)
  const unfolded = icalData.replace(/\r?\n[ \t]/g, '')
  const allLines = unfolded.split(/\r?\n/)

  // Extract only lines inside BEGIN:VEVENT / END:VEVENT
  // (avoids picking up DTSTART/RRULE from VTIMEZONE blocks)
  const lines: string[] = []
  let inVEvent = false
  for (const line of allLines) {
    if (line === 'BEGIN:VEVENT') { inVEvent = true; continue }
    if (line === 'END:VEVENT') { inVEvent = false; continue }
    if (inVEvent) lines.push(line)
  }

  let uid = ''
  let summary = ''
  let description = ''
  let location = ''
  let dtstart = ''
  let dtend = ''
  let rrule = ''
  let isAllDay = false
  let dtStartTzid: string | undefined
  let dtEndTzid: string | undefined

  for (const line of lines) {
    if (line.startsWith('UID:')) uid = line.slice(4)
    else if (line.startsWith('SUMMARY:')) summary = line.slice(8)
    else if (line.startsWith('DESCRIPTION:')) description = line.slice(12)
    else if (line.startsWith('LOCATION:')) location = line.slice(9)
    else if (line.startsWith('DTSTART')) {
      const tzidMatch = line.match(/TZID=([^:;]+)/)
      dtStartTzid = tzidMatch ? tzidMatch[1] : undefined
      const value = line.split(':').pop() ?? ''
      isAllDay = line.includes('VALUE=DATE') || (!value.includes('T'))
      dtstart = value
    } else if (line.startsWith('DTEND')) {
      const tzidMatch = line.match(/TZID=([^:;]+)/)
      dtEndTzid = tzidMatch ? tzidMatch[1] : undefined
      dtend = line.split(':').pop() ?? ''
    } else if (line.startsWith('RRULE:')) {
      rrule = line.slice(6)
    }
  }

  if (!dtstart) return null

  const start = parseICalDate(dtstart, dtStartTzid)
  const end = dtend ? parseICalDate(dtend, dtEndTzid) : new Date(start.getTime() + 3600_000)

  return {
    id: `apple-${account.id}-${uid}`,
    externalId: uid,
    provider: 'apple',
    accountId: account.id,
    title: summary || '(No title)',
    description: description || undefined,
    location: location || undefined,
    start,
    end,
    allDay: isAllDay,
    recurring: !!rrule,
    recurrenceRule: rrule || undefined,
    familyMemberId: account.familyMemberId,
    calendarType: account.calendarType,
    color: '',
    source: {
      calendarId: cal.calendarId,
      calendarName: cal.name,
      provider: 'apple',
    },
  }
}

function parseICalDate(str: string, tzid?: string): Date {
  // Format: 20260401T120000Z, 20260401T120000 (floating or TZID), or 20260401 (all-day)
  const clean = str.replace(/[^0-9TZ]/g, '')
  if (clean.length === 8) {
    // All-day: YYYYMMDD — keep as local midnight, no tz conversion
    return new Date(
      parseInt(clean.slice(0, 4)),
      parseInt(clean.slice(4, 6)) - 1,
      parseInt(clean.slice(6, 8))
    )
  }
  // DateTime: YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
  const y = parseInt(clean.slice(0, 4))
  const m = parseInt(clean.slice(4, 6)) - 1
  const d = parseInt(clean.slice(6, 8))
  const h = parseInt(clean.slice(9, 11))
  const min = parseInt(clean.slice(11, 13))
  const s = parseInt(clean.slice(13, 15)) || 0

  if (clean.endsWith('Z')) {
    // Explicit UTC — correct as-is
    return new Date(Date.UTC(y, m, d, h, min, s))
  }

  if (tzid) {
    // TZID-qualified local time (e.g. America/New_York).
    // Vercel runs in UTC so new Date(y,m,d,h,min,s) would be wrong —
    // use the Intl API to convert the named-timezone local time to UTC.
    return parseDateInTimezone(y, m, d, h, min, s, tzid)
  }

  // Floating time — no timezone info, treat as-is
  return new Date(y, m, d, h, min, s)
}

/**
 * Convert a broken-down "local time in tzid" to a UTC Date.
 * Uses the Intl offset trick: probe a UTC date with the same numeric
 * components, measure how far it drifts when formatted in the target
 * timezone, then subtract that drift.
 */
function parseDateInTimezone(
  y: number, m: number, d: number,
  h: number, min: number, s: number,
  tzid: string
): Date {
  // Step 1: treat the components as UTC to get a probe timestamp
  const probe = new Date(Date.UTC(y, m, d, h, min, s))

  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tzid,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    })
    const parts = fmt.formatToParts(probe)
    const get = (type: string) => parseInt(parts.find(p => p.type === type)!.value)
    // hour12:false can return 24 for midnight — clamp it
    const tzH = get('hour') % 24
    // Reconstruct what the probe looks like in the target timezone
    const inTz = Date.UTC(get('year'), get('month') - 1, get('day'), tzH, get('minute'), get('second'))
    // offsetMs = how far the probe is from what the timezone says it is
    const offsetMs = probe.getTime() - inTz
    return new Date(probe.getTime() + offsetMs)
  } catch {
    // Unknown timezone identifier — fall back to treating as UTC
    return probe
  }
}
