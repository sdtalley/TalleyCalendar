import type { CalendarEvent, ConnectedAccount, OAuthCredentials } from './types'
import { updateAccount } from '../redis'

const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
const GRAPH_API = 'https://graph.microsoft.com/v1.0'

// ── Token refresh ──────────────────────────────────────────────────────────

async function refreshAccessToken(account: ConnectedAccount): Promise<string> {
  if (account.auth.type !== 'oauth') throw new Error('Outlook account has non-OAuth auth')
  const auth = account.auth as OAuthCredentials

  if (auth.expiresAt > Date.now() + 60_000) {
    return auth.accessToken
  }

  const res = await fetch(MS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.AZURE_CLIENT_ID!,
      client_secret: process.env.AZURE_CLIENT_SECRET!,
      refresh_token: auth.refreshToken,
      grant_type: 'refresh_token',
      scope: 'Calendars.ReadWrite User.Read offline_access',
    }),
  })

  if (!res.ok) {
    await updateAccount(account.id, { status: 'reauth_needed' })
    throw new Error(`Outlook token refresh failed: ${res.status}`)
  }

  const data = await res.json()
  const newAuth: OAuthCredentials = {
    type: 'oauth',
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? auth.refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
  }

  await updateAccount(account.id, { auth: newAuth, status: 'connected' })
  return data.access_token
}

// ── Discover calendars ─────────────────────────────────────────────────────

export async function discoverOutlookCalendars(
  account: ConnectedAccount
): Promise<{ calendarId: string; name: string }[]> {
  const token = await refreshAccessToken(account)
  const res = await fetch(`${GRAPH_API}/me/calendars`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) throw new Error(`Outlook calendars failed: ${res.status}`)
  const data = await res.json()

  return (data.value ?? []).map((c: { id: string; name: string }) => ({
    calendarId: c.id,
    name: c.name,
  }))
}

// ── Fetch events ───────────────────────────────────────────────────────────

export async function fetchOutlookEvents(
  account: ConnectedAccount,
  timeMin: Date,
  timeMax: Date
): Promise<CalendarEvent[]> {
  const token = await refreshAccessToken(account)
  const events: CalendarEvent[] = []

  const enabledCals = account.enabledCalendars.filter(c => c.enabled)

  for (const cal of enabledCals) {
    const params = new URLSearchParams({
      startDateTime: timeMin.toISOString(),
      endDateTime: timeMax.toISOString(),
      $top: '250',
      $orderby: 'start/dateTime',
      $select: 'id,subject,bodyPreview,location,start,end,isAllDay,recurrence,seriesMasterId',
    })

    const res = await fetch(
      `${GRAPH_API}/me/calendars/${cal.calendarId}/calendarView?${params}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Prefer: 'outlook.timezone="UTC"',
        },
      }
    )

    if (!res.ok) continue

    const data = await res.json()
    for (const item of data.value ?? []) {
      const isAllDay = item.isAllDay ?? false
      // Outlook returns UTC datetimes without 'Z' suffix when Prefer: UTC is set
      const startRaw = item.start?.dateTime
      const endRaw = item.end?.dateTime
      if (!startRaw) continue
      const start = new Date(startRaw.endsWith('Z') ? startRaw : startRaw + 'Z')
      const end = endRaw ? new Date(endRaw.endsWith('Z') ? endRaw : endRaw + 'Z') : new Date(start.getTime() + 3600_000)

      events.push({
        id: `outlook-${account.id}-${item.id}`,
        externalId: item.id,
        provider: 'outlook',
        accountId: account.id,
        title: item.subject ?? '(No title)',
        description: item.bodyPreview,
        location: item.location?.displayName,
        start,
        end,
        allDay: isAllDay,
        recurring: !!item.seriesMasterId,
        recurrenceRule: item.recurrence ? JSON.stringify(item.recurrence) : undefined,
        familyMemberId: account.familyMemberId,
        calendarType: account.calendarType,
        color: '',
        source: {
          calendarId: cal.calendarId,
          calendarName: cal.name,
          provider: 'outlook',
        },
      })
    }
  }

  return events
}

// ── Write operations ───────────────────────────────────────────────────────

export async function createOutlookEvent(
  account: ConnectedAccount,
  calendarId: string,
  event: { title: string; start: Date; end: Date; allDay: boolean; description?: string; location?: string }
): Promise<{ externalId: string }> {
  const token = await refreshAccessToken(account)

  const toGraphDT = (d: Date) => d.toISOString().replace('Z', '')
  const body: Record<string, unknown> = {
    subject: event.title,
    isAllDay: event.allDay,
    start: { dateTime: toGraphDT(event.start), timeZone: 'UTC' },
    end: { dateTime: toGraphDT(event.end), timeZone: 'UTC' },
  }
  if (event.description) body.body = { contentType: 'Text', content: event.description }
  if (event.location) body.location = { displayName: event.location }

  const res = await fetch(
    `${GRAPH_API}/me/calendars/${calendarId}/events`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  )
  if (!res.ok) throw new Error(`Outlook create event failed: ${res.status}`)
  const data = await res.json()
  return { externalId: data.id }
}

export async function updateOutlookEvent(
  account: ConnectedAccount,
  calendarId: string,
  externalId: string,
  updates: { title?: string; start?: Date; end?: Date; allDay?: boolean; description?: string }
): Promise<void> {
  const token = await refreshAccessToken(account)

  const toGraphDT = (d: Date) => d.toISOString().replace('Z', '')
  const body: Record<string, unknown> = {}
  if (updates.title !== undefined) body.subject = updates.title
  if (updates.description !== undefined) body.body = { contentType: 'Text', content: updates.description }
  if (updates.start) body.start = { dateTime: toGraphDT(updates.start), timeZone: 'UTC' }
  if (updates.end) body.end = { dateTime: toGraphDT(updates.end), timeZone: 'UTC' }

  const res = await fetch(
    `${GRAPH_API}/me/calendars/${calendarId}/events/${externalId}`,
    { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  )
  if (!res.ok) throw new Error(`Outlook update event failed: ${res.status}`)
}

export async function deleteOutlookEvent(
  account: ConnectedAccount,
  calendarId: string,
  externalId: string
): Promise<void> {
  const token = await refreshAccessToken(account)

  const res = await fetch(
    `${GRAPH_API}/me/calendars/${calendarId}/events/${externalId}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok && res.status !== 404) throw new Error(`Outlook delete event failed: ${res.status}`)
}
