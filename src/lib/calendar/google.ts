import type { CalendarEvent, ConnectedAccount, OAuthCredentials } from './types'
import { updateAccount } from '../redis'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

// ── Token refresh ──────────────────────────────────────────────────────────

async function refreshAccessToken(account: ConnectedAccount): Promise<string> {
  if (account.auth.type !== 'oauth') throw new Error('Google account has non-OAuth auth')
  const auth = account.auth as OAuthCredentials

  // If token is still valid, return it
  if (auth.expiresAt > Date.now() + 60_000) {
    return auth.accessToken
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: auth.refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    await updateAccount(account.id, { status: 'reauth_needed' })
    throw new Error(`Google token refresh failed: ${res.status}`)
  }

  const data = await res.json()
  const newAuth: OAuthCredentials = {
    type: 'oauth',
    accessToken: data.access_token,
    refreshToken: auth.refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
  }

  await updateAccount(account.id, { auth: newAuth, status: 'connected' })
  return data.access_token
}

// ── Discover calendars ─────────────────────────────────────────────────────

export async function discoverGoogleCalendars(
  account: ConnectedAccount
): Promise<{ calendarId: string; name: string }[]> {
  const token = await refreshAccessToken(account)
  const res = await fetch(`${GOOGLE_CALENDAR_API}/users/me/calendarList`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) throw new Error(`Google calendarList failed: ${res.status}`)
  const data = await res.json()

  return (data.items ?? []).map((c: { id: string; summary: string }) => ({
    calendarId: c.id,
    name: c.summary,
  }))
}

// ── Fetch events ───────────────────────────────────────────────────────────

export async function fetchGoogleEvents(
  account: ConnectedAccount,
  timeMin: Date,
  timeMax: Date
): Promise<CalendarEvent[]> {
  const token = await refreshAccessToken(account)
  const events: CalendarEvent[] = []

  const enabledCals = account.enabledCalendars.filter(c => c.enabled)
  const member = account.familyMemberId

  for (const cal of enabledCals) {
    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    })

    const res = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(cal.calendarId)}/events?${params}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )

    if (!res.ok) continue

    const data = await res.json()
    for (const item of data.items ?? []) {
      const isAllDay = !!item.start?.date
      const start = new Date(item.start?.dateTime ?? item.start?.date)
      const end = new Date(item.end?.dateTime ?? item.end?.date)

      events.push({
        id: `google-${account.id}-${item.id}`,
        externalId: item.id,
        provider: 'google',
        accountId: account.id,
        title: item.summary ?? '(No title)',
        description: item.description,
        location: item.location,
        start,
        end,
        allDay: isAllDay,
        recurring: !!item.recurringEventId,
        recurrenceRule: item.recurrence?.[0],
        familyMemberId: member,
        calendarType: account.calendarType,
        color: '', // filled by aggregator from family member
        source: {
          calendarId: cal.calendarId,
          calendarName: cal.name,
          provider: 'google',
        },
      })
    }
  }

  return events
}

// ── Write operations ───────────────────────────────────────────────────────

export async function createGoogleEvent(
  account: ConnectedAccount,
  calendarId: string,
  event: { title: string; start: Date; end: Date; allDay: boolean; description?: string; location?: string }
): Promise<{ externalId: string }> {
  const token = await refreshAccessToken(account)

  const body = event.allDay
    ? { summary: event.title, description: event.description, location: event.location, start: { date: toDateStr(event.start) }, end: { date: toDateStr(event.end) } }
    : { summary: event.title, description: event.description, location: event.location, start: { dateTime: event.start.toISOString() }, end: { dateTime: event.end.toISOString() } }

  const res = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  )
  if (!res.ok) throw new Error(`Google create event failed: ${res.status}`)
  const data = await res.json()
  return { externalId: data.id }
}

export async function updateGoogleEvent(
  account: ConnectedAccount,
  calendarId: string,
  externalId: string,
  updates: { title?: string; start?: Date; end?: Date; allDay?: boolean; description?: string }
): Promise<void> {
  const token = await refreshAccessToken(account)

  const body: Record<string, unknown> = {}
  if (updates.title !== undefined) body.summary = updates.title
  if (updates.description !== undefined) body.description = updates.description
  if (updates.start && updates.end) {
    if (updates.allDay) {
      body.start = { date: toDateStr(updates.start) }
      body.end = { date: toDateStr(updates.end) }
    } else {
      body.start = { dateTime: updates.start.toISOString() }
      body.end = { dateTime: updates.end.toISOString() }
    }
  }

  const res = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(externalId)}`,
    { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  )
  if (!res.ok) throw new Error(`Google update event failed: ${res.status}`)
}

export async function deleteGoogleEvent(
  account: ConnectedAccount,
  calendarId: string,
  externalId: string
): Promise<void> {
  const token = await refreshAccessToken(account)

  const res = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(externalId)}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
  )
  // 410 = already deleted; treat as success
  if (!res.ok && res.status !== 410) throw new Error(`Google delete event failed: ${res.status}`)
}
