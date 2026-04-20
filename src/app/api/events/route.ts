import { NextRequest, NextResponse } from 'next/server'
import { getAccountsForMember } from '@/lib/redis'
import { createGoogleEvent } from '@/lib/calendar/google'
import { createOutlookEvent } from '@/lib/calendar/outlook'
import type { CalendarType } from '@/lib/calendar/types'

interface CreateEventBody {
  title: string
  date: string        // YYYY-MM-DD
  startTime: string   // HH:MM
  endTime: string     // HH:MM
  familyMemberId: string
  calendarType: CalendarType
  allDay?: boolean
  description?: string
  location?: string
}

// POST /api/events — create an event on the appropriate provider calendar
export async function POST(req: NextRequest) {
  const body: CreateEventBody = await req.json()
  const { title, date, startTime, endTime, familyMemberId, calendarType, allDay, description, location } = body

  if (!title || !date || !familyMemberId) {
    return NextResponse.json({ error: 'title, date, familyMemberId required' }, { status: 400 })
  }

  const accounts = await getAccountsForMember(familyMemberId)

  // Prefer an account whose calendarType matches, then fall back to any writable account
  const writable = accounts.filter(
    a => (a.provider === 'google' || a.provider === 'outlook') && a.status === 'connected'
  )
  const account =
    writable.find(a => a.calendarType === calendarType) ?? writable[0]

  if (!account) {
    return NextResponse.json(
      { error: 'No connected Google or Outlook account found for this family member' },
      { status: 422 }
    )
  }

  const calendarId =
    account.defaultWriteCalendarId ??
    (account.provider === 'google'
      ? 'primary'
      : account.enabledCalendars.find(c => c.enabled)?.calendarId)

  if (!calendarId) {
    return NextResponse.json({ error: 'No enabled calendar on account' }, { status: 422 })
  }

  // Build Date objects from the YYYY-MM-DD + HH:MM strings (local time)
  const [yr, mo, dy] = date.split('-').map(Number)
  let start: Date, end: Date
  if (allDay) {
    start = new Date(Date.UTC(yr, mo - 1, dy))
    end = new Date(Date.UTC(yr, mo - 1, dy + 1))
  } else {
    const [sh, sm] = startTime.split(':').map(Number)
    const [eh, em] = endTime.split(':').map(Number)
    start = new Date(yr, mo - 1, dy, sh, sm)
    end = new Date(yr, mo - 1, dy, eh, em)
  }

  try {
    let externalId: string
    if (account.provider === 'google') {
      const result = await createGoogleEvent(account, calendarId, { title, start, end, allDay: !!allDay, description, location })
      externalId = result.externalId
    } else {
      const result = await createOutlookEvent(account, calendarId, { title, start, end, allDay: !!allDay, description, location })
      externalId = result.externalId
    }

    return NextResponse.json({
      id: `${account.provider}-${account.id}-${externalId}`,
      externalId,
      accountId: account.id,
      provider: account.provider,
      calendarId,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
