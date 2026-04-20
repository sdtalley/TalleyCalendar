import { NextRequest, NextResponse } from 'next/server'
import { getAccount } from '@/lib/redis'
import { updateGoogleEvent, deleteGoogleEvent } from '@/lib/calendar/google'
import { updateOutlookEvent, deleteOutlookEvent } from '@/lib/calendar/outlook'

interface WriteEventBody {
  accountId: string
  calendarId: string
  externalId: string
  // PATCH only
  title?: string
  start?: string   // ISO string
  end?: string     // ISO string
  allDay?: boolean
  description?: string
}

// PATCH /api/events/[id] — update event times or title on provider
export async function PATCH(req: NextRequest) {
  const body: WriteEventBody = await req.json()
  const { accountId, calendarId, externalId, title, start, end, allDay, description } = body

  if (!accountId || !calendarId || !externalId) {
    return NextResponse.json({ error: 'accountId, calendarId, externalId required' }, { status: 400 })
  }

  const account = await getAccount(accountId)
  if (!account) return NextResponse.json({ error: 'account not found' }, { status: 404 })

  const updates: { title?: string; start?: Date; end?: Date; allDay?: boolean; description?: string } = {}
  if (title !== undefined) updates.title = title
  if (start !== undefined) updates.start = new Date(start)
  if (end !== undefined) updates.end = new Date(end)
  if (allDay !== undefined) updates.allDay = allDay
  if (description !== undefined) updates.description = description

  try {
    if (account.provider === 'google') {
      await updateGoogleEvent(account, calendarId, externalId, updates)
    } else if (account.provider === 'outlook') {
      await updateOutlookEvent(account, calendarId, externalId, updates)
    } else {
      return NextResponse.json({ error: 'Provider does not support write-back' }, { status: 422 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/events/[id] — delete event on provider
export async function DELETE(req: NextRequest) {
  const body: WriteEventBody = await req.json()
  const { accountId, calendarId, externalId } = body

  if (!accountId || !calendarId || !externalId) {
    return NextResponse.json({ error: 'accountId, calendarId, externalId required' }, { status: 400 })
  }

  const account = await getAccount(accountId)
  if (!account) return NextResponse.json({ error: 'account not found' }, { status: 404 })

  try {
    if (account.provider === 'google') {
      await deleteGoogleEvent(account, calendarId, externalId)
    } else if (account.provider === 'outlook') {
      await deleteOutlookEvent(account, calendarId, externalId)
    } else {
      return NextResponse.json({ error: 'Provider does not support write-back' }, { status: 422 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
