import { NextRequest, NextResponse } from 'next/server'
import { discoverAppleCalendars } from '@/lib/calendar/apple'
import { saveAccount } from '@/lib/redis'
import type { ConnectedAccount, CalendarType } from '@/lib/calendar/types'

const VALID_CALENDAR_TYPES = ['personal', 'work', 'kids', 'shared']

// POST /api/auth/apple/test
// Tests CalDAV connection, discovers calendars, and saves the account server-side.
// Body: { username, appPassword, memberId, calendarType, label? }
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { username, appPassword, memberId, calendarType, label } = body

  if (!username || !appPassword || !memberId) {
    return NextResponse.json(
      { error: 'username, appPassword, and memberId are required' },
      { status: 400 }
    )
  }

  const validType: CalendarType = VALID_CALENDAR_TYPES.includes(calendarType)
    ? calendarType
    : 'personal'

  try {
    const calendars = await discoverAppleCalendars(username, appPassword)

    // Save the account server-side (credentials never returned to client)
    const account: ConnectedAccount = {
      id: crypto.randomUUID(),
      provider: 'apple',
      familyMemberId: memberId,
      label: label?.trim() || `${username.split('@')[0]}'s iCloud`,
      email: username,
      calendarType: validType,
      auth: { type: 'caldav', username, appPassword },
      enabledCalendars: calendars.map(c => ({ ...c, enabled: true })),
      status: 'connected',
      connectedAt: new Date().toISOString(),
    }

    await saveAccount(account)

    // Return account info WITHOUT credentials
    return NextResponse.json({
      ok: true,
      accountId: account.id,
      calendars,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Connection failed'
    return NextResponse.json(
      { error: `CalDAV connection failed: ${message}. Check your email and app-specific password.` },
      { status: 401 }
    )
  }
}
