import type { CalendarEvent, ConnectedAccount, OAuthCredentials } from './types'
import { updateAccount } from '../redis'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

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
