import { NextRequest, NextResponse } from 'next/server'
import { getAccount, updateAccount } from '@/lib/redis'

// PATCH /api/accounts/[id] — update account fields (toggle calendars, relabel, change type)
// Body: Partial<ConnectedAccount> (excluding id, provider, auth)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()

  const existing = await getAccount(id)
  if (!existing) {
    return NextResponse.json({ error: 'account not found' }, { status: 404 })
  }

  // Only allow updating safe fields (not auth or provider)
  const { label, calendarType, enabledCalendars, status, defaultWriteCalendarId } = body
  const updates: Record<string, unknown> = {}
  if (label !== undefined) updates.label = label
  if (calendarType !== undefined) updates.calendarType = calendarType
  if (enabledCalendars !== undefined) updates.enabledCalendars = enabledCalendars
  if (status !== undefined) updates.status = status
  if (defaultWriteCalendarId !== undefined) updates.defaultWriteCalendarId = defaultWriteCalendarId

  const updated = await updateAccount(id, updates)
  if (!updated) {
    return NextResponse.json({ error: 'update failed' }, { status: 500 })
  }

  const { auth, ...safe } = updated
  return NextResponse.json({ ...safe, authType: auth.type })
}

// GET /api/accounts/[id] — get a single account (without auth credentials)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const account = await getAccount(id)

  if (!account) {
    return NextResponse.json({ error: 'account not found' }, { status: 404 })
  }

  const { auth, ...safe } = account
  return NextResponse.json({ ...safe, authType: auth.type })
}
